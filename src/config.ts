const required = (name: string): string => {
  const value = process.env[name];
  if (!value || value.length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
};

const optional = (name: string, fallback: string): string => {
  const value = process.env[name];
  return value && value.length > 0 ? value : fallback;
};

const optionalNullable = (name: string): string | null => {
  const value = process.env[name];
  return value && value.length > 0 ? value : null;
};

const parseList = (raw: string | null): string[] =>
  raw === null ? [] : raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);

export const config = {
  env: optional("NODE_ENV", "production"),
  server: {
    host: optional("HOST", "0.0.0.0"),
    port: Number(optional("PORT", "3000")),
    logLevel: optional("LOG_LEVEL", "info"),
    bodyLimitBytes: Number(optional("BODY_LIMIT_BYTES", String(10 * 1024 * 1024))),
  },
  auth: {
    apiKeys: parseList(optionalNullable("ROUTER_API_KEYS")),
  },
  providers: {
    qwen: {
      apiKey: required("QWEN_API"),
      baseUrl: optional("QWEN_BASE_URL", "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"),
      defaultModel: optional("QWEN_DEFAULT_MODEL", "qwen-plus"),
    },
    kimi: {
      apiKey: required("KIMI_API"),
      baseUrl: optional("KIMI_BASE_URL", "https://api.moonshot.ai/v1"),
      defaultModel: optional("KIMI_DEFAULT_MODEL", "moonshot-v1-32k"),
    },
  },
  cache: {
    url: optionalNullable("REDIS_URL"),
    modelsTtlSeconds: Number(optional("MODELS_CACHE_TTL_SECONDS", "60")),
    generationTtlSeconds: Number(optional("GENERATION_CACHE_TTL_SECONDS", "3600")),
  },
} as const;

export type Config = typeof config;
