import { getApiBase } from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";

/** Configure API calls from the login session — sole system-wide source. */
export function apiConfig(): { token: string; baseUrl: string } | null {
  const session = getAuthSession();
  if (!session?.token) return null;
  return { token: session.token, baseUrl: getApiBase() };
}
