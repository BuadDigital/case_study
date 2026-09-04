/**
 * Pure rules behind `CostApproachSection` — draft hydration, the live totals
 * pass, the alert trigger table, the auto-generated cost narrative and the
 * save payload mapper. No React, no I/O.
 */
import type {
  ValuationCostApproachDto,
  ValuationCostLineDto,
} from "@platform/api-client";

import {
  COST_ITEM_OPTIONS,
  INDIRECT_COST_ITEMS,
  costGroupOf,
  costLineComputed,
} from "./cost-line-math";

/** Per-item indirect draft: percentages stay strings so typing is lossless. */
export type IndirectDraft = Record<string, { pct: string; rationale: string }>;

export type CostApproachAlert = {
  kind: "error" | "warn" | "ok";
  title: string;
  body: string;
};

/** Every free-text/number field the cost screen edits, as typed strings. */
export type CostApproachFields = {
  useRestrictionPct: string;
  useRestrictionRationale: string;
  apartmentLandShare: string;
  indirectDraft: IndirectDraft;
  financingRate: string;
  financingMonths: string;
  actualAge: string;
  economicAge: string;
  lifeExtension: string;
  lifeExtensionBasis: string;
  functionalObs: string;
  functionalObsRationale: string;
  externalObs: string;
  externalObsRationale: string;
  costAnalysisNotes: string;
};

/** Arabic decimal comma is accepted everywhere a number is typed. */
export function costNum(raw: string): number {
  return Number(String(raw).replace(",", ".")) || 0;
}

export const EMPTY_COST_FIELDS: CostApproachFields = {
  useRestrictionPct: "0",
  useRestrictionRationale: "",
  apartmentLandShare: "",
  indirectDraft: {},
  financingRate: "0",
  financingMonths: "0",
  actualAge: "",
  economicAge: "",
  lifeExtension: "0",
  lifeExtensionBasis: "",
  functionalObs: "0",
  functionalObsRationale: "",
  externalObs: "0",
  externalObsRationale: "",
  costAnalysisNotes: "",
};

/** Server DTO to editable drafts — one full-load reseed, no partial merges. */
export function costFieldsFromDto(
  cost: ValuationCostApproachDto,
): CostApproachFields {
  const indirectDraft: IndirectDraft = {};
  for (const item of cost.indirectItems ?? []) {
    indirectDraft[item.itemKey] = {
      pct: String(item.pct),
      rationale: item.rationale ?? "",
    };
  }
  return {
    useRestrictionPct: String(cost.useRestrictionDiscountPct ?? 0),
    useRestrictionRationale: cost.useRestrictionRationale ?? "",
    apartmentLandShare:
      cost.apartmentLandShareSqm != null
        ? String(cost.apartmentLandShareSqm)
        : "",
    indirectDraft,
    financingRate: String(cost.financingAnnualRatePct ?? 0),
    financingMonths: String(cost.financingMonths ?? 0),
    actualAge: cost.actualAgeYears != null ? String(cost.actualAgeYears) : "",
    economicAge:
      cost.economicAgeYears != null ? String(cost.economicAgeYears) : "",
    lifeExtension: String(cost.lifeExtensionYears ?? 0),
    lifeExtensionBasis: cost.lifeExtensionBasis ?? "",
    functionalObs: String(cost.functionalObsolescencePct ?? 0),
    functionalObsRationale: cost.functionalObsolescenceRationale ?? "",
    externalObs: String(cost.externalObsolescencePct ?? 0),
    externalObsRationale: cost.externalObsolescenceRationale ?? "",
    costAnalysisNotes: cost.analysisNotes ?? "",
  };
}

/** One inventory row as the building-inventory endpoint returns it. */
export type CostSeedInventoryLine = {
  id?: string | null;
  structureKind?: string | null;
  label: string;
  areaSqm?: number | string | null;
};

