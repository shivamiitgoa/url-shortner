provider "google" {
  project = var.project_id
  region  = var.region
}

data "google_project" "current" {
  project_id = var.project_id
}

locals {
  required_services = [
    "artifactregistry.googleapis.com",
    "bigquery.googleapis.com",
    "cloudbuild.googleapis.com",
    "compute.googleapis.com",
    "eventarc.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "pubsub.googleapis.com",
    "redis.googleapis.com",
    "run.googleapis.com",
    "servicenetworking.googleapis.com",
    "spanner.googleapis.com",
    "vpcaccess.googleapis.com"
  ]

  deployable_images = {
    api      = var.api_image != ""
    redirect = var.redirect_image != ""
    worker   = var.worker_image != ""
    web      = var.web_image != ""
  }

  public_base_url = var.public_base_url != "" ? var.public_base_url : (
    var.deploy_services && local.deployable_images.redirect ? google_cloud_run_v2_service.redirect[0].uri : ""
  )
}

resource "google_project_service" "services" {
  for_each           = toset(local.required_services)
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_artifact_registry_repository" "containers" {
  project       = var.project_id
  location      = var.region
  repository_id = var.artifact_repo
  description   = "Container images for URL shortner services"
  format        = "DOCKER"

  depends_on = [google_project_service.services]
}

resource "google_spanner_instance" "main" {
  project          = var.project_id
  name             = var.spanner_instance_name
  display_name     = "URL Shortner Spanner"
  config           = "regional-${var.region}"
  processing_units = var.spanner_processing_units

  depends_on = [google_project_service.services]
}

resource "google_spanner_database" "main" {
  project  = var.project_id
  instance = google_spanner_instance.main.name
  name     = var.spanner_database_name
  deletion_protection = false

  ddl = [
    "CREATE TABLE Urls (\n  code STRING(32) NOT NULL,\n  long_url STRING(MAX) NOT NULL,\n  owner_uid STRING(128) NOT NULL,\n  status STRING(16) NOT NULL,\n  created_at TIMESTAMP NOT NULL OPTIONS (allow_commit_timestamp=true),\n  updated_at TIMESTAMP NOT NULL OPTIONS (allow_commit_timestamp=true),\n  expires_at TIMESTAMP,\n  redirect_type INT64 NOT NULL\n) PRIMARY KEY (code)",
    "CREATE INDEX UrlsByOwnerCreatedAt ON Urls(owner_uid, created_at DESC) STORING (long_url, status, updated_at, expires_at, redirect_type)"
  ]
}

resource "google_redis_instance" "cache" {
  project            = var.project_id
  region             = var.region
  name               = var.redis_name
  tier               = "STANDARD_HA"
  memory_size_gb     = var.redis_memory_size_gb
  authorized_network = "projects/${var.project_id}/global/networks/default"
  redis_version      = "REDIS_7_0"
  connect_mode       = "DIRECT_PEERING"

  depends_on = [google_project_service.services]
}

resource "google_vpc_access_connector" "serverless" {
  project       = var.project_id
  name          = "url-shortner-connector"
  region        = var.region
  network       = "default"
  ip_cidr_range = "10.8.0.0/28"

  depends_on = [google_project_service.services]
}

resource "google_bigquery_dataset" "analytics" {
  project                    = var.project_id
  dataset_id                 = var.bigquery_dataset
  location                   = var.region
  delete_contents_on_destroy = true
}

resource "google_bigquery_table" "click_events" {
  project    = var.project_id
  dataset_id = google_bigquery_dataset.analytics.dataset_id
  table_id   = "click_events"

  time_partitioning {
    type          = "DAY"
    field         = "event_date"
    expiration_ms = 7776000000
  }

  schema = jsonencode([
    { name = "code", type = "STRING", mode = "REQUIRED" },
    { name = "clicked_at", type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "event_date", type = "DATE", mode = "REQUIRED" },
    { name = "ip", type = "STRING", mode = "NULLABLE" },
    { name = "user_agent", type = "STRING", mode = "NULLABLE" },
    { name = "referer", type = "STRING", mode = "NULLABLE" },
    { name = "ingested_at", type = "TIMESTAMP", mode = "REQUIRED" }
  ])
}

