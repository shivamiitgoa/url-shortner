import { Spanner } from "@google-cloud/spanner";
import { config } from "../config";
import { UrlRecord, UrlStatus } from "./types";

const spanner = new Spanner({ projectId: config.projectId });
const instance = spanner.instance(config.spannerInstance);
const database = instance.database(config.spannerDatabase);

function mapRow(row: any): UrlRecord {
  const json = row.toJSON() as Record<string, unknown>;

  return {
    code: String(json.code),
    longUrl: String(json.long_url),
    ownerUid: String(json.owner_uid),
    status: json.status as UrlStatus,
    createdAt: String(json.created_at),
    updatedAt: String(json.updated_at),
    expiresAt: json.expires_at ? String(json.expires_at) : null,
    redirectType: Number(json.redirect_type) as 301 | 302
  };
}

export async function getUrlByCode(code: string): Promise<UrlRecord | null> {
  const [rows] = await database.run({
    sql: `
      SELECT code, long_url, owner_uid, status, created_at, updated_at, expires_at, redirect_type
      FROM Urls
      WHERE code = @code
      LIMIT 1
    `,
    params: { code }
  });

  if (rows.length === 0) {
    return null;
  }

  return mapRow(rows[0]);
}

export async function closeSpanner(): Promise<void> {
  await database.close();
  await spanner.close();
}
