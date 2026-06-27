import type { FastifyServerOptions } from "fastify";
import { config } from "../config.ts";

const isDev = config.env !== "production";

export const loggerOptions: FastifyServerOptions["logger"] = {
  level: config.server.logLevel,
  base: { service: "roach-router", env: config.env },
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['x-api-key']",
      "headers.authorization",
      "*.apiKey",
      "*.api_key",
    ],
    censor: "[redacted]",
  },
  formatters: {
    level: (label: string) => ({ level: label }),
  },
  serializers: {
    req: (req: { id?: string; method?: string; url?: string; ip?: string }) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      ip: req.ip,
    }),
    res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
  },
  ...(isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:HH:MM:ss.l", singleLine: false, ignore: "pid,hostname,service,env" },
        },
      }
    : {}),
};
