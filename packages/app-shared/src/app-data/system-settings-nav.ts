import type { PageId, RoleId } from "@platform/types";
import { SYSTEM_FIELDS_NAV } from "./system-fields-nav";
import { SYSTEM_FIELDS_CATALOG_NAV_ITEM } from "./system-fields-catalog-nav";

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

/** «لوحة الإدارة» sections — one page, picked by `?tab=`. */
export type AdminPanelTab = "overview" | "accounts" | "data-fixes";

const ADMIN_PANEL_TABS: readonly AdminPanelTab[] = ["overview", "accounts", "data-fixes"];

export function parseAdminPanelTab(raw: string | null | undefined): AdminPanelTab {
  return ADMIN_PANEL_TABS.includes(raw as AdminPanelTab) ? (raw as AdminPanelTab) : "overview";
}

const ADMIN_HREF = (tab: AdminPanelTab) => `/admin-panel?tab=${tab}`;

const ADMIN_PANEL_TAB_TITLES: Record<AdminPanelTab, string> = {
  overview: "نظرة عامة",
  accounts: "حالة الحسابات",
  "data-fixes": "إصلاح البيانات",
};

/** Top-bar title based on `/admin-panel?tab=`. */
export function adminPanelLeafTitle(tab: string | null | undefined): string {
  return ADMIN_PANEL_TAB_TITLES[parseAdminPanelTab(tab)];
}

/** Top-bar title based on `/organization-settings?tab=`. */
export function organizationSettingsLeafTitle(tab: string | null | undefined): string {
  if (tab === "branding") return "الهوية البصرية";
  if (tab === "report") return "تقرير التقييم المهني";
  if (tab === "sla") return "وقت التنفيذ";
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
const ADMIN_OVERVIEW_ICON = "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z";
const ADMIN_ACCOUNTS_ICON =
  "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6";
const ADMIN_FIX_ICON =
  "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z";
const SLA_ICON = "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2";
const BRAND_ICON =
  "M4 16l4.6-4.6a2 2 0 0 1 2.8 0L16 16m-2-2 1.6-1.6a2 2 0 0 1 2.8 0L20 14M14 8h.01M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z";

/** Settings tree v2 — sourced from the system-settings v2.dc.html TREE. */
const SYSTEM_SETTINGS_TREE: SettingsNavTreeNode[] = [
  {
    type: "group",
    id: "admin",
    label: "لوحة الإدارة",
    items: [
      leaf("admin-overview", "admin-panel", ADMIN_PANEL_TAB_TITLES.overview, ADMIN_OVERVIEW_ICON, ADMIN_HREF("overview")),
      leaf("admin-accounts", "admin-panel", ADMIN_PANEL_TAB_TITLES.accounts, ADMIN_ACCOUNTS_ICON, ADMIN_HREF("accounts")),
      leaf("admin-data-fixes", "admin-panel", ADMIN_PANEL_TAB_TITLES["data-fixes"], ADMIN_FIX_ICON, ADMIN_HREF("data-fixes")),
    ],
  },
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
    ],
  },
  {
    type: "group",
    id: "org",
    label: "المنشأة",
    items: [
      leaf("org-data", "organization-settings", "بيانات المنشأة", ORG_ICON, ORG_HREF("company")),
      leaf("brand", "organization-settings", "الهوية البصرية", BRAND_ICON, ORG_HREF("branding")),
      leaf("sla", "organization-settings", "وقت التنفيذ", SLA_ICON, ORG_HREF("sla")),
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
        "comparables-bank",
        "comparable-properties",
        "بنك المقارنات",
        "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
      ),
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

const SYSTEM_SETTINGS_PRIMARY_NAV: SystemSettingsNavItem[] = treeLeaves(
  SYSTEM_SETTINGS_TREE,
);

export const SYSTEM_SETTINGS_GROUP = "الإعدادات";

export const SYSTEM_SETTINGS_GROUP_ICON =
  "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z";


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

export function isInSystemSettingsSection(
  page: PageId,
  _role?: RoleId,
): boolean {
  return SYSTEM_SETTINGS_PRIMARY_PAGE_IDS.includes(page);
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
  const haveTab =
    have.get("tab") ||
    (pathname.includes("organization-settings")
      ? "company"
      : pathname.includes("admin-panel")
        ? "overview"
        : null);
  return haveTab === wantTab;
}
