import {
  getApiBase,
  type CaseStudyInfoRolesApiConfig,
  type CourtsApiConfig,
  type RegionsApiConfig,
} from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";

export function courtsApiConfig(): CourtsApiConfig | null {
  const session = getAuthSession();
  if (!session?.token) return null;
  return { token: session.token, baseUrl: getApiBase() };
}

export function regionsApiConfig(): RegionsApiConfig | null {
  const session = getAuthSession();
  if (!session?.token) return null;
  return { token: session.token, baseUrl: getApiBase() };
}

export function caseStudyInfoRolesApiConfig(): CaseStudyInfoRolesApiConfig | null {
  const session = getAuthSession();
  if (!session?.token) return null;
  return { token: session.token, baseUrl: getApiBase() };
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
