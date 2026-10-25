import type { ValuationWorkScreenId } from "./valuation-work/lib/shell-state";

export type EvaluatorWindowTab = ValuationWorkScreenId | "output";

export const WORK_SCREENS: ValuationWorkScreenId[] = [
  "basic",
  "market",
  "cost",
  "income",
  "final",
  "review",
];

const VAL_TAB_DEFS: { id: EvaluatorWindowTab; label: string; hint: string }[] = [
  {
    id: "basic",
    label: "البيانات الأساسية",
    hint: "إعدادات الأساليب وتاريخ التقييم ومدخلات التقرير",
  },
  {
    id: "market",
    label: "طريقة المقارنة",
    hint: "بنك المقارنات وتسويات أسلوب السوق",
  },
  {
    id: "cost",
    label: "طريقة المقاول",
    hint: "تكلفة الإحلال والإهلاك",
  },
  {
    id: "income",
    label: "أسلوب الدخل",
    hint: "رسملة مباشرة: صافي الدخل التشغيلي ÷ معدل الرسملة",
  },
  {
    id: "final",
    label: "رأي القيمة النهائي",
    hint: "الرأي النهائي وخصم التصفية",
  },
  {
    id: "review",
    label: "المراجعة النهائية",
    hint: "الافتراضات الخاصة وإرسال التقييم",
  },
  {
    id: "output",
    label: "تقرير التقييم",
    hint: "معاينة التقرير وطباعته",
  },
];

export function isWorkScreen(id: EvaluatorWindowTab): id is ValuationWorkScreenId {
  return id !== "output";
}

export function visibleEvaluatorTabs(navAvail: {
  market: boolean;
  cost: boolean;
  income?: boolean;
}): typeof VAL_TAB_DEFS {
  return VAL_TAB_DEFS.filter((t) => {
    if (t.id === "market") return navAvail.market;
    if (t.id === "cost") return navAvail.cost;
    // D17 — shown only while the income approach is enabled in the settings.
    if (t.id === "income") return navAvail.income === true;
    return true;
  });
}
