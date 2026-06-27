import { config } from "../config.ts";
import { OpenAICompatibleProvider } from "./openai-compatible.ts";

export const kimiProvider = new OpenAICompatibleProvider({
  name: "kimi",
  apiKey: config.providers.kimi.apiKey,
  baseUrl: config.providers.kimi.baseUrl,
  defaultModel: config.providers.kimi.defaultModel,
});
