#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

REGION="${REGION:-asia-south1}"
PROJECT_PREFIX="${PROJECT_PREFIX:-url-shortner-prod}"
BILLING_ACCOUNT_ID="${BILLING_ACCOUNT_ID:-}"

if ! command -v terraform >/dev/null 2>&1; then
  echo "Terraform not found, installing..."
  "$ROOT_DIR/scripts/install_terraform.sh"
  export PATH="$HOME/.local/bin:$PATH"
fi

if [[ -z "$BILLING_ACCOUNT_ID" ]]; then
  CURRENT_PROJECT="$(gcloud config get-value project)"
  BILLING_ACCOUNT_ID="$(gcloud beta billing projects describe "$CURRENT_PROJECT" --format='value(billingAccountName)')"
fi

if [[ -z "$BILLING_ACCOUNT_ID" ]]; then
  echo "Unable to determine billing account id. Export BILLING_ACCOUNT_ID and rerun."
  exit 1
fi

echo "Using billing account: $BILLING_ACCOUNT_ID"

refresh_tf_token() {
  export GOOGLE_OAUTH_ACCESS_TOKEN="$(gcloud auth print-access-token)"
}

wait_for_firebase_operation() {
  local project_id="$1"
  local operation_name="$2"

  for _ in $(seq 1 60); do
    local response
    response="$(curl -sS \
      -H "Authorization: Bearer ${GOOGLE_OAUTH_ACCESS_TOKEN}" \
      -H "x-goog-user-project: ${project_id}" \
      "https://firebase.googleapis.com/v1beta1/${operation_name}")"

    local done_flag
    done_flag="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get("done", False))' "$response")"
    if [[ "$done_flag" == "True" ]]; then
      echo "$response"
      return 0
    fi
    sleep 3
  done

  echo "Timed out waiting for Firebase operation: ${operation_name}" >&2
  return 1
}

ensure_budget_alert() {
  local billing_account_raw="${BILLING_ACCOUNT_ID#billingAccounts/}"
  local currency_code
  currency_code="$(gcloud billing accounts describe "${BILLING_ACCOUNT_ID}" --format='value(currencyCode)' 2>/dev/null || echo "USD")"
  if [[ -z "$currency_code" ]]; then
    currency_code="USD"
  fi

  local existing
  existing="$(curl -sS \
    -H "Authorization: Bearer ${GOOGLE_OAUTH_ACCESS_TOKEN}" \
    -H "x-goog-user-project: ${PROJECT_ID}" \
    "https://billingbudgets.googleapis.com/v1/billingAccounts/${billing_account_raw}/budgets")"

  if echo "$existing" | grep -q "\"displayName\": \"url-shortner-monthly-budget\""; then
    echo "Budget already exists; skipping creation."
    return 0
  fi

  cat > /tmp/url_shortner_budget.json <<JSON
{
  "displayName": "url-shortner-monthly-budget",
  "budgetFilter": {
    "projects": ["projects/${PROJECT_ID}"]
  },
  "amount": {
    "specifiedAmount": {
      "currencyCode": "${currency_code}",
      "units": "200"
    }
  },
  "thresholdRules": [
    {"thresholdPercent": 0.5},
    {"thresholdPercent": 0.8},
    {"thresholdPercent": 1.0}
  ]
}
JSON

  curl -sS -X POST \
    -H "Authorization: Bearer ${GOOGLE_OAUTH_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -H "x-goog-user-project: ${PROJECT_ID}" \
    "https://billingbudgets.googleapis.com/v1/billingAccounts/${billing_account_raw}/budgets" \
    --data @/tmp/url_shortner_budget.json >/tmp/url_shortner_budget_resp.json

  if grep -q "\"error\"" /tmp/url_shortner_budget_resp.json; then
    echo "Warning: budget creation failed. Response:"
    cat /tmp/url_shortner_budget_resp.json
  else
    echo "Budget alert created."
  fi
}

