import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { chatCompletionsSchema } from "../schemas.ts";
import { getProvider } from "../../providers/registry.ts";
import { resolveModel } from "../../core/resolution.ts";
import { routeRuleBased } from "../../core/router.ts";
import { calculateCost } from "../../core/cost.ts";
import { HttpError } from "../../utils/errors.ts";
import { cacheSetJson } from "../../infra/cache.ts";
import { config } from "../../config.ts";
import type { ChatRequest, ChatResponse, ResolvedModel, RequestLog } from "../../types.ts";

const promptCharCount = (req: ChatRequest): number =>
  req.messages.reduce((sum, m) => sum + (typeof m.content === "string" ? m.content.length : 0), 0);

const pumpStream = async (source: ReadableStream<Uint8Array>, reply: FastifyReply): Promise<void> => {
  const reader = source.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) reply.raw.write(value);
    }
  } finally {
    reader.releaseLock();
    reply.raw.end();
  }
};

const setRoutingHeaders = (reply: FastifyReply, resolved: ResolvedModel, requestId: string): void => {
  reply.header("X-Request-Id", requestId);
  reply.header("X-Router-Provider", resolved.provider);
  reply.header("X-Router-Model", resolved.upstreamModel);
  reply.header("X-Router-Catalog-Id", resolved.catalogId);
  reply.header("X-Router-Reason", resolved.reason);
};

const flushSseHeaders = (reply: FastifyReply): void => {
  reply.raw.setHeader("Content-Type", "text/event-stream");
  reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
  reply.raw.setHeader("Connection", "keep-alive");
  reply.raw.setHeader("X-Accel-Buffering", "no");
  reply.raw.flushHeaders?.();
};

export const registerChatRoute = (app: FastifyInstance): void => {
  app.post("/v1/chat/completions", async (req: FastifyRequest, reply: FastifyReply) => {
    const startedAt = Date.now();
    const requestId = req.id as string;
    const apiKeyId = (req as FastifyRequest & { apiKeyId?: string }).apiKeyId ?? null;

    const parsed = chatCompletionsSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(
        400,
        `Invalid request: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
        "invalid_request",
        "invalid_request_error",
      );
    }

    const body = parsed.data as ChatRequest;
    const promptChars = promptCharCount(body);

    const resolved = resolveModel(body.model, () => routeRuleBased(body));
    const provider = getProvider(resolved.provider);
    const streaming = body.stream === true;

    setRoutingHeaders(reply, resolved, requestId);

    const baseLog = {
      component: "chat",
      requestId,
      apiKeyId,
      requestedModel: body.model,
      catalogId: resolved.catalogId,
      provider: resolved.provider,
      upstreamModel: resolved.upstreamModel,
      reason: resolved.reason,
      stream: streaming,
      promptChars,
    };

    req.log.info(baseLog, "routed");

    if (streaming) {
      const controller = new AbortController();
      reply.raw.once("close", () => {
        if (!reply.raw.writableEnded) controller.abort();
      });

      const upstream = await provider.stream(body, resolved.upstreamModel, controller.signal);

      flushSseHeaders(reply);
      try {
        await pumpStream(upstream, reply);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        req.log.error({ ...baseLog, err: message, latencyMs: Date.now() - startedAt }, "stream interrupted");
        if (!reply.raw.writableEnded) reply.raw.end();
        return reply;
      }

      req.log.info({ ...baseLog, latencyMs: Date.now() - startedAt, status: 200 }, "completed");
      return reply;
    }

    const response: ChatResponse = await provider.chat(body, resolved.upstreamModel);
    const latencyMs = Date.now() - startedAt;
    const costUsd = calculateCost(resolved.info, response.usage);

    reply.header("X-Router-Latency-Ms", String(latencyMs));
    if (costUsd !== null) reply.header("X-Router-Cost-Usd", costUsd.toFixed(6));

    const completionLog: RequestLog = {
      id: response.id ?? requestId,
      requestedModel: body.model,
      resolvedCatalogId: resolved.catalogId,
      resolvedProvider: resolved.provider,
      resolvedModel: resolved.upstreamModel,
      routeReason: resolved.reason,
      stream: false,
      status: 200,
      latencyMs,
      promptTokens: response.usage?.prompt_tokens ?? null,
      completionTokens: response.usage?.completion_tokens ?? null,
      totalTokens: response.usage?.total_tokens ?? null,
      costUsd,
      promptChars,
      error: null,
      clientIp: req.ip ?? null,
      apiKeyId,
    };

    req.log.info({ ...baseLog, latencyMs, status: 200, usage: response.usage, costUsd }, "completed");
    void cacheSetJson(`router:generation:${completionLog.id}`, completionLog, config.cache.generationTtlSeconds);

    return response;
  });
};
