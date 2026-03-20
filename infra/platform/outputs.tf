output "project_id" {
  value = var.project_id
}

output "artifact_repo" {
  value = google_artifact_registry_repository.containers.repository_id
}

output "spanner_instance" {
  value = google_spanner_instance.main.name
}

output "spanner_database" {
  value = google_spanner_database.main.name
}

output "redis_host" {
  value = google_redis_instance.cache.host
}

output "pubsub_topic_clicks" {
  value = google_pubsub_topic.clicks.name
}

output "bigquery_dataset" {
  value = google_bigquery_dataset.analytics.dataset_id
}

output "api_service_url" {
  value = var.deploy_services && local.deployable_images.api ? google_cloud_run_v2_service.api[0].uri : ""
}

output "redirect_service_url" {
  value = var.deploy_services && local.deployable_images.redirect ? google_cloud_run_v2_service.redirect[0].uri : ""
}

output "worker_service_url" {
  value = var.deploy_services && local.deployable_images.worker ? google_cloud_run_v2_service.worker[0].uri : ""
}

output "web_service_url" {
  value = var.deploy_services && local.deployable_images.web ? google_cloud_run_v2_service.web[0].uri : ""
}
