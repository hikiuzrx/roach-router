import type { ChatRequest, ChatResponse, ProviderName } from "../types.ts";
import type { Provider } from "./base.ts";
import { UpstreamError } from "../utils/errors.ts";

export interface OpenAICompatibleConfig {
  name: ProviderName;
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
}

const buildBody = (req: ChatRequest, upstreamModel: string, stream: boolean): string => {
  const { model: _model, stream: _stream, ...rest } = req;
  return JSON.stringify({ ...rest, model: upstreamModel, stream });
};

export class OpenAICompatibleProvider implements Provider {
  readonly name: ProviderName;
  readonly defaultModel: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(cfg: OpenAICompatibleConfig) {
    this.name = cfg.name;
    this.apiKey = cfg.apiKey;
    this.baseUrl = cfg.baseUrl.replace(/\/+$/, "");
    this.defaultModel = cfg.defaultModel;
  }

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  async chat(req: ChatRequest, upstreamModel: string): Promise<ChatResponse> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: buildBody(req, upstreamModel, false),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new UpstreamError(this.name, res.status, text);
    }

    return (await res.json()) as ChatResponse;
  }

  async stream(req: ChatRequest, upstreamModel: string, signal: AbortSignal): Promise<ReadableStream<Uint8Array>> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: buildBody(req, upstreamModel, true),
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new UpstreamError(this.name, res.status, text);
    }
    if (!res.body) {
      throw new UpstreamError(this.name, 502, "");
    }
    return res.body;
  }
}
