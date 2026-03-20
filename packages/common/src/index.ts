import crypto from "node:crypto";

const BASE62_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

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

export interface ClickEvent {
  code: string;
  clickedAt: string;
  ip: string;
  userAgent: string;
  referer: string;
}

export function generateBase62Code(length = 8): string {
  const bytes = crypto.randomBytes(length);
  let output = "";

  for (let i = 0; i < length; i += 1) {
    output += BASE62_ALPHABET[bytes[i] % BASE62_ALPHABET.length];
  }

  return output;
}

export function isExpired(expiresAt: string | null, now = new Date()): boolean {
  if (!expiresAt) {
    return false;
  }

  return new Date(expiresAt).getTime() <= now.getTime();
}

export function isValidHttpUrl(input: string): boolean {
  try {
    const parsed = new URL(input);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeAlias(alias: string): string {
  return alias.trim().replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 32);
}
