import Fastify, { type FastifyInstance } from "fastify";
import { config } from "./config.ts";
import { loggerOptions } from "./infra/logger.ts";
import { initCache, isCacheReady, closeCache } from "./infra/cache.ts";
import { registerChatRoute } from "./api/routes/chat.ts";
import { registerModelsRoute } from "./api/routes/models.ts";
import { registerGenerationRoute } from "./api/routes/generation.ts";
import { registerAuth } from "./api/middleware/auth.ts";
import { HttpError } from "./utils/errors.ts";

export const buildServer = async (): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: loggerOptions,
    bodyLimit: config.server.bodyLimitBytes,
    disableRequestLogging: false,
    trustProxy: true,
    genReqId: () => crypto.randomUUID(),
  });

  await initCache(app.log);

  app.get("/health", async () => ({ status: "ok" }));
  app.get("/ready", async () => ({
    status: "ok",
    cache: isCacheReady() ? "connected" : "disabled",
  }));

  registerAuth(app);
  registerModelsRoute(app);
  registerGenerationRoute(app);
  registerChatRoute(app);

  app.addHook("onResponse", async (req, reply) => {
    req.log.info(
      {
        component: "http",
        requestId: req.id,
        method: req.method,
        url: req.url,
        status: reply.statusCode,
        elapsedMs: reply.elapsedTime,
      },
      "request finished",
    );
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof HttpError) {
      req.log.warn({ component: "http", requestId: req.id, status: err.statusCode, err: err.message }, "http error");
      return reply.status(err.statusCode).send(err.toOpenAI());
    }
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    req.log.error({ component: "http", requestId: req.id, err: message, stack }, "unhandled error");
    return reply.status(500).send({
      error: { message: message || "Internal server error", type: "internal_error", code: "internal_error" },
    });
  });

  app.addHook("onClose", async () => {
    await closeCache();
  });

  return app;
};
