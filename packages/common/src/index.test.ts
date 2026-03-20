import { describe, expect, it } from "vitest";
import { generateBase62Code, isExpired, normalizeAlias } from "./index";

describe("generateBase62Code", () => {
  it("creates a base62 string of requested length", () => {
    const code = generateBase62Code(8);
    expect(code).toMatch(/^[0-9a-zA-Z]{8}$/);
  });
});

describe("isExpired", () => {
  it("returns false for null", () => {
    expect(isExpired(null)).toBe(false);
  });

  it("returns true when timestamp is in past", () => {
    expect(isExpired("2020-01-01T00:00:00.000Z", new Date("2020-01-02T00:00:00.000Z"))).toBe(true);
  });
});

describe("normalizeAlias", () => {
  it("strips unsupported characters", () => {
    expect(normalizeAlias(" hello@@@-world ")).toBe("hello-world");
  });
});
