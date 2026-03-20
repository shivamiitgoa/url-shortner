provider "google" {
  billing_project = null
}

resource "random_id" "project_suffix" {
  byte_length = 2
}

locals {
  generated_project_id = "${var.project_prefix}-${random_id.project_suffix.hex}"
  project_id           = var.project_id != "" ? var.project_id : local.generated_project_id
}

resource "google_project" "project" {
  project_id      = local.project_id
  name            = var.project_name
  billing_account = replace(var.billing_account_id, "billingAccounts/", "")
}

resource "google_project_service" "services" {
  for_each           = toset(var.enabled_services)
  project            = google_project.project.project_id
  service            = each.value
  disable_on_destroy = false
}
