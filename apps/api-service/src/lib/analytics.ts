import { BigQuery } from "@google-cloud/bigquery";
import { config } from "../config";

const bigQuery = new BigQuery({ projectId: config.projectId });

export interface AnalyticsPoint {
  date: string;
  clicks: number;
}

export async function fetchDailyAnalytics(code: string, from: string, to: string): Promise<AnalyticsPoint[]> {
  const query = `
    SELECT event_date AS date, SUM(clicks) AS clicks
    FROM \`${config.projectId}.${config.bigQueryDataset}.daily_clicks\`
    WHERE code = @code
      AND event_date BETWEEN @fromDate AND @toDate
    GROUP BY date
    ORDER BY date
  `;

  const [rows] = await bigQuery.query({
    query,
    params: {
      code,
      fromDate: from,
      toDate: to
    },
    useLegacySql: false
  });

  return rows.map((row) => ({
    date: String((row as Record<string, unknown>).date),
    clicks: Number((row as Record<string, unknown>).clicks)
  }));
}
