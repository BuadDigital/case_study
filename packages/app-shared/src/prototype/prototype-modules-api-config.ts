import { getApiBase, type PrototypeModulesApiConfig } from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";
import { ensureFreshAuthSession } from "../auth/ensure-fresh-session";
import { apiErrorMessage } from "./work-orders-api-config";

export function prototypeModulesApiConfig(): PrototypeModulesApiConfig | null {
  const session = getAuthSession();
  if (!session?.token) return null;
  return { token: session.token, baseUrl: getApiBase() };
}

/** Renew the access token when it is close to expiry — required before attachment uploads. */
export async function freshPrototypeModulesApiConfig(): Promise<PrototypeModulesApiConfig | null> {
  const session = await ensureFreshAuthSession();
  if (!session?.token) return null;
  return { token: session.token, baseUrl: getApiBase() };
}

export function requirePrototypeModulesApiConfig(): PrototypeModulesApiConfig {
  const config = prototypeModulesApiConfig();
  if (!config) throw new Error(apiErrorMessage("auth"));
  return config;
}

export {
  apiErrorMessage,
  resolveApiError,
  unwrapApiResult,
  type ApiResult,
  type MutationResult,
  mutationFromApiResult,
} from "./work-orders-api-config";
