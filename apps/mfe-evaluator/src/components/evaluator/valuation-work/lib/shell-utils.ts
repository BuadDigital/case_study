import { getApiBase } from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";

export function apiConfig() {
  const session = getAuthSession();
  if (!session?.token) return null;
  return { token: session.token, baseUrl: getApiBase() };
}

// toLocaleString ينشئ Intl.NumberFormat في كل نداء — الشاشات تنادي fmt لعشرات
// الخلايا مع كل رسم، فنبقي منسّقاً واحداً لكل عدد كسور.
const NUM_FORMATS = new Map<number, Intl.NumberFormat>();

export function fmt(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return "—";
  // أرقام لاتينية موحّدة مع بقية النظام (بطاقة العقار، جدول التسويات، التقارير).
  let formatter = NUM_FORMATS.get(digits);
  if (!formatter) {
    formatter = new Intl.NumberFormat("en-US", {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits > 0 ? Math.min(digits, 2) : 0,
    });
    NUM_FORMATS.set(digits, formatter);
  }
  return formatter.format(n);
}

/** ق-8-2: الحد الأدنى لطول المبرر — يطابق JustificationRules.MinLength في الخادم. */
export const JUSTIFICATION_MIN_LENGTH = 10;
