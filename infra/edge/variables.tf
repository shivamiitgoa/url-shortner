variable "project_id" {
  type        = string
  description = "Project id"
}

variable "region" {
  type        = string
  description = "Primary region"
  default     = "asia-south1"
}

variable "enabled" {
  type        = bool
  description = "Whether edge load balancer resources should be created"
  default     = false
}

variable "domain" {
  type        = string
  description = "Custom domain name"
  default     = ""
}

variable "redirect_service_url" {
  type        = string
  description = "Cloud Run redirect service URL"
  default     = ""
}

variable "api_service_url" {
  type        = string
  description = "Cloud Run API service URL"
  default     = ""
}

variable "web_service_url" {
  type        = string
  description = "Cloud Run web service URL"
  default     = ""
}
