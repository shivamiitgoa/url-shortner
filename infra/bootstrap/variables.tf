variable "billing_account_id" {
  type        = string
  description = "Billing account in format billingAccounts/XXXXXX-XXXXXX-XXXXXX"
}

variable "project_prefix" {
  type        = string
  description = "Prefix used for generated project id"
  default     = "url-shortner-prod"
}

variable "project_id" {
  type        = string
  description = "Optional explicit project id"
  default     = ""
}

variable "project_name" {
  type        = string
  description = "Display name for project"
  default     = "URL Shortner Production"
}

variable "budget_amount_usd" {
  type        = number
  description = "Monthly budget amount in USD"
  default     = 200
}

variable "region" {
  type        = string
  description = "Primary region"
  default     = "asia-south1"
}

variable "enabled_services" {
  type        = list(string)
  description = "APIs to enable"
  default = [
    "artifactregistry.googleapis.com",
    "bigquery.googleapis.com",
    "billingbudgets.googleapis.com",
    "cloudbuild.googleapis.com",
    "firebase.googleapis.com",
    "firebaserules.googleapis.com",
    "identitytoolkit.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "pubsub.googleapis.com",
    "redis.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "servicenetworking.googleapis.com",
    "spanner.googleapis.com",
    "vpcaccess.googleapis.com"
  ]
}
