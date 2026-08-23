import type { PageId } from "@platform/types";

export type SettingsNavItem = {
  id: PageId;
  label: string;
  icon: string;
  available: boolean;
  placeholder?: boolean;
};

/** صفحات إعدادات تبقى في الكتالوج والصلاحيات — الشجرة في system-settings-nav.ts */
export const SETTINGS_NAV: SettingsNavItem[] = [
  {
    id: "users",
    label: "المستخدمون",
    icon: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    available: true,
  },
  {
    id: "organization-settings",
    label: "بيانات المنشأة",
    icon: "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6",
    available: true,
  },
  {
    id: "clients",
    label: "سجل العملاء",
    icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    available: true,
  },
  {
    id: "attachment-print-dictionary",
    label: "قوائم التقييم",
    icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M12 18v-6M9 15h6",
    available: true,
  },
  {
    id: "difference-factor-catalog",
    label: "تعريفات عوامل الاختلاف",
    icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h4",
    available: true,
  },
  {
    id: "fee-pricing",
    label: "التسعيرة",
    icon: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
    available: true,
  },
  {
    id: "audit-log",
    label: "سجل التدقيق",
    icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8",
    available: true,
  },
];

export const SETTINGS_GROUP = "الإعدادات";

export const SETTINGS_PAGE_IDS: PageId[] = SETTINGS_NAV.map((n) => n.id);
