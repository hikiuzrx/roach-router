import type { ModelInfo, Usage } from "../types.ts";

export const calculateCost = (model: ModelInfo, usage: Usage | null | undefined): number | null => {
  if (!usage) return null;
  const promptCost = (usage.prompt_tokens / 1000) * model.pricing.prompt;
  const completionCost = (usage.completion_tokens / 1000) * model.pricing.completion;
  return Number((promptCost + completionCost).toFixed(6));
};
