import type { ResolvedModel, ModelInfo } from "../types.ts";
import { findModel, isAlias, resolveAliasToModel } from "./catalog.ts";
import { HttpError } from "../utils/errors.ts";

export interface AutoSelection {
  catalogId: string;
  reason: string;
}

const resolveCatalog = (id: string, reason: string): ResolvedModel => {
  const info = findModel(id);
  if (!info) {
    throw new HttpError(500, `Catalog entry missing for '${id}'`, "catalog_misconfigured", "internal_error");
  }
  return {
    catalogId: info.id,
    provider: info.provider,
    upstreamModel: info.upstreamModel,
    info,
    reason,
  };
};

export const resolveModel = (
  requestedModel: string,
  autoSelector: () => AutoSelection,
): ResolvedModel => {
  if (isAlias(requestedModel)) {
    const direct = resolveAliasToModel(requestedModel);
    if (direct !== null) {
      return resolveCatalog(direct, `alias:${requestedModel}`);
    }
    const auto = autoSelector();
    return resolveCatalog(auto.catalogId, `auto:${auto.reason}`);
  }

  const exact = findModel(requestedModel);
  if (exact) {
    return resolveCatalog(exact.id, "explicit");
  }

  throw new HttpError(
    404,
    `Unknown model '${requestedModel}'. Call GET /v1/models for the catalog.`,
    "model_not_found",
    "invalid_request_error",
  );
};

export type { ModelInfo };