/** Building inventory to cost lines — unit rates are left for the evaluator. */
export function costLinesFromInventory(
  lines: CostSeedInventoryLine[],
): ValuationCostLineDto[] {
  return lines.map((l, i) => ({
    id: crypto.randomUUID(),
    sourceInventoryLineId: l.id ?? null,
    structureKind: l.structureKind || "other",
    itemKey:
      l.structureKind === "basement"
        ? "basement"
        : l.structureKind === "fence"
          ? "fence"
          : l.structureKind === "annex"
            ? /علوي|upper/i.test(l.label ?? "")
              ? "upper_annex"
              : "lower_annex"
            : "custom",
    itemLabelAr: "",
    unit: "sqm",
    unitLabelAr: "م²",
    buildRatioPct: null,
    repeatedFloorCount: null,
    label: l.label,
    areaSqm: Number(String(l.areaSqm ?? "0").replace(",", ".")) || 0,
    unitCostSar: 0,
    lineTotal: 0,
    rationale: "",
    isIncluded: true,
    sortOrder: i,
  }));
}

export function blankCostLine(
  sortOrder: number,
  partial: Partial<ValuationCostLineDto>,
): ValuationCostLineDto {
  return {
    id: crypto.randomUUID(),
    sourceInventoryLineId: null,
    structureKind: "other",
    itemKey: "custom",
    itemLabelAr: "",
    label: "",
    areaSqm: 0,
    unit: "sqm",
    unitLabelAr: "م²",
    buildRatioPct: null,
    repeatedFloorCount: null,
    unitCostSar: 0,
    lineTotal: 0,
    rationale: "",
    isIncluded: true,
    sortOrder,
    ...partial,
  };
}

export type CostLineTotals = {
  firstFloorLine: ValuationCostLineDto | null;
  computedLines: ReturnType<typeof costLineComputed>[];
  directTotal: number;
  areaSubtotal: number;
  extraSubtotal: number;
  buildAreaLocal: number;
};

/**
 * One pass over the draft instead of map + three reduces: the first-floor row
 * is resolved once and handed to every line (rerender-memo).
 */
export function costLineTotals(
  costDraft: ValuationCostLineDto[],
): CostLineTotals {
  const firstFloorLine =
    costDraft.find((l) => l.itemKey === "first_floor") ?? null;
  const computedLines = costDraft.map((l) =>
    costLineComputed(l, costDraft, firstFloorLine),
  );
  let directTotal = 0;
  let areaSubtotal = 0;
  let buildAreaLocal = 0;
  computedLines.forEach((c, i) => {
    directTotal += c.total;
    if (c.inArea) {
      areaSubtotal += c.total;
      if (
        (costDraft[i]!.unit || "sqm") === "sqm" &&
        costDraft[i]!.isIncluded !== false
      ) {
        buildAreaLocal += c.qty;
      }
    }
  });
  return {
    firstFloorLine,
    computedLines,
    directTotal,
    areaSubtotal,
    extraSubtotal: directTotal - areaSubtotal,
    buildAreaLocal,
  };
}

export type CostApproachDerived = {
  financingPctLocal: number;
  indirectSumLocal: number;
  totalCostLocal: number;
  economicLocal: number;
  extLifeLocal: number;
  actualLocal: number;
  physicalLocal: number;
  functionalLocal: number;
  externalLocal: number;
  totalDepLocal: number;
  depValueLocal: number;
  netValueLocal: number;
  costValueLocal: number;
  developerProfitPct: number;
  landComplete: boolean;
};

/**
 * Live indirect, age and depreciation math — mirrors the server calc that runs
 * on save. Form spec: no 100% cap on obsolescence; the overshoot is gated by
 * alert m4 instead of being clamped away.
 */
