import { config } from "../config.ts";
import { OpenAICompatibleProvider } from "./openai-compatible.ts";

export const qwenProvider = new OpenAICompatibleProvider({
  name: "qwen",
  apiKey: config.providers.qwen.apiKey,
  baseUrl: config.providers.qwen.baseUrl,
  defaultModel: config.providers.qwen.defaultModel,
});
