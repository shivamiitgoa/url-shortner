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
  spannerInstance: required("SPANNER_INSTANCE", "url-shortner-spanner"),
  spannerDatabase: required("SPANNER_DATABASE", "url_shortner"),
  pubsubTopicClicks: required("PUBSUB_TOPIC_CLICKS", "url-clicks"),
  redisHost: required("REDIS_HOST", "127.0.0.1"),
  redisPort: Number(process.env.REDIS_PORT ?? 6379),
  redisPassword: process.env.REDIS_PASSWORD ?? "",
  cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS ?? 300)
};
