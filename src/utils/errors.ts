export interface OpenAIErrorEnvelope {
  error: {
    message: string;
    type: string;
    code: string;
    param?: string | null;
  };
}

export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly type: string;

  constructor(statusCode: number, message: string, code = "router_error", type = "invalid_request_error") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.type = type;
  }

  toOpenAI(): OpenAIErrorEnvelope {
    return { error: { message: this.message, type: this.type, code: this.code } };
  }
}

const ACCOUNT_ID_PATTERN = /(?:ak|sk|org)-[a-z0-9._-]{6,}/gi;

const sanitizeMessage = (raw: string): string => raw.replace(ACCOUNT_ID_PATTERN, "[redacted-id]");

export class UpstreamError extends HttpError {
  readonly providerName: string;
  readonly envelope: OpenAIErrorEnvelope;

  constructor(providerName: string, statusCode: number, upstreamBody: string) {
    let envelope: OpenAIErrorEnvelope | null = null;
    try {
      const parsed = JSON.parse(upstreamBody) as { error?: Partial<OpenAIErrorEnvelope["error"]> };
      if (parsed && typeof parsed.error === "object" && parsed.error !== null) {
        envelope = {
          error: {
            message: sanitizeMessage(parsed.error.message ?? "Upstream error"),
            type: parsed.error.type ?? "upstream_error",
            code: parsed.error.code ?? "upstream_error",
          },
        };
      }
    } catch {
      /* fall through to generic envelope */
    }

    if (!envelope) {
      envelope = {
        error: {
          message: `Provider '${providerName}' returned ${statusCode}`,
          type: "upstream_error",
          code: "upstream_error",
        },
      };
    }

    super(statusCode, envelope.error.message, envelope.error.code, envelope.error.type);
    this.providerName = providerName;
    this.envelope = envelope;
  }

  override toOpenAI(): OpenAIErrorEnvelope {
    return this.envelope;
  }
}
