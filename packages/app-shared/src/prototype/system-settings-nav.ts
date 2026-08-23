import type { PageId, RoleId } from "@platform/types";
import {
  SYSTEM_FIELDS_GROUP,
  SYSTEM_FIELDS_GROUP_ICON,
  SYSTEM_FIELDS_NAV,
  type SystemFieldsNavItem,
  systemFieldsNavForRole,
} from "./system-fields-nav";
import { SYSTEM_FIELDS_CATALOG_NAV_ITEM } from "./system-fields-catalog-nav";
import { SYSTEM_SCREEN_CATALOG_NAV_ITEM } from "./system-screen-catalog-nav";

export type SystemSettingsNavItem = {
  id: PageId;
  /** Unique within the settings tree (several leaves can share one page). */
  navKey: string;
  label: string;
  icon: string;
  href: string;
};

export type SettingsNavTreeNode =
  | { type: "group"; id: string; label: string; items: SystemSettingsNavItem[] }
  | { type: "item"; item: SystemSettingsNavItem }
  | { type: "divider" };

function leaf(
  navKey: string,
  id: PageId,
  label: string,
  icon: string,
  href?: string,
): SystemSettingsNavItem {
  return { navKey, id, label, icon, href: href ?? `/${id}` };
}

const ORG_HREF = (tab: string) => `/organization-settings?tab=${tab}`;

/** عنوان الشريط العلوي حسب تبويب `/organization-settings?tab=` */
export function organizationSettingsLeafTitle(tab: string | null | undefined): string {
  if (tab === "evaluator") return "المقيّمون";
  if (tab === "branding") return "الهوية البصرية";
  if (tab === "report") return "تقرير التقييم المهني";
  if (tab === "communications") return "الاتصالات";
  if (tab === "sla") return "معايير المهل";
  return "بيانات المنشأة";
}

const ORG_ICON =
  "M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6";
const USERS_ICON =
  "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z";
const PRICING_ICON =
  "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6";
const AUDIT_ICON =
  "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8";
const REPORT_ICON =
  "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8";
const LISTS_ICON =
  "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M12 18v-6M9 15h6";
const BRAND_ICON =
  "M4 16l4.6-4.6a2 2 0 0 1 2.8 0L16 16m-2-2 1.6-1.6a2 2 0 0 1 2.8 0L20 14M14 8h.01M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z";

/** شجرة الإعدادات v2 — المصدر: docs/_إعدادات النظام/الإعدادات v2.dc.html `TREE` */
export const SYSTEM_SETTINGS_TREE: SettingsNavTreeNode[] = [
  {
    type: "group",
    id: "fields",
    label: "الحقول والمصطلحات",
    items: [
      leaf(
        "fields-catalog",
        SYSTEM_FIELDS_CATALOG_NAV_ITEM.id,
        SYSTEM_FIELDS_CATALOG_NAV_ITEM.label,
        SYSTEM_FIELDS_CATALOG_NAV_ITEM.icon,
      ),
      leaf(
        "screen-catalog",
        SYSTEM_SCREEN_CATALOG_NAV_ITEM.id,
        SYSTEM_SCREEN_CATALOG_NAV_ITEM.label,
        SYSTEM_SCREEN_CATALOG_NAV_ITEM.icon,
      ),
    ],
  },
  {
    type: "group",
    id: "org",
    label: "المنشأة",
    items: [
      leaf("org-data", "organization-settings", "بيانات المنشأة", ORG_ICON, ORG_HREF("company")),
      leaf("valuers", "organization-settings", "المقيّمون", USERS_ICON, ORG_HREF("evaluator")),
      leaf("brand", "organization-settings", "الهوية البصرية", BRAND_ICON, ORG_HREF("branding")),
    ],
  },
  {
    type: "group",
    id: "cs",
    label: "دراسة الحالة",
    items: SYSTEM_FIELDS_NAV.map((n) => leaf(n.id, n.id, n.label, n.icon)),
  },
  {
    type: "group",
    id: "val",
    label: "التقييم العقاري",
    items: [
      leaf(
        "pro-report",
        "organization-settings",
        "تقرير التقييم المهني",
        REPORT_ICON,
        ORG_HREF("report"),
      ),
      leaf(
        "purposes",
        "attachment-print-dictionary",
        "قوائم التقييم",
        LISTS_ICON,
      ),
    ],
  },
  {
    type: "group",
    id: "other",
    label: "أخرى",
    items: [
      leaf("users", "users", "المستخدمون", USERS_ICON),
      leaf("fee-pricing", "fee-pricing", "التسعيرة", PRICING_ICON),
      leaf("audit-log", "audit-log", "سجل التدقيق", AUDIT_ICON),
    ],
  },
];

