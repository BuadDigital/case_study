import type { PageId } from "@platform/types";

export type SystemFieldsNavItem = {
  id: PageId;
  label: string;
  icon: string;
  available: boolean;
  placeholder?: boolean;
};

/** جميع حقول النظام — مرجع الحقول والأدوات */
export const SYSTEM_FIELDS_NAV: SystemFieldsNavItem[] = [
  {
    id: "case-study-info-roles",
    label: "علاقة المستخدم بالمعلومة",
    icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0zM22 12h-4l-3 9L9 3l-3 9H2",
    available: true,
  },
  {
    id: "courts",
    label: "المحاكم و الدوائر",
    icon: "M3 21h18M5 21V7l8-4 8 4v14M9 21v-6h6v6",
    available: true,
  },
  {
    id: "failure-types",
    label: "أنواع التعذرات",
    icon: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z",
    available: true,
  },
];

export const SYSTEM_FIELDS_GROUP = "جميع حقول النظام";

export const SYSTEM_FIELDS_GROUP_ICON =
  "M4 6h16M4 10h16M4 14h16M4 18h16";

export const SYSTEM_FIELDS_PAGE_IDS: PageId[] = SYSTEM_FIELDS_NAV.map(
  (n) => n.id,
);

export function systemFieldsNavForRole(
  rolePages: PageId[],
): SystemFieldsNavItem[] {
  return SYSTEM_FIELDS_NAV.map((item) => ({
    ...item,
    available: rolePages.includes(item.id),
  }));
}

export function isInSystemFieldsSection(page: PageId): boolean {
  return SYSTEM_FIELDS_PAGE_IDS.includes(page);
}