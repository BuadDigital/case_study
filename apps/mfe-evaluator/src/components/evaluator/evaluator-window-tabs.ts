import type { FrameSectionDef } from "@platform/ui-kit";
import type { ValuationWorkScreenId } from "./valuation-work/lib/shell-state";

export type EvaluatorWindowTab = ValuationWorkScreenId | "output";

export const WORK_SCREENS: ValuationWorkScreenId[] = [
  "basic",
  "market",
  "cost",
  "final",
  "review",
];

const VAL_TAB_DEFS: { id: EvaluatorWindowTab; label: string; hint: string }[] = [
  {
    id: "basic",
    label: "أساليب وطرق التقييم",
    hint: "نطاق التقييم والأساليب وتاريخ التقييم",
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
}): typeof VAL_TAB_DEFS {
  return VAL_TAB_DEFS.filter((t) => {
    if (t.id === "market") return navAvail.market;
    if (t.id === "cost") return navAvail.cost;
    return true;
  });
}

/**
 * The appraiser's page as numbered sections (Omar 2026-11-10: the work page's frame instead of the
 * tab bar): the property summary he reads first, then the five valuation screens. The report is
 * not a section — it opens in a window.
 */
export type EvaluatorSectionId = "summary" | ValuationWorkScreenId;

/** Where each valuation screen sits in the flow; the summary shares the first step. */
const SCREEN_STEP: Record<ValuationWorkScreenId, number> = {
  basic: 1,
  market: 2,
  cost: 3,
  final: 4,
  review: 5,
};
/** Past the last section: the valuation was handed over. */
const HANDED_OVER_STEP = 6;

const SECTION_DEFS: readonly FrameSectionDef<EvaluatorSectionId>[] = [
  { id: "summary", title: "ملخص العقار ونتائج الدراسة", step: SCREEN_STEP.basic },
  { id: "basic", title: "أساليب وطرق التقييم", step: SCREEN_STEP.basic },
  { id: "market", title: "طريقة المقارنة", step: SCREEN_STEP.market, tag: "أسلوب السوق" },
  { id: "cost", title: "طريقة المقاول", step: SCREEN_STEP.cost, tag: "أسلوب التكلفة" },
  { id: "final", title: "رأي القيمة النهائي", step: SCREEN_STEP.final },
  { id: "review", title: "المراجعة النهائية والإرسال", step: SCREEN_STEP.review },
];

/** Sections mounted from the first paint: the summary carries the draft's work-order sync, and a
 * hand-over from any section must reach the approaches' and the review's fields. */
export const EVALUATOR_KEEP_MOUNTED: readonly EvaluatorSectionId[] = ["summary", "basic", "review"];

/**
 * The page's sections for the approaches in use.
 * How it works: the fixed list minus «طريقة المقارنة» / «طريقة المقاول» when their approach is off.
 */
export function evaluatorSections(navAvail: {
  market: boolean;
  cost: boolean;
}): FrameSectionDef<EvaluatorSectionId>[] {
  return SECTION_DEFS.filter((s) => {
    if (s.id === "market") return navAvail.market;
    if (s.id === "cost") return navAvail.cost;
    return true;
  });
}

/**
 * The rail's step from the screen the valuation stands at.
 * How it works: the screen's own step; a locked (handed-over) package is past every section.
 * Edge cases: nothing reported yet (still loading) → the first step, so the summary and the
 * approaches show as current until the real step arrives.
 */
export function evaluatorSectionsStep(
  current: ValuationWorkScreenId | null,
  locked: boolean,
): number {
  if (locked) return HANDED_OVER_STEP;
  return current ? SCREEN_STEP[current] : SCREEN_STEP.basic;
}