resource "google_bigquery_table" "daily_clicks" {
  project    = var.project_id
  dataset_id = google_bigquery_dataset.analytics.dataset_id
  table_id   = "daily_clicks"

  time_partitioning {
    type  = "DAY"
    field = "event_date"
  }

  schema = jsonencode([
    { name = "code", type = "STRING", mode = "REQUIRED" },
    { name = "event_date", type = "DATE", mode = "REQUIRED" },
    { name = "clicks", type = "INT64", mode = "REQUIRED" },
    { name = "ingested_at", type = "TIMESTAMP", mode = "REQUIRED" }
  ])
}

resource "google_pubsub_topic" "clicks" {
  project = var.project_id
  name    = var.pubsub_topic_clicks
}

resource "google_service_account" "api" {
  project      = var.project_id
  account_id   = "url-api-service"
  display_name = "URL API Service"
}

resource "google_service_account" "redirect" {
  project      = var.project_id
  account_id   = "url-redirect-service"
  display_name = "URL Redirect Service"
}

resource "google_service_account" "worker" {
  project      = var.project_id
  account_id   = "url-events-worker"
  display_name = "URL Events Worker"
}

resource "google_service_account" "web" {
  project      = var.project_id
  account_id   = "url-web-dashboard"
  display_name = "URL Web Dashboard"
}

resource "google_service_account" "pubsub_push_invoker" {
  project      = var.project_id
  account_id   = "url-pubsub-push-invoker"
  display_name = "PubSub Push Invoker"
}

resource "google_project_iam_member" "api_spanner" {
  project = var.project_id
  role    = "roles/spanner.databaseUser"
  member  = "serviceAccount:${google_service_account.api.email}"
}

resource "google_project_iam_member" "api_bigquery" {
  project = var.project_id
  role    = "roles/bigquery.dataViewer"
  member  = "serviceAccount:${google_service_account.api.email}"
}

resource "google_project_iam_member" "redirect_spanner" {
  project = var.project_id
  role    = "roles/spanner.databaseReader"
  member  = "serviceAccount:${google_service_account.redirect.email}"
}

resource "google_project_iam_member" "redirect_pubsub" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.redirect.email}"
}

resource "google_project_iam_member" "worker_bigquery" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.worker.email}"
}

resource "google_project_iam_member" "cloudbuild_artifact_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${data.google_project.current.number}@cloudbuild.gserviceaccount.com"
}

resource "google_project_iam_member" "cloudbuild_run_admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${data.google_project.current.number}@cloudbuild.gserviceaccount.com"
}

resource "google_project_iam_member" "cloudbuild_sa_user" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${data.google_project.current.number}@cloudbuild.gserviceaccount.com"
}

resource "google_service_account_iam_member" "pubsub_push_token_creator" {
  service_account_id = google_service_account.pubsub_push_invoker.name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

resource "google_cloud_run_v2_service" "api" {
  count    = var.deploy_services && local.deployable_images.api ? 1 : 0
  project  = var.project_id
  name     = "api-service"
  location = var.region

  template {
    service_account = google_service_account.api.email

    scaling {
      min_instance_count = 0
      max_instance_count = 20
    }

    containers {
      image = var.api_image

      ports {
        container_port = 8080
      }

      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }

      env {
        name  = "PUBLIC_BASE_URL"
        value = local.public_base_url
      }

      env {
        name  = "ALLOWED_ORIGINS"
        value = join(",", var.allowed_origins)
      }

      env {
        name  = "SPANNER_INSTANCE"
        value = google_spanner_instance.main.name
      }

      env {
        name  = "SPANNER_DATABASE"
        value = google_spanner_database.main.name
      }

      env {
        name  = "PUBSUB_TOPIC_CLICKS"
        value = google_pubsub_topic.clicks.name
      }

      env {
        name  = "BIGQUERY_DATASET"
        value = google_bigquery_dataset.analytics.dataset_id
      }
    }
  }

  depends_on = [google_spanner_database.main]
}

