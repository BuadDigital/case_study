import type { PageId, RoleId } from "@platform/types";

export type ScreenCatalogKind = "page" | "sub-route" | "task-work" | "auth";

/** Screen status in plain language for non-developers */
export type ScreenCatalogStatus = "جاهزة" | "قيد التطوير";

export type SystemScreenEntry = {
  id: string;
  /** Display name in the catalog */
  name: string;
  /** Technical path (for developers) */
  path: string;
  /** Where the user finds it in the product — everyday wording */
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

/** Turns a technical path into a readable description */
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
