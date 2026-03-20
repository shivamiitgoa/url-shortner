import { describe, expect, it } from "vitest";
import { evaluateRedirect } from "../lib/resolve";
import { UrlRecord } from "../lib/types";

function sample(overrides: Partial<UrlRecord> = {}): UrlRecord {
  return {
    code: "abc12345",
    longUrl: "https://example.com",
    ownerUid: "uid-1",
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: null,
    redirectType: 302,
    ...overrides
  };
}

describe("evaluateRedirect", () => {
  it("rejects missing record", () => {
    expect(evaluateRedirect(null).statusCode).toBe(404);
  });

  it("rejects disabled record", () => {
    expect(evaluateRedirect(sample({ status: "DISABLED" })).statusCode).toBe(410);
  });

  it("allows active record", () => {
    expect(evaluateRedirect(sample()).statusCode).toBe(302);
  });
});
