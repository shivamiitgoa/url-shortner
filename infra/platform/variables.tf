variable "project_id" {
  type        = string
  description = "Project id created by bootstrap stack"
}

variable "region" {
  type        = string
  description = "Primary deployment region"
  default     = "asia-south1"
}

variable "deploy_services" {
  type        = bool
  description = "Whether Cloud Run services and push subscription should be created"
  default     = false
}

variable "artifact_repo" {
  type        = string
  description = "Artifact Registry repository name"
  default     = "url-shortner"
}

variable "api_image" {
  type        = string
  description = "Container image URI for api-service"
  default     = ""
}

variable "redirect_image" {
  type        = string
  description = "Container image URI for redirect-service"
  default     = ""
}

variable "worker_image" {
  type        = string
  description = "Container image URI for events-worker"
  default     = ""
}

variable "web_image" {
  type        = string
  description = "Container image URI for web-dashboard"
  default     = ""
}

variable "spanner_instance_name" {
  type        = string
  description = "Cloud Spanner instance id"
  default     = "url-shortner-spanner"
}

variable "spanner_database_name" {
  type        = string
  description = "Cloud Spanner database name"
  default     = "url_shortner"
}

variable "spanner_processing_units" {
  type        = number
  description = "Spanner processing units for manual mode"
  default     = 100
}

variable "redis_name" {
  type        = string
  description = "Memorystore instance id"
  default     = "url-shortner-redis"
}

variable "redis_memory_size_gb" {
  type        = number
  description = "Redis memory size in GB"
  default     = 1
}

variable "pubsub_topic_clicks" {
  type        = string
  description = "Pub/Sub topic for click events"
  default     = "url-clicks"
}

variable "bigquery_dataset" {
  type        = string
  description = "BigQuery dataset for analytics"
  default     = "url_analytics"
}

variable "public_base_url" {
  type        = string
  description = "Optional explicit short URL base"
  default     = ""
}

variable "allowed_origins" {
  type        = list(string)
  description = "Allowed CORS origins for API"
  default     = ["*"]
}
