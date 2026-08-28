import { getApiBase } from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";

/** إعداد نداءات الـAPI من جلسة الدخول — المصدر الوحيد على مستوى النظام. */
export function apiConfig(): { token: string; baseUrl: string } | null {
  const session = getAuthSession();
  if (!session?.token) return null;
  return { token: session.token, baseUrl: getApiBase() };
}
