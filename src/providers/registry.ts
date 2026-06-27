import type { Provider } from "./base.ts";
import type { ProviderName } from "../types.ts";
import { qwenProvider } from "./qwen.ts";
import { kimiProvider } from "./kimi.ts";

const providers: Record<ProviderName, Provider> = {
  qwen: qwenProvider,
  kimi: kimiProvider,
};

export const getProvider = (name: ProviderName): Provider => providers[name];

export const listProviders = (): Provider[] => Object.values(providers);