ensure_firebase_web_config() {
  local add_resp
  add_resp="$(curl -sS -X POST \
    -H "Authorization: Bearer ${GOOGLE_OAUTH_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -H "x-goog-user-project: ${PROJECT_ID}" \
    "https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}:addFirebase")"

  if echo "$add_resp" | grep -q "\"name\""; then
    local add_op
    add_op="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get("name",""))' "$add_resp")"
    if [[ -n "$add_op" ]]; then
      wait_for_firebase_operation "$PROJECT_ID" "$add_op" >/dev/null
    fi
  fi

  local apps_resp
  apps_resp="$(curl -sS \
    -H "Authorization: Bearer ${GOOGLE_OAUTH_ACCESS_TOKEN}" \
    -H "x-goog-user-project: ${PROJECT_ID}" \
    "https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}/webApps")"

  local app_id
  app_id="$(python3 -c '
import json,sys
data=json.loads(sys.argv[1] or "{}")
apps=data.get("apps", [])
target=None
for app in apps:
    if app.get("displayName") == "URL Shortner Dashboard":
        target=app
        break
if target is None and apps:
    target=apps[0]
print("" if target is None else target.get("appId",""))
' "$apps_resp")"

  if [[ -z "$app_id" ]]; then
    local create_resp
    create_resp="$(curl -sS -X POST \
      -H "Authorization: Bearer ${GOOGLE_OAUTH_ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -H "x-goog-user-project: ${PROJECT_ID}" \
      "https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}/webApps" \
      -d '{"displayName":"URL Shortner Dashboard"}')"

    local create_op
    create_op="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get("name",""))' "$create_resp")"
    if [[ -z "$create_op" ]]; then
      echo "Failed to create Firebase web app: $create_resp"
      exit 1
    fi

    local create_done
    create_done="$(wait_for_firebase_operation "$PROJECT_ID" "$create_op")"
    app_id="$(python3 -c '
import json,sys
resp=json.loads(sys.argv[1])
print(resp.get("response", {}).get("appId", ""))
' "$create_done")"
  fi

  local config_resp
  config_resp="$(curl -sS \
    -H "Authorization: Bearer ${GOOGLE_OAUTH_ACCESS_TOKEN}" \
    -H "x-goog-user-project: ${PROJECT_ID}" \
    "https://firebase.googleapis.com/v1beta1/projects/${PROJECT_ID}/webApps/${app_id}/config")"

  FIREBASE_API_KEY="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get("apiKey",""))' "$config_resp")"
  FIREBASE_AUTH_DOMAIN="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get("authDomain",""))' "$config_resp")"
  FIREBASE_APP_ID="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get("appId",""))' "$config_resp")"

  if [[ -z "$FIREBASE_API_KEY" || -z "$FIREBASE_AUTH_DOMAIN" || -z "$FIREBASE_APP_ID" ]]; then
    echo "Failed to resolve Firebase web config: $config_resp"
    exit 1
  fi
}

