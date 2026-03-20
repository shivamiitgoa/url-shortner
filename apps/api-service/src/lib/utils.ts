import crypto from "node:crypto";

const BASE62_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function generateBase62Code(length = 8): string {
  const bytes = crypto.randomBytes(length);
  let output = "";

  for (let i = 0; i < length; i += 1) {
    output += BASE62_ALPHABET[bytes[i] % BASE62_ALPHABET.length];
  }

  return output;
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
