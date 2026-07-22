import type { PageId } from "@platform/types";
import {
  SYSTEM_FIELDS_GROUP,
  SYSTEM_FIELDS_GROUP_ICON,
  SYSTEM_FIELDS_NAV,
  type SystemFieldsNavItem,
  systemFieldsNavForRole,
} from "./system-fields-nav";
import { SETTINGS_NAV, SETTINGS_PAGE_IDS } from "./settings-nav";
import { SYSTEM_FIELDS_CATALOG_NAV_ITEM } from "./system-fields-catalog-nav";
import { SYSTEM_SCREEN_CATALOG_NAV_ITEM } from "./system-screen-catalog-nav";

export type SystemSettingsNavItem = {
  id: PageId;
  label: string;
  icon: string;
};

/** العناصر الأساسية تحت إعدادات النظام (تحت عام) */
export const SYSTEM_SETTINGS_PRIMARY_NAV: SystemSettingsNavItem[] = [
  {
    id: "valuation-requests",
    label: "طلبات التقييم",
    icon: "M9 11l3 3L22 4",
  },
  {
    id: "financial",
    label: "التقارير المالية",
    icon: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  },
  {
    id: SYSTEM_FIELDS_CATALOG_NAV_ITEM.id,
    label: SYSTEM_FIELDS_CATALOG_NAV_ITEM.label,
    icon: SYSTEM_FIELDS_CATALOG_NAV_ITEM.icon,
  },
  {
    id: SYSTEM_SCREEN_CATALOG_NAV_ITEM.id,
    label: SYSTEM_SCREEN_CATALOG_NAV_ITEM.label,
    icon: SYSTEM_SCREEN_CATALOG_NAV_ITEM.icon,
  },
  {
    id: "party-fees",
    label: "الأتعاب والصرف",
    icon: "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  },
  ...SETTINGS_NAV.map((item) => ({
    id: item.id,
    label: item.label,
    icon: item.icon,
  })),
];

export const SYSTEM_SETTINGS_GROUP = "إعدادات النظام";

export const SYSTEM_SETTINGS_GROUP_ICON =
  "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z";

export {
  SYSTEM_FIELDS_GROUP,
  SYSTEM_FIELDS_GROUP_ICON,
  type SystemFieldsNavItem,
};

export const SYSTEM_SETTINGS_PRIMARY_PAGE_IDS: PageId[] =
  SYSTEM_SETTINGS_PRIMARY_NAV.map((n) => n.id);

export function systemSettingsPrimaryNavForRole(
  rolePages: PageId[],
): SystemSettingsNavItem[] {
  return SYSTEM_SETTINGS_PRIMARY_NAV.filter((item) =>
    rolePages.includes(item.id),
  );
}

export function systemSettingsFieldsNavForRole(
  rolePages: PageId[],
): SystemFieldsNavItem[] {
  return systemFieldsNavForRole(rolePages).filter((item) => item.available);
}

export function isInSystemSettingsSection(page: PageId): boolean {
  return (
    SYSTEM_SETTINGS_PRIMARY_PAGE_IDS.includes(page) ||
    SYSTEM_FIELDS_NAV.some((n) => n.id === page) ||
    SETTINGS_PAGE_IDS.includes(page)
  );
}

/** يظهر قسم عام إذا وُجدت أي إعدادات نظام متاحة. */
export function showSystemSettingsGroup(rolePages: PageId[]): boolean {
  return (
    systemSettingsPrimaryNavForRole(rolePages).length > 0 ||
    systemSettingsFieldsNavForRole(rolePages).length > 0
  );
}
