import dotenv from "dotenv";

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 8080),
  projectId: required("GCP_PROJECT_ID", process.env.GOOGLE_CLOUD_PROJECT),
  publicBaseUrl: required("PUBLIC_BASE_URL", "https://example.run.app"),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "*")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
  spannerInstance: required("SPANNER_INSTANCE", "url-shortner-spanner"),
  spannerDatabase: required("SPANNER_DATABASE", "url_shortner"),
  pubsubTopicClicks: required("PUBSUB_TOPIC_CLICKS", "url-clicks"),
  bigQueryDataset: required("BIGQUERY_DATASET", "url_analytics")
};