ensure_identity_platform_google_signin() {
  local web_url="${1:-}"
  local web_host=""
  local configured_client_id=""
  local configured_client_secret=""
  local client_id="${GOOGLE_OAUTH_CLIENT_ID:-}"
  local client_secret="${GOOGLE_OAUTH_CLIENT_SECRET:-}"

  if [[ -n "$web_url" ]]; then
    web_url="${web_url%/}"
    web_host="$(python3 -c 'import sys,urllib.parse; print(urllib.parse.urlparse(sys.argv[1]).hostname or "")' "$web_url")"
  fi

  # Initialize Firebase Auth/Identity Platform config if not already initialized.
  local init_resp
  init_resp="$(curl -sS -X POST \
    -H "Authorization: Bearer ${GOOGLE_OAUTH_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -H "x-goog-user-project: ${PROJECT_ID}" \
    "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/identityPlatform:initializeAuth")"
  if echo "$init_resp" | grep -q "\"error\""; then
    echo "Warning: identity platform init returned: $init_resp"
  fi

  local idp_get
  idp_get="$(curl -sS \
    -H "Authorization: Bearer ${GOOGLE_OAUTH_ACCESS_TOKEN}" \
    -H "x-goog-user-project: ${PROJECT_ID}" \
    "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs/google.com")"
  configured_client_id="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1] or "{}").get("clientId",""))' "$idp_get")"
  configured_client_secret="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1] or "{}").get("clientSecret",""))' "$idp_get")"

  if [[ -z "$client_id" ]]; then
    client_id="$configured_client_id"
  fi
  if [[ -z "$client_secret" ]]; then
    client_secret="$configured_client_secret"
  fi

  if [[ -z "$client_id" || -z "$client_secret" ]]; then
    cat >&2 <<'EOF'
Google Sign-In is not configured.
Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET to a standard Web OAuth client from
Google Auth Platform (APIs & Services -> Credentials). The client ID must end with:
  .apps.googleusercontent.com
EOF
    return 1
  fi

  if [[ "$client_id" != *.apps.googleusercontent.com ]]; then
    cat >&2 <<EOF
Google Sign-In is misconfigured: client ID is not a standard Web OAuth client.
Current value: ${client_id}
Expected suffix: .apps.googleusercontent.com
Set GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET and rerun.
EOF
    return 1
  fi

  cat > /tmp/url_shortner_google_idp.json <<JSON
{
  "name": "projects/${PROJECT_ID}/defaultSupportedIdpConfigs/google.com",
  "enabled": true,
  "clientId": "${client_id}",
  "clientSecret": "${client_secret}"
}
JSON

  if echo "$idp_get" | grep -q "\"error\""; then
    curl -sS -X POST \
      -H "Authorization: Bearer ${GOOGLE_OAUTH_ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -H "x-goog-user-project: ${PROJECT_ID}" \
      "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs?idpId=google.com" \
      --data @/tmp/url_shortner_google_idp.json >/tmp/url_shortner_google_idp_resp.json
  else
    curl -sS -X PATCH \
      -H "Authorization: Bearer ${GOOGLE_OAUTH_ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -H "x-goog-user-project: ${PROJECT_ID}" \
      "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs/google.com?updateMask=enabled,clientId,clientSecret" \
      --data @/tmp/url_shortner_google_idp.json >/tmp/url_shortner_google_idp_resp.json
  fi

  if grep -q "\"error\"" /tmp/url_shortner_google_idp_resp.json; then
    echo "Warning: Google IdP configuration failed. Response:"
    cat /tmp/url_shortner_google_idp_resp.json
  fi

  local domains_payload
  domains_payload="$(
    python3 -c '
import json,sys
project_id=sys.argv[1]
web_host=sys.argv[2]
domains=[f"{project_id}.firebaseapp.com", f"{project_id}.web.app", "localhost"]
if web_host and web_host not in domains:
    domains.append(web_host)
print(json.dumps({"authorizedDomains": domains}))
' "$PROJECT_ID" "$web_host"
  )"

  curl -sS -X PATCH \
    -H "Authorization: Bearer ${GOOGLE_OAUTH_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -H "x-goog-user-project: ${PROJECT_ID}" \
    "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/config?updateMask=authorizedDomains" \
    --data "$domains_payload" >/tmp/url_shortner_auth_domains_resp.json

  if grep -q "\"error\"" /tmp/url_shortner_auth_domains_resp.json; then
    echo "Warning: authorized domain update failed. Response:"
    cat /tmp/url_shortner_auth_domains_resp.json
  fi
}

tf_bootstrap() {
  refresh_tf_token
  terraform -chdir=infra/bootstrap init -upgrade
  refresh_tf_token
  terraform -chdir=infra/bootstrap apply -auto-approve \
    -var="billing_account_id=${BILLING_ACCOUNT_ID}" \
    -var="project_prefix=${PROJECT_PREFIX}" \
    -var="region=${REGION}"
}

tf_platform_core() {
  refresh_tf_token
  terraform -chdir=infra/platform init -upgrade
  refresh_tf_token
  terraform -chdir=infra/platform apply -auto-approve \
    -var="project_id=${PROJECT_ID}" \
    -var="region=${REGION}" \
    -var="deploy_services=false"
}

tf_platform_services() {
  refresh_tf_token
  terraform -chdir=infra/platform apply -auto-approve \
    -var="project_id=${PROJECT_ID}" \
    -var="region=${REGION}" \
    -var="deploy_services=true" \
    -var="api_image=${API_IMAGE}" \
    -var="redirect_image=${REDIRECT_IMAGE}" \
    -var="worker_image=${WORKER_IMAGE}" \
    -var="web_image=${WEB_IMAGE}" \
    -var="public_base_url=${REDIRECT_URL:-}"
}

