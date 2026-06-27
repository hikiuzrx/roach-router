import type { FastifyInstance } from "fastify";
import { cacheGetJson } from "../../infra/cache.ts";
import { HttpError } from "../../utils/errors.ts";
import type { RequestLog } from "../../types.ts";

export const registerGenerationRoute = (app: FastifyInstance): void => {
  app.get<{ Params: { id: string } }>("/v1/generation/:id", async (req) => {
    const record = await cacheGetJson<RequestLog>(`router:generation:${req.params.id}`);
    if (!record) {
      throw new HttpError(404, `Generation '${req.params.id}' not found or expired`, "not_found", "invalid_request_error");
    }
    return {
      data: {
        id: record.id,
        model: record.resolvedModel,
        provider_name: record.resolvedProvider,
        catalog_id: record.resolvedCatalogId,
        route_reason: record.routeReason,
        latency_ms: record.latencyMs,
        tokens_prompt: record.promptTokens,
        tokens_completion: record.completionTokens,
        tokens_total: record.totalTokens,
        total_cost: record.costUsd,
        streamed: record.stream,
      },
    };
  });
};
