import type { PageId, RoleId } from "@platform/types";

export type ScreenCatalogKind = "page" | "sub-route" | "task-work" | "auth";

/** حالة الشاشة بلغة مفهومة لغير المبرمجين */
export type ScreenCatalogStatus = "جاهزة" | "قيد التطوير";

export type SystemScreenEntry = {
  id: string;
  /** الاسم الظاهر في الدليل */
  name: string;
  /** الرابط التقني (للمطورين) */
  path: string;
  /** أين يجدها المستخدم في النظام — بلغة يومية */
  whereToFind?: string;
  group: string;
  kind: ScreenCatalogKind;
  pageId?: PageId;
  status: ScreenCatalogStatus;
  roles: RoleId[];
  breadcrumb?: string;
  notes?: string;
};

export const SCREEN_CATALOG_KIND_LABELS: Record<ScreenCatalogKind, string> = {
  page: "صفحة في القائمة",
  "sub-route": "خطوة داخل أمر العمل",
  "task-work": "شاشة إنجاز مهمة",
  auth: "تسجيل الدخول",
};

export const SCREEN_CATALOG_STATUS_LABELS: Record<
  ScreenCatalogStatus,
  string
> = {
  جاهزة: "جاهزة للاستخدام",
  "قيد التطوير": "قيد التطوير",
};

/** يحوّل المسار التقني إلى وصف مقروء */
export function humanizeScreenPath(path: string): string {
  return path
    .replace(/\{poNumber\}/g, "رقم أمر العمل")
    .replace(/\{propertyId\}/g, "العقار")
    .replace(/\{taskId\}/g, "المهمة");
}

export function screenCatalogLocationLabel(
  screen: SystemScreenEntry,
): string {
  return screen.whereToFind ?? humanizeScreenPath(screen.path);
}