export function costApproachDerived(
  fields: CostApproachFields,
  directTotal: number,
  cost: ValuationCostApproachDto | null,
  buildingOnly: boolean,
): CostApproachDerived {
  const financingPctLocal =
    costNum(fields.financingRate) *
    ((Number.parseInt(fields.financingMonths, 10) || 0) / 12) *
    0.5;
  const indirectSumLocal =
    INDIRECT_COST_ITEMS.reduce(
      (s, item) =>
        s + Math.max(0, costNum(fields.indirectDraft[item.key]?.pct ?? "0")),
      0,
    ) + financingPctLocal;
  const totalCostLocal = directTotal * (1 + indirectSumLocal / 100);
  const economicLocal = costNum(fields.economicAge);
  const extLifeLocal = economicLocal + costNum(fields.lifeExtension);
  const actualLocal = costNum(fields.actualAge);
  const physicalLocal =
    extLifeLocal > 0 && fields.actualAge.trim()
      ? (actualLocal / extLifeLocal) * 100
      : 0;
  const functionalLocal = costNum(fields.functionalObs);
  const externalLocal = costNum(fields.externalObs);
  const totalDepLocal = physicalLocal + functionalLocal + externalLocal;
  const depValueLocal = (totalCostLocal * Math.max(totalDepLocal, 0)) / 100;
  const netValueLocal = totalCostLocal - depValueLocal;
  const landComplete = !!cost?.landEstimateComplete;
  const landValueNow = cost?.landValueFromMarket ?? 0;
  return {
    financingPctLocal,
    indirectSumLocal,
    totalCostLocal,
    economicLocal,
    extLifeLocal,
    actualLocal,
    physicalLocal,
    functionalLocal,
    externalLocal,
    totalDepLocal,
    depValueLocal,
    netValueLocal,
    // costValue = landPart + netValue always (landPart = 0 when land is incomplete).
    costValueLocal:
      netValueLocal + (!buildingOnly && landComplete ? landValueNow : 0),
    developerProfitPct: costNum(
      fields.indirectDraft["developer_profit"]?.pct ?? "0",
    ),
    landComplete,
  };
}

function costItemLabel(line: ValuationCostLineDto): string {
  return (
    line.label ||
    COST_ITEM_OPTIONS.find((o) => o.key === line.itemKey)?.label ||
    ""
  );
}

