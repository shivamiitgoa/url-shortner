# URL Shortner

Scalable URL shortener system for GCP with:

- `api-service` (authenticated CRUD + analytics)
- `redirect-service` (public redirects, Redis hot path + Spanner fallback)
- `events-worker` (Pub/Sub push consumer to BigQuery)
- `web-dashboard` (Firebase Auth + link management)
- Terraform stacks: `infra/bootstrap`, `infra/platform`, `infra/edge`

## Project intent

- This is a reference implementation for a scale-ready URL shortener architecture.
- Runtime resources are deployed in an isolated GCP project and may be deleted at any time.
- Public test endpoints are temporary and should not be treated as permanent production URLs.

## Quick Start

1. Install Node 24 (LTS) and dependencies:
   - `npm install`
2. Copy env templates and run locally.
3. Provision GCP with Terraform stacks.

Detailed instructions are in:
- `scripts/deploy_end_to_end.sh`
- `infra/bootstrap/README.md`
- `infra/platform/README.md`
- `docs/system-design.md`

## Google Sign-In Setup

Identity Platform requires a standard Google Web OAuth client for `google.com` sign-in.
Do not use `gcloud iam oauth-clients` for this flow.

1. In Google Cloud Console, open `Google Auth Platform -> Clients`.
2. Create an `OAuth 2.0 Client ID` of type `Web application`.
3. Add redirect URI(s):
   - `https://<PROJECT_ID>.firebaseapp.com/__/auth/handler`
   - `https://<WEB_RUN_APP_HOST>/__/auth/handler` (if using Cloud Run URL directly)
4. Configure Identity Platform with the created credentials:

```bash
export GOOGLE_OAUTH_CLIENT_ID='<client-id>.apps.googleusercontent.com'
export GOOGLE_OAUTH_CLIENT_SECRET='<client-secret>'
export WEB_URL='https://<your-web-cloud-run-host>'  # optional
./scripts/configure_google_signin.sh
```
