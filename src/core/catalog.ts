import type { ModelInfo, ProviderName } from "../types.ts";

const SUPPORTED_PARAMETERS = ["tools", "tool_choice", "stream", "max_tokens", "temperature", "top_p", "stop"];

const make = (
  id: string,
  name: string,
  provider: ProviderName,
  upstreamModel: string,
  contextLength: number,
  maxCompletionTokens: number,
  promptPrice: number,
  completionPrice: number,
  description: string,
): ModelInfo => ({
  id,
  name,
  provider,
  upstreamModel,
  contextLength,
  maxCompletionTokens,
  pricing: { prompt: promptPrice, completion: completionPrice },
  description,
  capabilities: { tools: true, streaming: true, vision: false },
  supportedParameters: SUPPORTED_PARAMETERS,
});

const entries: ModelInfo[] = [
  make("qwen-turbo", "Qwen Turbo", "qwen", "qwen-turbo", 1_008_192, 8_192, 0.00020, 0.00060, "Fast Qwen model for high-throughput tasks."),
  make("qwen-plus", "Qwen Plus", "qwen", "qwen-plus", 131_072, 8_192, 0.00040, 0.00120, "Balanced Qwen model for general reasoning and chat."),
  make("qwen-max", "Qwen Max", "qwen", "qwen-max", 32_768, 8_192, 0.00800, 0.02400, "Most capable Qwen flagship model."),
  make("qwen3-coder-plus", "Qwen3 Coder Plus", "qwen", "qwen3-coder-plus", 131_072, 8_192, 0.00100, 0.00300, "Code-specialized Qwen model."),
  make("moonshot-v1-8k", "Kimi Moonshot 8k", "kimi", "moonshot-v1-8k", 8_192, 4_096, 0.00120, 0.00120, "Short-context Kimi model."),
  make("moonshot-v1-32k", "Kimi Moonshot 32k", "kimi", "moonshot-v1-32k", 32_768, 8_192, 0.00240, 0.00240, "Mid-context Kimi model for general chat."),
  make("moonshot-v1-128k", "Kimi Moonshot 128k", "kimi", "moonshot-v1-128k", 131_072, 8_192, 0.00600, 0.00600, "Long-context Kimi model for documents."),
  make("kimi-k2-0711-preview", "Kimi K2", "kimi", "kimi-k2-0711-preview", 131_072, 8_192, 0.00280, 0.00840, "Frontier Kimi K2 reasoning model."),
];

export const CATALOG: ReadonlyMap<string, ModelInfo> = new Map(entries.map((m) => [m.id, m]));

export const ALIASES: Record<string, string | null> = {
  auto: null,
  fast: "qwen-turbo",
  smart: "moonshot-v1-32k",
};

export const findModel = (id: string): ModelInfo | null => CATALOG.get(id) ?? null;

export const listModels = (): ModelInfo[] => Array.from(CATALOG.values());

export const isAlias = (id: string): boolean => id in ALIASES;

export const resolveAliasToModel = (alias: string): string | null => {
  if (!(alias in ALIASES)) return null;
  return ALIASES[alias] ?? null;
};

export const listAliases = (): string[] => Object.keys(ALIASES);
