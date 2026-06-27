import type { ChatRequest, ChatResponse, ProviderName } from "../types.ts";

export interface StreamChunk {
  data: string;
}

export interface Provider {
  readonly name: ProviderName;
  readonly defaultModel: string;

  chat(req: ChatRequest, upstreamModel: string): Promise<ChatResponse>;
  stream(req: ChatRequest, upstreamModel: string, signal: AbortSignal): Promise<ReadableStream<Uint8Array>>;
}
