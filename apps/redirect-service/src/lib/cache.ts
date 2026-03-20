import Redis from "ioredis";
import { config } from "../config";
import { UrlRecord } from "./types";

const redis = new Redis({
  host: config.redisHost,
  port: config.redisPort,
  password: config.redisPassword || undefined,
  lazyConnect: true,
  maxRetriesPerRequest: 1
});

export async function getCachedUrl(code: string): Promise<UrlRecord | null> {
  const value = await redis.get(`url:${code}`);
  if (!value) {
    return null;
  }

  return JSON.parse(value) as UrlRecord;
}

export async function cacheUrl(record: UrlRecord): Promise<void> {
  await redis.set(`url:${record.code}`, JSON.stringify(record), "EX", config.cacheTtlSeconds);
}

export async function connectCache(): Promise<void> {
  if (redis.status !== "ready") {
    await redis.connect();
  }
}

export async function closeCache(): Promise<void> {
  await redis.quit();
}
