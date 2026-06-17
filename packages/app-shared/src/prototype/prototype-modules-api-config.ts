import { getApiBase, type PrototypeModulesApiConfig } from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";

export function prototypeModulesApiConfig(): PrototypeModulesApiConfig | null {
  const session = getAuthSession();
  if (!session?.token) return null;
  return { token: session.token, baseUrl: getApiBase() };
}
