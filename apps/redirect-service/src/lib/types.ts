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

export function isExpired(expiresAt: string | null, now = new Date()): boolean {
  if (!expiresAt) {
    return false;
  }

  return new Date(expiresAt).getTime() <= now.getTime();
}
