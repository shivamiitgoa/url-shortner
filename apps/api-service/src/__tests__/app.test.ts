import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../index";

describe("api-service", () => {
  it("returns health", async () => {
    const app = createApp();
    const res = await request(app).get("/healthz");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