/** Cost-approach alerts — the interactive-form trigger table, in order. */
export function buildCostAlerts(
  fields: CostApproachFields,
  costDraft: ValuationCostLineDto[],
  totals: Pick<CostLineTotals, "firstFloorLine">,
  derived: CostApproachDerived,
  buildingOnly: boolean,
): CostApproachAlert[] {
  const alerts: CostApproachAlert[] = [];
  const {
    extLifeLocal,
    actualLocal,
    totalDepLocal,
    functionalLocal,
    externalLocal,
    indirectSumLocal,
    developerProfitPct,
    landComplete,
  } = derived;
  if (costDraft.length === 0)
    alerts.push({
      kind: "error",
      title: "لا يوجد بند تكلفة",
      body: "يلزم بند واحد على الأقل في جدول التكلفة.",
    });
  if (extLifeLocal <= 0)
    alerts.push({
      kind: "error",
      title: "العمر الممتد صفر",
      body: "العمر الاقتصادي + التمديد يجب أن يكون أكبر من صفر.",
    });
  else if (actualLocal > extLifeLocal)
    alerts.push({
      kind: "error",
      title: "العمر الفعلي يتجاوز العمر الممتد",
      body: "الإهلاك المادي يتجاوز ١٠٠٪.",
    });
  if (totalDepLocal > 100)
    alerts.push({
      kind: "error",
      title: "مجموع التقادم يتجاوز ١٠٠٪",
      body: "راجع نسب التقادم الوظيفي والخارجي.",
    });
  if (
    costDraft.some((l) => l.itemKey === "repeated_floors") &&
    !costDraft.some((l) => l.itemKey === "first_floor" && l.areaSqm > 0)
  )
    alerts.push({
      kind: "error",
      title: "بند الأدوار المتكررة بلا «الدور الأول»",
      body: "كمية المتكررة تُشتقّ من مسطح الدور الأول — أعد إدراجه أو احذف بند المتكررة.",
    });
  if (costNum(fields.lifeExtension) > 0 && !fields.lifeExtensionBasis.trim())
    alerts.push({
      kind: "warn",
      title: "تمديد العمر مستخدم",
      body: "يلزم بيان أساس التمديد كتابةً.",
    });
  for (const l of costDraft) {
    if (
      costGroupOf(l) === "extra" &&
      (l.label.trim() || l.itemKey !== "custom") &&
      !l.rationale.trim()
    ) {
      alerts.push({
        kind: "warn",
        title: `بند إضافي بلا مبرر: ${costItemLabel(l)}`,
        body: "يلزم توثيق أساس التقدير — احتمال ازدواج مع ما هو مضمَّن في تكلفة المتر.",
      });
    }
    if (
      l.itemKey === "repeated_floors" &&
      l.unitCostSar > 0 &&
      l.unitCostSar !== (totals.firstFloorLine?.unitCostSar ?? 0) &&
      !l.rationale.trim()
    ) {
      alerts.push({
        kind: "warn",
        title: "تكلفة متر المتكررة تخالف الدور الأول",
        body: "التجاوز مسموح بمبرر مكتوب — دوّن سببه.",
      });
    }
  }
  if (
    costNum(fields.useRestrictionPct) > 0 &&
    !fields.useRestrictionRationale.trim()
  )
    alerts.push({
      kind: "warn",
      title: "خصم تقييد الاستخدام بلا مبرر",
      body: "افتراضه صفر ولا يُملأ إلا بمبرر موثّق.",
    });
  if (!buildingOnly && !landComplete)
    alerts.push({
      kind: "error",
      title: "قيمة الأرض غير مقدَّرة",
      body: "اعتمد مقارنات أراضٍ فضاء — مؤشر الأسلوب يبقى غير مكتمل بدونها.",
    });
  if (
    (functionalLocal > 0 && !fields.functionalObsRationale.trim()) ||
    (externalLocal > 0 && !fields.externalObsRationale.trim())
  )
    alerts.push({
      kind: "warn",
      title: "تقادم وظيفي أو خارجي بلا مبرر",
      body: "يلزم مبرر مكتوب لكل نسبة تقادم غير مادية.",
    });
  if (developerProfitPct < 10 || developerProfitPct > 20)
    alerts.push({
      kind: "warn",
      title: "أرباح المطور خارج النطاق",
      body: `النطاق المعتاد ١٠٪–٢٠٪، والحالي ${developerProfitPct}٪.`,
    });
  if (indirectSumLocal > 45)
    alerts.push({
      kind: "warn",
      title: "النسب غير المباشرة مرتفعة",
      body: `المجموع ${(Math.round(indirectSumLocal * 100) / 100).toFixed(2)}٪ يتجاوز ٤٥٪.`,
    });
  if (alerts.length === 0)
    alerts.push({
      kind: "ok",
      title: "لا تنبيهات",
      body: "المدخلات ضمن الحدود المنهجية.",
    });
  return alerts;
}