tf_bootstrap

PROJECT_ID="$(terraform -chdir=infra/bootstrap output -raw project_id)"
PROJECT_NUMBER="$(terraform -chdir=infra/bootstrap output -raw project_number)"

if [[ -z "$PROJECT_ID" ]]; then
  echo "Failed to read project_id from bootstrap outputs"
  exit 1
fi

echo "Provisioned project: $PROJECT_ID ($PROJECT_NUMBER)"

gcloud config set project "$PROJECT_ID" >/dev/null

gcloud services enable cloudbuild.googleapis.com artifactregistry.googleapis.com run.googleapis.com >/dev/null

refresh_tf_token
ensure_budget_alert
refresh_tf_token
ensure_firebase_web_config
refresh_tf_token
ensure_identity_platform_google_signin ""

tf_platform_core

REPO="url-shortner"
AR_HOST="${REGION}-docker.pkg.dev"
API_IMAGE="${AR_HOST}/${PROJECT_ID}/${REPO}/api-service:latest"
REDIRECT_IMAGE="${AR_HOST}/${PROJECT_ID}/${REPO}/redirect-service:latest"
WORKER_IMAGE="${AR_HOST}/${PROJECT_ID}/${REPO}/events-worker:latest"
WEB_IMAGE="${AR_HOST}/${PROJECT_ID}/${REPO}/web-dashboard:latest"

echo "Building backend images with Cloud Build..."
gcloud builds submit \
  --project "$PROJECT_ID" \
  --config cloudbuild/service-image.yaml \
  --substitutions="_IMAGE=${API_IMAGE},_DOCKERFILE=apps/api-service/Dockerfile" \
  .
gcloud builds submit \
  --project "$PROJECT_ID" \
  --config cloudbuild/service-image.yaml \
  --substitutions="_IMAGE=${REDIRECT_IMAGE},_DOCKERFILE=apps/redirect-service/Dockerfile" \
  .
gcloud builds submit \
  --project "$PROJECT_ID" \
  --config cloudbuild/service-image.yaml \
  --substitutions="_IMAGE=${WORKER_IMAGE},_DOCKERFILE=apps/events-worker/Dockerfile" \
  .

# First deploy of runtime services without web dashboard image config dependency.
REDIRECT_URL=""
WEB_IMAGE=""
tf_platform_services

API_URL="$(terraform -chdir=infra/platform output -raw api_service_url)"
REDIRECT_URL="$(terraform -chdir=infra/platform output -raw redirect_service_url)"

if [[ -z "$API_URL" || -z "$REDIRECT_URL" ]]; then
  echo "Failed to retrieve API or redirect Cloud Run URL"
  exit 1
fi

echo "Building web dashboard image with runtime endpoints..."
gcloud builds submit \
  --project "$PROJECT_ID" \
  --config cloudbuild/web-image.yaml \
  --substitutions="_WEB_IMAGE=${AR_HOST}/${PROJECT_ID}/${REPO}/web-dashboard:latest,_API_BASE_URL=${API_URL},_FIREBASE_API_KEY=${FIREBASE_API_KEY},_FIREBASE_AUTH_DOMAIN=${FIREBASE_AUTH_DOMAIN},_FIREBASE_PROJECT_ID=${PROJECT_ID},_FIREBASE_APP_ID=${FIREBASE_APP_ID}" \
  .

WEB_IMAGE="${AR_HOST}/${PROJECT_ID}/${REPO}/web-dashboard:latest"
tf_platform_services

WORKER_URL="$(terraform -chdir=infra/platform output -raw worker_service_url)"
WEB_URL="$(terraform -chdir=infra/platform output -raw web_service_url)"

refresh_tf_token
ensure_identity_platform_google_signin "$WEB_URL"

echo "Deployment complete"
echo "Project ID: $PROJECT_ID"
echo "API URL: $API_URL"
echo "Redirect URL: $REDIRECT_URL"
echo "Worker URL: $WORKER_URL"
echo "Web URL: $WEB_URL"
