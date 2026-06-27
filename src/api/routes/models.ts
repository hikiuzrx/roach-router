import type { FastifyInstance } from "fastify";
import { listModels, listAliases, ALIASES, findModel } from "../../core/catalog.ts";
import { cacheGetJson, cacheSetJson } from "../../infra/cache.ts";
import { config } from "../../config.ts";
import type { ModelInfo } from "../../types.ts";

const CACHE_KEY = "router:models:v1";

interface OpenRouterModelEntry {
  id: string;
  name: string;
  created: number;
  description: string;
  context_length: number;
  pricing: { prompt: string; completion: string; request: string; image: string };
  top_provider: { context_length: number; max_completion_tokens: number; is_moderated: boolean };
  architecture: { modality: string; tokenizer: string; instruct_type: string | null };
  supported_parameters: string[];
  owned_by: string;
  object: "model";
}

const toOpenRouterShape = (m: ModelInfo, createdAt: number): OpenRouterModelEntry => ({
  id: m.id,
  name: m.name,
  created: createdAt,
  description: m.description,
  context_length: m.contextLength,
  pricing: {
    prompt: m.pricing.prompt.toFixed(8),
    completion: m.pricing.completion.toFixed(8),
    request: "0",
    image: "0",
  },
  top_provider: {
    context_length: m.contextLength,
    max_completion_tokens: m.maxCompletionTokens,
    is_moderated: false,
  },
  architecture: { modality: "text", tokenizer: m.provider, instruct_type: null },
  supported_parameters: m.supportedParameters,
  owned_by: m.provider,
  object: "model",
});

const aliasEntry = (alias: string, createdAt: number): OpenRouterModelEntry => {
  const target = ALIASES[alias];
  const base = target ? findModel(target) : null;
  const description = target
    ? `Alias for ${target}.`
    : "Alias that routes to the best provider for each request.";
  if (base) {
    return { ...toOpenRouterShape(base, createdAt), id: alias, name: `Router · ${alias}`, description, owned_by: "roach-router" };
  }
  return {
    id: alias,
    name: `Router · ${alias}`,
    created: createdAt,
    description,
    context_length: 131_072,
    pricing: { prompt: "0", completion: "0", request: "0", image: "0" },
    top_provider: { context_length: 131_072, max_completion_tokens: 8192, is_moderated: false },
    architecture: { modality: "text", tokenizer: "router", instruct_type: null },
    supported_parameters: ["tools", "tool_choice", "stream", "max_tokens", "temperature", "top_p", "stop"],
    owned_by: "roach-router",
    object: "model",
  };
};

const buildPayload = () => {
  const createdAt = Math.floor(Date.now() / 1000);
  const aliasModels = listAliases().map((a) => aliasEntry(a, createdAt));
  const catalogModels = listModels().map((m) => toOpenRouterShape(m, createdAt));
  return { object: "list" as const, data: [...aliasModels, ...catalogModels] };
};

export const registerModelsRoute = (app: FastifyInstance): void => {
  app.get("/v1/models", async (req) => {
    const cached = await cacheGetJson<ReturnType<typeof buildPayload>>(CACHE_KEY);
    if (cached) {
      req.log.debug({ component: "models", source: "cache" }, "models served");
      return cached;
    }
    const payload = buildPayload();
    await cacheSetJson(CACHE_KEY, payload, config.cache.modelsTtlSeconds);
    req.log.debug({ component: "models", source: "fresh" }, "models built");
    return payload;
  });
};
