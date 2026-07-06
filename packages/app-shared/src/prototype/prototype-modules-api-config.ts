import { getApiBase, type PrototypeModulesApiConfig } from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";
import { apiErrorMessage } from "./work-orders-api-config";

export function prototypeModulesApiConfig(): PrototypeModulesApiConfig | null {
  const session = getAuthSession();
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
