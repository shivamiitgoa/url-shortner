export interface UrlItem {
  code: string;
  longUrl: string;
  status: "ACTIVE" | "DISABLED" | "DELETED";
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  redirectType: 301 | 302;
  shortUrl?: string;
}

export interface AnalyticsResponse {
  code: string;
  from: string;
  to: string;
  items: Array<{ date: string; clicks: number }>;
}
