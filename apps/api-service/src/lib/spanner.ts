import { Database, Spanner } from "@google-cloud/spanner";
import { config } from "../config";

export type UrlStatus = "ACTIVE" | "DISABLED" | "DELETED";

export interface UrlRecord {
  code: string;
  longUrl: string;
  ownerUid: string;
  status: UrlStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  redirectType: 301 | 302;
}

export interface CreateUrlInput {
  code: string;
  longUrl: string;
  ownerUid: string;
  expiresAt: string | null;
  redirectType: 301 | 302;
}

export interface UpdateUrlInput {
  status?: UrlStatus;
  expiresAt?: string | null;
  redirectType?: 301 | 302;
}

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

function isAlreadyExistsError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeCode = (error as { code?: number }).code;
  return maybeCode === 6;
}

export class CollisionError extends Error {
  constructor(message = "Code already exists") {
    super(message);
    this.name = "CollisionError";
  }
}

export class UrlRepository {
  private readonly db: Database;

  constructor(db = database) {
    this.db = db;
  }

  async createUrl(input: CreateUrlInput): Promise<UrlRecord> {
    const now = new Date().toISOString();

    try {
      await this.db.table("Urls").insert({
        code: input.code,
        long_url: input.longUrl,
        owner_uid: input.ownerUid,
        status: "ACTIVE",
        created_at: now,
        updated_at: now,
        expires_at: input.expiresAt,
        redirect_type: input.redirectType
      });
    } catch (error) {
      if (isAlreadyExistsError(error)) {
        throw new CollisionError();
      }
      throw error;
    }

    const created = await this.getByCode(input.code);
    if (!created) {
      throw new Error("URL created but not found");
    }

    return created;
  }

  async getByCode(code: string): Promise<UrlRecord | null> {
    const query = {
      sql: `
        SELECT code, long_url, owner_uid, status, created_at, updated_at, expires_at, redirect_type
        FROM Urls
        WHERE code = @code
        LIMIT 1
      `,
      params: { code }
    };

    const [rows] = await this.db.run(query);
    if (rows.length === 0) {
      return null;
    }

    return mapRow(rows[0]);
  }

  async listByOwner(ownerUid: string, limit = 100): Promise<UrlRecord[]> {
    const query = {
      sql: `
        SELECT code, long_url, owner_uid, status, created_at, updated_at, expires_at, redirect_type
        FROM Urls@{FORCE_INDEX=UrlsByOwnerCreatedAt}
        WHERE owner_uid = @ownerUid
        ORDER BY created_at DESC
        LIMIT @limit
      `,
      params: { ownerUid, limit }
    };

    const [rows] = await this.db.run(query);
    return rows.map(mapRow);
  }

  async updateByOwner(ownerUid: string, code: string, input: UpdateUrlInput): Promise<UrlRecord | null> {
    const existing = await this.getByCode(code);
    if (!existing || existing.ownerUid !== ownerUid || existing.status === "DELETED") {
      return null;
    }

    const nextStatus = input.status ?? existing.status;
    const nextExpiresAt = input.expiresAt === undefined ? existing.expiresAt : input.expiresAt;
    const nextRedirectType = input.redirectType ?? existing.redirectType;

    await this.db.run({
      sql: `
        UPDATE Urls
        SET status = @status, expires_at = @expiresAt, redirect_type = @redirectType, updated_at = @updatedAt
        WHERE code = @code
      `,
      params: {
        code,
        status: nextStatus,
        expiresAt: nextExpiresAt,
        redirectType: nextRedirectType,
        updatedAt: new Date().toISOString()
      }
    });

    return this.getByCode(code);
  }

  async softDeleteByOwner(ownerUid: string, code: string): Promise<boolean> {
    const updated = await this.updateByOwner(ownerUid, code, { status: "DELETED" });
    return updated !== null;
  }

  async close(): Promise<void> {
    await this.db.close();
    await spanner.close();
  }
}
