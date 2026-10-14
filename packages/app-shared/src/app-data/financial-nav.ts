import type { PageId } from "@platform/types";

/** Sidebar group — matches Finance.html */
export const FINANCIAL_GROUP = "المالية";

/** Expand toggle label in HTML after the finance group */
export const FINANCIAL_TOGGLE_LABEL = "المالية والفوترة";

export const FINANCIAL_GROUP_ICON =
  "M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6";

export type FinanceNavArea = "tasks" | "revenue" | "costs";

type FinanceNavLeaf = {
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


export function parseFinanceNavArea(
  raw: string | null | undefined,
): FinanceNavArea {
  if (raw === "revenue" || raw === "costs" || raw === "tasks") return raw;
  return "tasks";
}

export function financialHref(area: FinanceNavArea): string {
  return `/financial?area=${area}`;
}

export function financeLeafForArea(area: FinanceNavArea): FinanceNavLeaf {
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
