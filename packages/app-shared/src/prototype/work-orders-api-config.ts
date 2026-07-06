import { getApiBase, type WorkOrdersApiConfig } from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";

export const WORK_ORDERS_CHANGED_EVENT = "work-orders-changed";

export function notifyWorkOrdersChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(WORK_ORDERS_CHANGED_EVENT));
  }
}

export function workOrdersApiConfig(): WorkOrdersApiConfig | null {
  const session = getAuthSession();
  if (!session?.token) return null;
  return { token: session.token, baseUrl: getApiBase() };
}

/** First non-empty message from a field error (string or ASP.NET string[]). */
function errorMessage(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const msg = errorMessage(item);
      if (msg) return msg;
    }
  }
  return undefined;
}

/** First server validation message, if any. */
export function firstApiFieldError(
  errors?: Record<string, unknown>,
): string | undefined {
  if (!errors) return undefined;
  const general = errorMessage(errors._);
  if (general) return general;
  for (const value of Object.values(errors)) {
    const msg = errorMessage(value);
    if (msg) return msg;
  }
  return undefined;
}

export function apiErrorMessage(
  kind: string,
  fallback = "تعذّر الاتصال بالخادم",
): string {
  if (kind === "auth") return "يجب تسجيل الدخول أولاً";
  if (kind === "network") return "تعذّر الاتصال بالخادم — تحقق من تشغيل API";
  if (kind === "validation") return "يرجى مراجعة الحقول المطلوبة";
  if (kind === "server") return "حدث خطأ في الخادم — حاول لاحقاً";
  if (kind === "not_found") return "لم يُعثر على أمر العمل";
  return fallback;
}

export function resolveApiError(
  kind: string,
  errors?: Record<string, unknown>,
  fallback?: string,
): string {
  return firstApiFieldError(errors) ?? apiErrorMessage(kind, fallback);
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: string; errors?: Record<string, unknown> };

export function requireWorkOrdersApiConfig(): WorkOrdersApiConfig {
  const config = workOrdersApiConfig();
  if (!config) throw new Error(apiErrorMessage("auth"));
  return config;
}

export function unwrapApiResult<T>(result: ApiResult<T>, fallback: string): T {
  if (result.ok) return result.data;
  throw new Error(resolveApiError(result.kind, result.errors, fallback));
}

export type MutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function mutationFromApiResult<T>(
  result: ApiResult<T>,
  fallback: string,
): MutationResult<T> {
  if (result.ok) return { ok: true, data: result.data };
  return {
    ok: false,
    error: resolveApiError(result.kind, result.errors, fallback),
  };
}
