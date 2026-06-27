export type Role = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: Role;
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export type ToolChoice =
  | "auto"
  | "none"
  | "required"
  | { type: "function"; function: { name: string } };

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  stop?: string | string[];
  tools?: ToolDefinition[];
  tool_choice?: ToolChoice;
  user?: string;
  [key: string]: unknown;
}

export interface ChatChoice {
  index: number;
  message: ChatMessage;
  finish_reason: string | null;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ChatResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: ChatChoice[];
  usage?: Usage;
}

export type ProviderName = "qwen" | "kimi";

export interface ModelInfo {
  id: string;
  name: string;
  provider: ProviderName;
  upstreamModel: string;
  contextLength: number;
  maxCompletionTokens: number;
  pricing: { prompt: number; completion: number };
  description: string;
  capabilities: { tools: boolean; streaming: boolean; vision: boolean };
  supportedParameters: string[];
}

export interface ResolvedModel {
  catalogId: string;
  provider: ProviderName;
  upstreamModel: string;
  info: ModelInfo;
  reason: string;
}

export interface RequestLog {
  id: string;
  requestedModel: string;
  resolvedCatalogId: string;
  resolvedProvider: ProviderName;
  resolvedModel: string;
  routeReason: string;
  stream: boolean;
  status: number;
  latencyMs: number;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  costUsd: number | null;
  promptChars: number;
  error: string | null;
  clientIp: string | null;
  apiKeyId: string | null;
}
