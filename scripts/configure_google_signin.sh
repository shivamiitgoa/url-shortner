#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
WEB_URL="${WEB_URL:-}"
GOOGLE_OAUTH_CLIENT_ID="${GOOGLE_OAUTH_CLIENT_ID:-}"
GOOGLE_OAUTH_CLIENT_SECRET="${GOOGLE_OAUTH_CLIENT_SECRET:-}"

if [[ -z "$PROJECT_ID" ]]; then
  echo "PROJECT_ID is not set and no active gcloud project was found." >&2
  exit 1
fi

if [[ -z "$GOOGLE_OAUTH_CLIENT_ID" || -z "$GOOGLE_OAUTH_CLIENT_SECRET" ]]; then
  cat >&2 <<'EOF'
Missing credentials.
Set:
  GOOGLE_OAUTH_CLIENT_ID
  GOOGLE_OAUTH_CLIENT_SECRET

Use a standard Web OAuth client from Google Auth Platform.
EOF
  exit 1
fi

if [[ "$GOOGLE_OAUTH_CLIENT_ID" != *.apps.googleusercontent.com ]]; then
  echo "Invalid GOOGLE_OAUTH_CLIENT_ID: must end with .apps.googleusercontent.com" >&2
  exit 1
fi

if [[ -n "$WEB_URL" ]]; then
  WEB_URL="${WEB_URL%/}"
fi

WEB_HOST="$(
  python3 -c 'import sys,urllib.parse; print(urllib.parse.urlparse(sys.argv[1]).hostname or "")' "$WEB_URL"
)"

ACCESS_TOKEN="$(gcloud auth print-access-token)"

echo "Initializing Identity Platform auth for project ${PROJECT_ID}..."
INIT_RESP="$(curl -sS -X POST \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "x-goog-user-project: ${PROJECT_ID}" \
  "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/identityPlatform:initializeAuth")"
if echo "$INIT_RESP" | grep -q "\"error\""; then
  echo "Warning: initializeAuth returned: $INIT_RESP"
fi

cat > /tmp/url_shortner_google_idp.json <<JSON
{
  "name": "projects/${PROJECT_ID}/defaultSupportedIdpConfigs/google.com",
  "enabled": true,
  "clientId": "${GOOGLE_OAUTH_CLIENT_ID}",
  "clientSecret": "${GOOGLE_OAUTH_CLIENT_SECRET}"
}
JSON

IDP_GET="$(curl -sS \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-goog-user-project: ${PROJECT_ID}" \
  "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs/google.com")"

if echo "$IDP_GET" | grep -q "\"error\""; then
  echo "Creating Google provider configuration..."
  curl -sS -X POST \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -H "x-goog-user-project: ${PROJECT_ID}" \
    "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs?idpId=google.com" \
    --data @/tmp/url_shortner_google_idp.json >/tmp/url_shortner_google_idp_resp.json
else
  echo "Updating Google provider configuration..."
  curl -sS -X PATCH \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -H "x-goog-user-project: ${PROJECT_ID}" \
    "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/defaultSupportedIdpConfigs/google.com?updateMask=enabled,clientId,clientSecret" \
    --data @/tmp/url_shortner_google_idp.json >/tmp/url_shortner_google_idp_resp.json
fi

if grep -q "\"error\"" /tmp/url_shortner_google_idp_resp.json; then
  echo "Failed to configure Google provider:" >&2
  cat /tmp/url_shortner_google_idp_resp.json >&2
  exit 1
fi

DOMAINS_PAYLOAD="$(
  python3 -c '
import json,sys
project_id=sys.argv[1]
web_host=sys.argv[2]
domains=[f"{project_id}.firebaseapp.com", f"{project_id}.web.app", "localhost"]
if web_host and web_host not in domains:
    domains.append(web_host)
print(json.dumps({"authorizedDomains": domains}))
' "$PROJECT_ID" "$WEB_HOST"
)"

echo "Updating authorized domains..."
curl -sS -X PATCH \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "x-goog-user-project: ${PROJECT_ID}" \
  "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/config?updateMask=authorizedDomains" \
  --data "$DOMAINS_PAYLOAD" >/tmp/url_shortner_auth_domains_resp.json

if grep -q "\"error\"" /tmp/url_shortner_auth_domains_resp.json; then
  echo "Failed to update authorized domains:" >&2
  cat /tmp/url_shortner_auth_domains_resp.json >&2
  exit 1
fi

PROJECT_CONFIG="$(curl -sS \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "x-goog-user-project: ${PROJECT_ID}" \
  "https://identitytoolkit.googleapis.com/v2/projects/${PROJECT_ID}/config")"
API_KEY="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get("client", {}).get("apiKey", ""))' "$PROJECT_CONFIG")"
if [[ -z "$API_KEY" ]]; then
  echo "Failed to retrieve Firebase API key from project config." >&2
  exit 1
fi

CONTINUE_URI="${WEB_URL:-https://${PROJECT_ID}.firebaseapp.com}"
AUTH_URI_RESP="$(curl -sS \
  "https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${API_KEY}" \
  -H "Content-Type: application/json" \
  --data "{\"providerId\":\"google.com\",\"continueUri\":\"${CONTINUE_URI}\"}")"
AUTH_URI="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get("authUri",""))' "$AUTH_URI_RESP")"
if [[ "$AUTH_URI" != *"client_id=${GOOGLE_OAUTH_CLIENT_ID}"* ]]; then
  echo "Configured provider, but verification did not return expected client_id:" >&2
  echo "$AUTH_URI_RESP" >&2
  exit 1
fi

echo "Google Sign-In configured for project: ${PROJECT_ID}"
echo "Web URL: ${WEB_URL:-not provided}"
