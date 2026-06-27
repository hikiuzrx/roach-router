import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { config } from "../../config.ts";
import { HttpError } from "../../utils/errors.ts";

const PROTECTED_PREFIX = "/v1/";

const fingerprint = (key: string): string => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return `k_${(h >>> 0).toString(16)}`;
};

const KEY_FINGERPRINTS = new Map<string, string>(config.auth.apiKeys.map((k) => [k, fingerprint(k)]));

export const registerAuth = (app: FastifyInstance): void => {
  if (config.auth.apiKeys.length === 0) {
    app.log.warn({ component: "auth" }, "ROUTER_API_KEYS empty; gateway is unauthenticated");
    return;
  }

  app.addHook("onRequest", async (req: FastifyRequest, _reply: FastifyReply) => {
    if (!req.url.startsWith(PROTECTED_PREFIX)) return;

    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new HttpError(401, "Missing bearer token", "missing_authorization", "authentication_error");
    }
    const token = header.slice("Bearer ".length).trim();
    const id = KEY_FINGERPRINTS.get(token);
    if (!id) {
      throw new HttpError(401, "Invalid API key", "invalid_api_key", "authentication_error");
    }
    (req as FastifyRequest & { apiKeyId?: string }).apiKeyId = id;
  });
};