/** Auto cost analysis — `buildCostNarrative` from the interactive form. */
export function buildCostNarrative(
  fields: CostApproachFields,
  costDraft: ValuationCostLineDto[],
  costBasisKey: string,
): string {
  const noJust = "لم يتم تبريره";
  return [
    `طريقة التكلفة: ${costBasisKey === "reproduction" ? "إعادة الإنتاج" : "الإحلال"}.`,
    costNum(fields.useRestrictionPct) > 0
      ? `خصم تقييد الاستخدام: ${fields.useRestrictionPct}٪ — ${fields.useRestrictionRationale.trim() || noJust}.`
      : null,
    "مبررات بنود التكلفة:\n" +
      (costDraft.length
        ? costDraft
            .filter((l) => l.label.trim() || l.itemKey !== "custom")
            .map((l) => `• ${costItemLabel(l)} — ${l.rationale.trim() || noJust}`)
            .join("\n")
        : "• لا توجد بنود"),
    "مبررات النسب غير المباشرة:\n" +
      INDIRECT_COST_ITEMS.map(
        (item) =>
          `• ${item.label} (${fields.indirectDraft[item.key]?.pct ?? "0"}٪) — ${(fields.indirectDraft[item.key]?.rationale ?? "").trim() || noJust}`,
      ).join("\n") +
      `\n• التمويل — معدل ${fields.financingRate}٪ سنوياً على ${fields.financingMonths} شهراً بمتوسط سحب ٥٠٪`,
    "مبررات العمر والتقادم:\n" +
      [
        `• العمر الفعلي (${fields.actualAge || "—"}) — ${noJust}`,
        `• العمر الاقتصادي (${fields.economicAge || "—"}) — ${noJust}`,
        `• تمديد العمر (${fields.lifeExtension || "0"}) — ${fields.lifeExtensionBasis.trim() || noJust}`,
        `• التقادم الوظيفي (${fields.functionalObs || "0"}٪) — ${fields.functionalObsRationale.trim() || noJust}`,
        `• التقادم الخارجي (${fields.externalObs || "0"}٪) — ${fields.externalObsRationale.trim() || noJust}`,
      ].join("\n"),
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Draft state to the save request body. */
export function costSaveRequest(
  fields: CostApproachFields,
  costDraft: ValuationCostLineDto[],
) {
  return {
    refreshLandFromLandComps: true,
    analysisNotes: fields.costAnalysisNotes.trim() || null,
    useRestrictionDiscountPct: costNum(fields.useRestrictionPct),
    useRestrictionRationale: fields.useRestrictionRationale.trim() || null,
    apartmentLandShareSqm: fields.apartmentLandShare.trim()
      ? costNum(fields.apartmentLandShare)
      : null,
    indirectItems: INDIRECT_COST_ITEMS.filter(
      (item) =>
        costNum(fields.indirectDraft[item.key]?.pct ?? "0") > 0 ||
        (fields.indirectDraft[item.key]?.rationale ?? "").trim() !== "",
    ).map((item, i) => ({
      itemKey: item.key,
      pct: costNum(fields.indirectDraft[item.key]?.pct ?? "0"),
      rationale: (fields.indirectDraft[item.key]?.rationale ?? "").trim() || null,
      sortOrder: i,
    })),
    financingAnnualRatePct: costNum(fields.financingRate),
    financingMonths: Number.parseInt(fields.financingMonths, 10) || 0,
    actualAgeYears: fields.actualAge.trim() ? costNum(fields.actualAge) : null,
    economicAgeYears: fields.economicAge.trim()
      ? costNum(fields.economicAge)
      : null,
    lifeExtensionYears: costNum(fields.lifeExtension),
    lifeExtensionBasis: fields.lifeExtensionBasis.trim() || null,
    functionalObsolescencePct: costNum(fields.functionalObs),
    functionalObsolescenceRationale: fields.functionalObsRationale.trim() || null,
    externalObsolescencePct: costNum(fields.externalObs),
    externalObsolescenceRationale: fields.externalObsRationale.trim() || null,
    lines: costDraft.map((l, i) => ({
      id: l.id,
      sourceInventoryLineId: l.sourceInventoryLineId,
      structureKind: l.structureKind,
      itemKey: l.itemKey || "custom",
      label: l.label,
      areaSqm: l.areaSqm,
      unit: l.unit || null,
      buildRatioPct: l.buildRatioPct ?? null,
      repeatedFloorCount: l.repeatedFloorCount ?? null,
      unitCostSar: l.unitCostSar,
      rationale: l.rationale,
      isIncluded: l.isIncluded,
      sortOrder: i,
    })),
  };
}

/**
 * Move a dragged line to the target row position — cross-group moves are
 * rejected, as in the interactive form. Returns null when nothing changes.
 */
export function reorderCostLines(
  costDraft: ValuationCostLineDto[],
  sourceId: string,
  targetIdx: number,
): ValuationCostLineDto[] | null {
  const sourceIdx = costDraft.findIndex((l) => l.id === sourceId);
  const target = costDraft[targetIdx];
  if (sourceIdx < 0 || !target || sourceIdx === targetIdx) return null;
  if (costGroupOf(costDraft[sourceIdx]!) !== costGroupOf(target)) return null;
  const next = [...costDraft];
  const [moved] = next.splice(sourceIdx, 1);
  next.splice(targetIdx, 0, moved!);
  return next;
}
