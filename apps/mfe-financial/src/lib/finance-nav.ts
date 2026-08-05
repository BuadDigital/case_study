/** مسارات شاشة المالية — مهامي · الإيرادات · التكاليف · بوابات الأطراف */

export type FinanceArea =
  | "tasks"
  | "revenue"
  | "costs"
  | "eng_portal"
  | "inspector_portal";

export type RevenueStage =
  | "under_study"
  | "eligible"
  | "billing_assistant"
  | "awaiting_collection"
  | "collected"
  | "stopped"
  | "excluded";

export type CostsSection =
  | "parties"
  | "dues"
  | "statements"
  | "paid"
  | "excluded";

export const FINANCE_AREAS: {
  id: FinanceArea;
  label: string;
}[] = [
  { id: "tasks", label: "مهامي" },
  { id: "revenue", label: "الإيرادات" },
  { id: "costs", label: "التكاليف" },
  { id: "eng_portal", label: "المكتب الهندسي" },
  { id: "inspector_portal", label: "المعاين" },
];

export const REVENUE_STAGES: {
  id: RevenueStage;
  label: string;
  actionOnly?: boolean;
}[] = [
  { id: "under_study", label: "تحت الدراسة" },
  { id: "eligible", label: "مؤهلة للفوترة", actionOnly: true },
  { id: "billing_assistant", label: "مساعد الفوترة", actionOnly: true },
  { id: "awaiting_collection", label: "بانتظار التحصيل", actionOnly: true },
  { id: "collected", label: "محصّلة" },
  { id: "stopped", label: "متوقفة", actionOnly: true },
  { id: "excluded", label: "مستبعدة" },
];

/** تبويبات حساب مستحق واحد — مطابق HTML */
export const COSTS_ACCOUNT_TABS: {
  id: CostsSection;
  label: string;
  vendorLabel?: string;
  individualLabel?: string;
}[] = [
  { id: "dues", label: "المستحقات" },
  {
    id: "statements",
    label: "مسيرات وأوامر صرف",
    individualLabel: "أوامر الصرف",
  },
  { id: "paid", label: "مدفوعة" },
  { id: "excluded", label: "مستبعدة" },
];

/** توافق خلفي */
export const COSTS_SECTIONS: {
  id: CostsSection;
  label: string;
  actionOnly?: boolean;
}[] = [
  { id: "parties", label: "المستحقون" },
  ...COSTS_ACCOUNT_TABS.map((t) => ({
    id: t.id,
    label: t.label,
    actionOnly: true as const,
  })),
];

export function parseFinanceArea(raw: string | null | undefined): FinanceArea {
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

export function parseRevenueStage(
  raw: string | null | undefined,
): RevenueStage {
  if (REVENUE_STAGES.some((s) => s.id === raw)) return raw as RevenueStage;
  /** أول تبويب في التصميم — تحت الدراسة */
  return "under_study";
}

export function parseCostsSection(
  raw: string | null | undefined,
): CostsSection {
  if (raw === "browse" || raw === "reports" || raw === "parties" || !raw)
    return "parties";
  if (COSTS_SECTIONS.some((s) => s.id === raw)) return raw as CostsSection;
  return "parties";
}

export type FinanceNavTarget = {
  area?: FinanceArea;
  stage?: RevenueStage;
  section?: CostsSection;
  po?: string | null;
  statement?: string | null;
  party?: string | null;
};

export function buildFinanceHref(target: FinanceNavTarget = {}): string {
  const params = new URLSearchParams();
  const area = target.area ?? "tasks";
  params.set("area", area);
  if (area === "revenue") {
    params.set("stage", target.stage ?? "under_study");
  }
  if (area === "costs" && target.section)
    params.set("section", target.section);
  if (target.po?.trim()) params.set("po", target.po.trim());
  if (target.statement?.trim())
    params.set("statement", target.statement.trim());
  if (target.party?.trim()) params.set("party", target.party.trim());
  const q = params.toString();
  return q ? `/financial?${q}` : "/financial";
}
