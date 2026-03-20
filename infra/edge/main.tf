provider "google" {
  project = var.project_id
  region  = var.region
}

locals {
  edge_enabled = var.enabled && var.domain != "" && var.redirect_service_url != "" && var.api_service_url != "" && var.web_service_url != ""
}

# Intentionally left as a toggle-ready stack.
# When `edge_enabled=true`, add HTTPS LB + Cloud Armor + DNS mappings with serverless NEGs.
# For the current phase we keep run.app temporary hostnames.
