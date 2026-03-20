import { isExpired, UrlRecord } from "./types";

export interface ResolveResult {
  allowed: boolean;
  statusCode: number;
  reason?: string;
}

export function evaluateRedirect(record: UrlRecord | null): ResolveResult {
  if (!record) {
    return { allowed: false, statusCode: 404, reason: "not_found" };
  }

  if (record.status !== "ACTIVE") {
    return { allowed: false, statusCode: 410, reason: "inactive" };
  }

  if (isExpired(record.expiresAt)) {
    return { allowed: false, statusCode: 410, reason: "expired" };
  }

  return { allowed: true, statusCode: record.redirectType };
}