function treeLeaves(nodes: SettingsNavTreeNode[]): SystemSettingsNavItem[] {
  const out: SystemSettingsNavItem[] = [];
  for (const node of nodes) {
    if (node.type === "item") out.push(node.item);
    if (node.type === "group") out.push(...node.items);
  }
  return out;
}

export const SYSTEM_SETTINGS_PRIMARY_NAV: SystemSettingsNavItem[] = treeLeaves(
  SYSTEM_SETTINGS_TREE,
);

export const SYSTEM_SETTINGS_GROUP = "الإعدادات";

export const SYSTEM_SETTINGS_GROUP_ICON =
  "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z";

export {
  SYSTEM_FIELDS_GROUP,
  SYSTEM_FIELDS_GROUP_ICON,
  type SystemFieldsNavItem,
};

export const SYSTEM_SETTINGS_PRIMARY_PAGE_IDS: PageId[] = [
  ...new Set(SYSTEM_SETTINGS_PRIMARY_NAV.map((n) => n.id)),
];

function filterLeaves(
  items: SystemSettingsNavItem[],
  rolePages: PageId[],
): SystemSettingsNavItem[] {
  return items.filter((item) => rolePages.includes(item.id));
}

export function settingsNavTreeForRole(
  rolePages: PageId[],
  _role?: RoleId,
): SettingsNavTreeNode[] {
  const out: SettingsNavTreeNode[] = [];
  for (const node of SYSTEM_SETTINGS_TREE) {
    if (node.type === "divider") {
      out.push(node);
      continue;
    }
    if (node.type === "item") {
      if (rolePages.includes(node.item.id)) out.push(node);
      continue;
    }
    const items = filterLeaves(node.items, rolePages);
    if (items.length > 0) out.push({ ...node, items });
  }
  while (out.length && out[0]?.type === "divider") out.shift();
  while (out.length && out[out.length - 1]?.type === "divider") out.pop();
  return out;
}

/** @deprecated flattened tree — use settingsNavTreeForRole */
export function systemSettingsPrimaryNavForRole(
  rolePages: PageId[],
  role?: RoleId,
): SystemSettingsNavItem[] {
  return treeLeaves(settingsNavTreeForRole(rolePages, role));
}

export function systemSettingsFieldsNavForRole(
  rolePages: PageId[],
): SystemFieldsNavItem[] {
  return systemFieldsNavForRole(rolePages).filter((item) => item.available);
}

export function isInSystemSettingsSection(
  page: PageId,
  _role?: RoleId,
): boolean {
  return SYSTEM_SETTINGS_PRIMARY_PAGE_IDS.includes(page);
}

export function showSystemSettingsGroup(
  rolePages: PageId[],
  role?: RoleId,
): boolean {
  return settingsNavTreeForRole(rolePages, role).some(
    (node) => node.type !== "divider",
  );
}

export function isSettingsNavItemActive(
  item: SystemSettingsNavItem,
  page: PageId,
  pathname: string,
  search: string,
): boolean {
  if (item.id !== page) return false;
  const qIndex = item.href.indexOf("?");
  if (qIndex === -1) {
    return !search.includes("tab=") || page !== "organization-settings";
  }
  const want = new URLSearchParams(item.href.slice(qIndex));
  const have = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const wantTab = want.get("tab");
  if (!wantTab) return true;
  const haveTab = have.get("tab") || (pathname.includes("organization-settings") ? "company" : null);
  return haveTab === wantTab;
}
