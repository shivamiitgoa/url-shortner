import { BigQuery } from "@google-cloud/bigquery";
import { config } from "../config";

const bigQuery = new BigQuery({ projectId: config.projectId });

export interface ClickMessage {
  code: string;
  clickedAt: string;
  ip: string;
  userAgent: string;
  referer: string;
}

function dateFromTimestamp(timestamp: string): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export async function writeClick(message: ClickMessage): Promise<void> {
  const dataset = bigQuery.dataset(config.bigQueryDataset);
  const eventsTable = dataset.table(config.clickEventsTable);
  const dailyTable = dataset.table(config.dailyClicksTable);

  const clickedAt = message.clickedAt || new Date().toISOString();
  const date = dateFromTimestamp(clickedAt);

  await Promise.all([
    eventsTable.insert([
      {
        code: message.code,
        clicked_at: clickedAt,
        event_date: date,
        ip: message.ip,
        user_agent: message.userAgent,
        referer: message.referer,
        ingested_at: new Date().toISOString()
      }
    ]),
    dailyTable.insert([
      {
        code: message.code,
        event_date: date,
        clicks: 1,
        ingested_at: new Date().toISOString()
      }
    ])
  ]);
}