resource "google_cloud_run_v2_service" "redirect" {
  count    = var.deploy_services && local.deployable_images.redirect ? 1 : 0
  project  = var.project_id
  name     = "redirect-service"
  location = var.region

  template {
    service_account = google_service_account.redirect.email

    scaling {
      min_instance_count = 0
      max_instance_count = 100
    }

    vpc_access {
      connector = google_vpc_access_connector.serverless.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = var.redirect_image

      ports {
        container_port = 8080
      }

      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }

      env {
        name  = "SPANNER_INSTANCE"
        value = google_spanner_instance.main.name
      }

      env {
        name  = "SPANNER_DATABASE"
        value = google_spanner_database.main.name
      }

      env {
        name  = "PUBSUB_TOPIC_CLICKS"
        value = google_pubsub_topic.clicks.name
      }

      env {
        name  = "REDIS_HOST"
        value = google_redis_instance.cache.host
      }

      env {
        name  = "REDIS_PORT"
        value = tostring(google_redis_instance.cache.port)
      }

      env {
        name  = "CACHE_TTL_SECONDS"
        value = "300"
      }
    }
  }

  depends_on = [google_redis_instance.cache]
}

resource "google_cloud_run_v2_service" "worker" {
  count    = var.deploy_services && local.deployable_images.worker ? 1 : 0
  project  = var.project_id
  name     = "events-worker"
  location = var.region

  template {
    service_account = google_service_account.worker.email

    scaling {
      min_instance_count = 0
      max_instance_count = 20
    }

    containers {
      image = var.worker_image

      ports {
        container_port = 8080
      }

      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }

      env {
        name  = "BIGQUERY_DATASET"
        value = google_bigquery_dataset.analytics.dataset_id
      }

      env {
        name  = "BIGQUERY_CLICK_EVENTS_TABLE"
        value = google_bigquery_table.click_events.table_id
      }

      env {
        name  = "BIGQUERY_DAILY_CLICKS_TABLE"
        value = google_bigquery_table.daily_clicks.table_id
      }
    }
  }
}

resource "google_cloud_run_v2_service" "web" {
  count    = var.deploy_services && local.deployable_images.web ? 1 : 0
  project  = var.project_id
  name     = "web-dashboard"
  location = var.region

  template {
    service_account = google_service_account.web.email

    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }

    containers {
      image = var.web_image

      ports {
        container_port = 80
      }
    }
  }
}

resource "google_cloud_run_v2_service_iam_member" "api_public" {
  count    = var.deploy_services && local.deployable_images.api ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api[0].name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "redirect_public" {
  count    = var.deploy_services && local.deployable_images.redirect ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.redirect[0].name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "web_public" {
  count    = var.deploy_services && local.deployable_images.web ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.web[0].name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "worker_pubsub_invoker" {
  count    = var.deploy_services && local.deployable_images.worker ? 1 : 0
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.worker[0].name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.pubsub_push_invoker.email}"
}

resource "google_pubsub_subscription" "clicks_worker_push" {
  count   = var.deploy_services && local.deployable_images.worker ? 1 : 0
  project = var.project_id
  name    = "url-clicks-worker-push"
  topic   = google_pubsub_topic.clicks.name

  ack_deadline_seconds = 20

  push_config {
    push_endpoint = "${google_cloud_run_v2_service.worker[0].uri}/pubsub/push"

    oidc_token {
      service_account_email = google_service_account.pubsub_push_invoker.email
      audience              = google_cloud_run_v2_service.worker[0].uri
    }
  }

  depends_on = [
    google_cloud_run_v2_service_iam_member.worker_pubsub_invoker,
    google_service_account_iam_member.pubsub_push_token_creator
  ]
}
