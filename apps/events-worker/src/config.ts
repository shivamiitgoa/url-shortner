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
  bigQueryDataset: required("BIGQUERY_DATASET", "url_analytics"),
  clickEventsTable: required("BIGQUERY_CLICK_EVENTS_TABLE", "click_events"),
  dailyClicksTable: required("BIGQUERY_DAILY_CLICKS_TABLE", "daily_clicks")
};
