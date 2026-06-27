import type { ChatRequest } from "../types.ts";

const CODE_HINTS: RegExp[] = [
  /```/,
  /\bfunction\s+\w+\s*\(/,
  /\bclass\s+\w+/,
  /\bimport\s+/,
  /\bdef\s+\w+\(/,
  /\bconst\s+\w+\s*=/,
  /\bSELECT\b[\s\S]+\bFROM\b/i,
  /\b(typescript|javascript|python|rust|golang|java|c\+\+|kotlin|swift)\b/i,
];

const LONG_CONTEXT_THRESHOLD_CHARS = 8_000;
const VERY_LONG_CONTEXT_THRESHOLD_CHARS = 50_000;

const totalChars = (req: ChatRequest): number =>
  req.messages.reduce((sum, m) => sum + (typeof m.content === "string" ? m.content.length : 0), 0);

const looksLikeCode = (req: ChatRequest): boolean => {
  for (const m of req.messages) {
    if (typeof m.content !== "string") continue;
    if (CODE_HINTS.some((re) => re.test(m.content as string))) return true;
  }
  return false;
};

export interface AutoDecision {
  catalogId: string;
  reason: string;
}

export const routeRuleBased = (req: ChatRequest): AutoDecision => {
  const chars = totalChars(req);

  if (chars >= VERY_LONG_CONTEXT_THRESHOLD_CHARS) {
    return { catalogId: "moonshot-v1-128k", reason: `very_long_context:${chars}` };
  }

  if (looksLikeCode(req)) {
    return { catalogId: "qwen3-coder-plus", reason: "code_detected" };
  }

  if (chars >= LONG_CONTEXT_THRESHOLD_CHARS) {
    return { catalogId: "moonshot-v1-32k", reason: `long_context:${chars}` };
  }

  return { catalogId: "moonshot-v1-32k", reason: "default" };
};
