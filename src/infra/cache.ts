import { RedisClient } from "bun";
import { config } from "../config.ts";

let client: RedisClient | null = null;

export const initCache = async (logger: { info: Function; warn: Function; error: Function }): Promise<void> => {
  if (!config.cache.url) {
    logger.warn({ component: "cache" }, "REDIS_URL not set; cache disabled");
    return;
  }

  try {
    const redis = new RedisClient(config.cache.url);
    await redis.connect();
    await redis.set("router:health", "ok");
    client = redis;
    logger.info({ component: "cache" }, "cache connected");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ component: "cache", err: message }, "cache init failed; continuing without cache");
    client = null;
  }
};

export const isCacheReady = (): boolean => client !== null;

export const cacheGetJson = async <T,>(key: string): Promise<T | null> => {
  if (!client) return null;
  try {
    const raw = await client.get(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const cacheSetJson = async (key: string, value: unknown, ttlSeconds: number): Promise<void> => {
  if (!client) return;
  try {
    const payload = JSON.stringify(value);
    await client.set(key, payload, "EX", ttlSeconds);
  } catch {
    /* noop: cache writes are best-effort */
  }
};

export const closeCache = async (): Promise<void> => {
  if (client) {
    client.close();
    client = null;
  }
};
