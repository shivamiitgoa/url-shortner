# Platform Stack

Creates core data plane and app runtime resources.

## Behavior

- Always creates core resources: Artifact Registry, Spanner, Redis, Pub/Sub, BigQuery, service accounts.
- Creates Cloud Run services only if `deploy_services=true` and non-empty image URIs are provided.

## Example

```bash
terraform -chdir=infra/platform init
terraform -chdir=infra/platform apply \
  -var='project_id=<project-id>' \
  -var='region=asia-south1' \
  -var='deploy_services=false'
```

Then apply with images:

```bash
terraform -chdir=infra/platform apply \
  -var='project_id=<project-id>' \
  -var='region=asia-south1' \
  -var='deploy_services=true' \
  -var='api_image=asia-south1-docker.pkg.dev/<project-id>/url-shortner/api-service:latest' \
  -var='redirect_image=asia-south1-docker.pkg.dev/<project-id>/url-shortner/redirect-service:latest' \
  -var='worker_image=asia-south1-docker.pkg.dev/<project-id>/url-shortner/events-worker:latest' \
  -var='web_image=asia-south1-docker.pkg.dev/<project-id>/url-shortner/web-dashboard:latest'
```
