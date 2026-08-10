import type { PageId } from "@platform/types";

/** مجموعة السايدبار — مطابق لـ Finance.html */
export const FINANCIAL_GROUP = "المالية";

/** زر التوسيع في HTML بعد مجموعة المالية */
export const FINANCIAL_TOGGLE_LABEL = "المالية والفوترة";

export const FINANCIAL_GROUP_ICON =
  "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6";

/**
 * Finance.html: `<div class="nav-group">بوابات الأطراف — لتجربة الأثر</div>`
 */
export const PARTY_PORTALS_GROUP = "بوابات الأطراف — لتجربة الأثر";

export type FinanceNavArea =
  | "tasks"
  | "revenue"
  | "costs"
  | "eng_portal"
  | "inspector_portal";

export type FinanceNavLeaf = {
  area: FinanceNavArea;
  label: string;
  icon: string;
  pageTitle: string;
  crumb: string;
};

export const FINANCIAL_NAV_LEAVES: FinanceNavLeaf[] = [
  {
    area: "tasks",
    label: "مهامي",
    icon: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9l2 2 4-4",
    pageTitle: "مهامي",
    crumb: "مهامي",
  },
  {
    area: "revenue",
    label: "الإيرادات",
    icon: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
    pageTitle: "الإيرادات — فوترة مركز التصفية",
    crumb: "الإيرادات",
  },
  {
    area: "costs",
    label: "التكاليف",
    icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    pageTitle: "التكاليف — صرف المستحقات",
    crumb: "التكاليف",
  },
];

/** بوابات الأطراف أُزيلت من السايدبار — محتوى داخل بروفايل المكتب/المعاين */
export const PARTY_PORTAL_NAV_LEAVES: FinanceNavLeaf[] = [];

/** ورقة legacy — مسار URL `/financial?area=eng_portal` إن لزم */
export const ENG_OFFICE_PORTAL_LEAF: FinanceNavLeaf = {
  area: "eng_portal",
  label: "المكتب الهندسي",
  icon: "M4 4v16h16M4 20 20 4M8 20v-3M12 20v-3M16 20v-3",
  pageTitle: "بوابة المكتب الهندسي",
  crumb: "مسيرات الصرف",
};

/** ورقة legacy — مسار URL `/financial?area=inspector_portal` إن لزم */
export const INSPECTOR_PORTAL_LEAF: FinanceNavLeaf = {
  area: "inspector_portal",
  label: "المعاين",
  icon: "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM2.46 12C3.73 7.94 7.52 5 12 5s8.27 2.94 9.54 7c-1.27 4.06-5.06 7-9.54 7s-8.27-2.94-9.54-7z",
  pageTitle: "بوابة المعاين",
  crumb: "المستحقات",
};

export function parseFinanceNavArea(
  raw: string | null | undefined,
): FinanceNavArea {
  if (
    raw === "revenue" ||
    raw === "costs" ||
    raw === "tasks" ||
    raw === "eng_portal" ||
    raw === "inspector_portal"
  )
    return raw;
  return "tasks";
}

export function isPartyPortalArea(area: FinanceNavArea): boolean {
  return area === "eng_portal" || area === "inspector_portal";
}

/** مسار URL legacy لمسار eng_portal */
export function isEngOfficePortalArea(area: FinanceNavArea): boolean {
  return area === "eng_portal";
}

export function isInspectorPortalArea(area: FinanceNavArea): boolean {
  return area === "inspector_portal";
}

export function isFinanceCoreArea(area: FinanceNavArea): boolean {
  return area === "tasks" || area === "revenue" || area === "costs";
}

export function financialHref(area: FinanceNavArea): string {
  return `/financial?area=${area}`;
}

export function financeLeafForArea(area: FinanceNavArea): FinanceNavLeaf {
  if (area === "eng_portal") return ENG_OFFICE_PORTAL_LEAF;
  if (area === "inspector_portal") return INSPECTOR_PORTAL_LEAF;
  return (
    FINANCIAL_NAV_LEAVES.find((l) => l.area === area) ??
    FINANCIAL_NAV_LEAVES[0]!
  );
}

export function isInFinancialSection(page: PageId): boolean {
  return page === "financial";
}

export function showFinancialNavGroup(rolePages: PageId[]): boolean {
  return rolePages.includes("financial");
}

/** أُلغيت مجموعة بوابات الأطراف من السايدبار */
export function showPartyPortalsNavGroup(_rolePages: PageId[]): boolean {
  return false;
}
