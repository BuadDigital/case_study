/**
 * Pure rules behind `CostApproachSection` — draft hydration, the live totals
 * pass, the alert trigger table, the auto-generated cost narrative and the
 * save payload mapper. No React, no I/O.
 */
import type {
  ValuationCostApproachDto,
  ValuationCostLineDto,
} from "@platform/api-client";
import { createClientId } from "@platform/app-shared/lib/create-client-id";
import { toLatinDigits } from "@platform/app-shared/lib/arabic-digits";

import {
  COST_ITEM_OPTIONS,
  COST_UNIT_OPTIONS,
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
  actualAgeRationale: string;
  economicAge: string;
  economicAgeRationale: string;
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

/** Interactive-form starter values (التقييم بأسلوبي السوق والتكلفة). */
export const DEFAULT_INDIRECT_PCTS: Record<string, string> = {
  design_supervision: "3",
  licensing_fees: "3",
  project_management: "3",
  utilities_connection: "3",
  contingency: "3",
  developer_profit: "15",
};

export const DEFAULT_FINANCING_RATE = "5";
export const DEFAULT_FINANCING_MONTHS = "18";
export const DEFAULT_ACTUAL_AGE_YEARS = "10";
export const DEFAULT_ECONOMIC_AGE_YEARS = "40";

export function defaultIndirectDraft(): IndirectDraft {
  const draft: IndirectDraft = {};
  for (const item of INDIRECT_COST_ITEMS) {
    draft[item.key] = {
      pct: DEFAULT_INDIRECT_PCTS[item.key] ?? "0",
      rationale: "",
    };
  }
  return draft;
}

export const EMPTY_COST_FIELDS: CostApproachFields = {
  useRestrictionPct: "0",
  useRestrictionRationale: "",
  apartmentLandShare: "",
  indirectDraft: defaultIndirectDraft(),
  financingRate: DEFAULT_FINANCING_RATE,
  financingMonths: DEFAULT_FINANCING_MONTHS,
  actualAge: DEFAULT_ACTUAL_AGE_YEARS,
  actualAgeRationale: "",
  economicAge: DEFAULT_ECONOMIC_AGE_YEARS,
  economicAgeRationale: "",
  lifeExtension: "0",
  lifeExtensionBasis: "",
  functionalObs: "0",
  functionalObsRationale: "",
  externalObs: "0",
  externalObsRationale: "",
  costAnalysisNotes: "",
};

/** Inspector property age → cost actual-age field. Empty when missing or non-numeric. */
export function inspectorAgeYearsForCostField(
  raw: string | null | undefined,
): string {
  const latin = toLatinDigits((raw ?? "").trim());
  const match = latin.match(/(\d+(?:\.\d+)?)/);
  return match?.[1] ?? "";
}

/** Server DTO to editable drafts — one full-load reseed, no partial merges. */
export function costFieldsFromDto(
  cost: ValuationCostApproachDto,
  inspectorAgeYears?: string | null,
): CostApproachFields {
  const savedIndirect = cost.indirectItems ?? [];
  const hasSavedIndirect = savedIndirect.some(
    (item) => item.pct !== 0 || (item.rationale ?? "").trim() !== "",
  );
  const indirectDraft: IndirectDraft = hasSavedIndirect
    ? {}
    : defaultIndirectDraft();
  if (hasSavedIndirect) {
    for (const item of savedIndirect) {
      indirectDraft[item.itemKey] = {
        pct: String(item.pct),
        rationale: item.rationale ?? "",
      };
    }
  }
  const financingUntouched =
    !(cost.financingAnnualRatePct ?? 0) && !(cost.financingMonths ?? 0);
  return {
    useRestrictionPct: String(cost.useRestrictionDiscountPct ?? 0),
    useRestrictionRationale: cost.useRestrictionRationale ?? "",
    apartmentLandShare:
      cost.apartmentLandShareSqm != null
        ? String(cost.apartmentLandShareSqm)
        : "",
    indirectDraft,
    financingRate: financingUntouched
      ? DEFAULT_FINANCING_RATE
      : String(cost.financingAnnualRatePct ?? 0),
    financingMonths: financingUntouched
      ? DEFAULT_FINANCING_MONTHS
      : String(cost.financingMonths ?? 0),
    actualAge:
      cost.actualAgeYears != null
        ? String(cost.actualAgeYears)
        : inspectorAgeYearsForCostField(inspectorAgeYears) ||
          DEFAULT_ACTUAL_AGE_YEARS,
    actualAgeRationale: "",
    economicAge:
      cost.economicAgeYears != null
        ? String(cost.economicAgeYears)
        : DEFAULT_ECONOMIC_AGE_YEARS,
    economicAgeRationale: "",
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
  /** Set by the case specialist's «جدول المكونات» (same catalog as the cost table). */
  itemKey?: string | null;
  unit?: string | null;
  buildRatioPct?: number | null;
  repeatedFloorCount?: number | null;
};

/** Legacy inventory rows (no item key) — guess the catalog item from kind and label. */
function legacyCostItemKey(l: CostSeedInventoryLine): string {
  if (l.structureKind === "basement") return "basement";
  if (l.structureKind === "fence") return "fence";
  if (l.structureKind === "annex") {
    return /علوي|upper/i.test(l.label ?? "") ? "upper_annex" : "lower_annex";
  }
  return "custom";
}

/**
 * The specialist's components table to cost lines — item, quantity, unit, built-up ratio and
 * repeated floors carry over; unit rates are left for the evaluator.
 */
export function costLinesFromInventory(
  lines: CostSeedInventoryLine[],
): ValuationCostLineDto[] {
  return lines.map((l, i) => {
    const itemKey = l.itemKey?.trim() || legacyCostItemKey(l);
    const unit = l.unit?.trim() || COST_ITEM_OPTIONS.find((o) => o.key === itemKey)?.unit || "sqm";
    return {
    id: createClientId("cost"),
    sourceInventoryLineId: l.id ?? null,
    structureKind: l.structureKind || "other",
    itemKey,
    itemLabelAr: "",
    unit,
    unitLabelAr: COST_UNIT_OPTIONS.find((u) => u.key === unit)?.label ?? "م²",
    buildRatioPct: l.buildRatioPct ?? null,
    repeatedFloorCount: l.repeatedFloorCount ?? null,
    label: l.label,
    areaSqm: Number(String(l.areaSqm ?? "0").replace(",", ".")) || 0,
    unitCostSar: 0,
    lineTotal: 0,
    rationale: "",
    isIncluded: true,
    sortOrder: i,
    };
  });
}

/* ─── Early seeds: the cost table follows the specialist's components table ─── */

function inventoryAreaSqm(l: CostSeedInventoryLine): number {
  return Number(String(l.areaSqm ?? "0").replace(",", ".")) || 0;
}

const AREA_EPSILON = 0.005;

export type CostInventoryAreaChange = {
  lineId: string;
  inventoryLineId: string;
  label: string;
  fromSqm: number;
  toSqm: number;
};

export type CostInventoryDrift = {
  /** Inventory rows (with an id) no cost line points at yet. */
  added: CostSeedInventoryLine[];
  /** Cost lines whose inventory row is gone — reported only, never removed automatically. */
  removed: ValuationCostLineDto[];
  /** Linked lines whose quantity differs from the inventory row. */
  changedArea: CostInventoryAreaChange[];
  hasDrift: boolean;
};

/**
 * How the cost draft has drifted from the specialist's components table. Only lines linked by
 * `sourceInventoryLineId` can be compared; inventory rows without an id and cost lines the
 * appraiser added himself (no link) never count as drift.
 */
export function costInventoryDrift(
  lines: readonly ValuationCostLineDto[],
  inventoryLines: readonly CostSeedInventoryLine[],
): CostInventoryDrift {
  const inventoryById = new Map<string, CostSeedInventoryLine>();
  for (const inv of inventoryLines) {
    const id = inv.id?.trim();
    if (id) inventoryById.set(id, inv);
  }
  const linked = new Set<string>();
  const removed: ValuationCostLineDto[] = [];
  const changedArea: CostInventoryAreaChange[] = [];
  for (const line of lines) {
    const sourceId = line.sourceInventoryLineId?.trim();
    if (!sourceId) continue;
    linked.add(sourceId);
    const inv = inventoryById.get(sourceId);
    if (!inv) {
      removed.push(line);
      continue;
    }
    const toSqm = inventoryAreaSqm(inv);
    if (Math.abs(toSqm - (line.areaSqm ?? 0)) > AREA_EPSILON) {
      changedArea.push({
        lineId: line.id,
        inventoryLineId: sourceId,
        label: line.label || inv.label,
        fromSqm: line.areaSqm ?? 0,
        toSqm,
      });
    }
  }
  const added = [...inventoryById.values()].filter(
    (inv) => !linked.has(inv.id!.trim()),
  );
  return {
    added,
    removed,
    changedArea,
    hasDrift: added.length + removed.length + changedArea.length > 0,
  };
}

/**
 * A draft nobody has worked on: lines exist, every one came from the inventory, and no unit cost,
 * rationale or exclusion was entered. Safe to rebuild from the inventory without asking.
 */
export function isUntouchedCostSeed(
  lines: readonly ValuationCostLineDto[],
): boolean {
  return (
    lines.length > 0 &&
    lines.every(
      (l) =>
        Boolean(l.sourceInventoryLineId?.trim()) &&
        (l.unitCostSar ?? 0) === 0 &&
        !(l.rationale ?? "").trim() &&
        l.isIncluded !== false,
    )
  );
}

/** Rebuilds an untouched seed from the current inventory, keeping the ids of lines that still match. */
export function reseedUntouchedCostLines(
  lines: readonly ValuationCostLineDto[],
  inventoryLines: readonly CostSeedInventoryLine[],
): ValuationCostLineDto[] {
  const idBySource = new Map<string, string>();
  for (const l of lines) {
    const source = l.sourceInventoryLineId?.trim();
    if (source) idBySource.set(source, l.id);
  }
  return costLinesFromInventory([...inventoryLines]).map((l) => {
    const keep = l.sourceInventoryLineId
      ? idBySource.get(l.sourceInventoryLineId.trim())
      : undefined;
    return keep ? { ...l, id: keep } : l;
  });
}

/** Appends the inventory rows that have no cost line yet — nothing already entered is touched. */
export function appendNewInventoryLines(
  lines: readonly ValuationCostLineDto[],
  added: readonly CostSeedInventoryLine[],
): ValuationCostLineDto[] {
  if (added.length === 0) return [...lines];
  const seeded = costLinesFromInventory([...added]).map((l, i) => ({
    ...l,
    sortOrder: lines.length + i,
  }));
  return [...lines, ...seeded];
}

/** Takes the inventory's quantity for the changed lines; `unitCostSar` and everything else stay. */
export function applyInventoryAreaChanges(
  lines: readonly ValuationCostLineDto[],
  changes: readonly CostInventoryAreaChange[],
): ValuationCostLineDto[] {
  if (changes.length === 0) return [...lines];
  const toById = new Map(changes.map((c) => [c.lineId, c.toSqm]));
  return lines.map((l) =>
    toById.has(l.id) ? { ...l, areaSqm: toById.get(l.id)! } : l,
  );
}

export function blankCostLine(
  sortOrder: number,
  partial: Partial<ValuationCostLineDto>,
): ValuationCostLineDto {
  return {
    id: createClientId("cost"),
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

function justifiedBullet(label: string, rationale: string): string | null {
  const just = rationale.trim();
  if (!just) return null;
  return `• ${label} — ${just}`;
}

function narrativeSection(
  title: string,
  lines: Array<string | null>,
): string | null {
  const bullets = lines.filter((line): line is string => Boolean(line));
  if (!bullets.length) return null;
  return `${title}\n${bullets.join("\n")}`;
}

/** Auto cost analysis — only lines with a written justification, same as market. */
export function buildCostNarrative(
  fields: CostApproachFields,
  costDraft: ValuationCostLineDto[],
  costBasisKey: string,
): string {
  const restrictionJust = fields.useRestrictionRationale.trim();
  return [
    `طريقة التكلفة: ${costBasisKey === "reproduction" ? "إعادة الإنتاج" : "الإحلال"}.`,
    restrictionJust
      ? `خصم تقييد الاستخدام: ${fields.useRestrictionPct}٪ — ${restrictionJust}.`
      : null,
    narrativeSection(
      "مبررات بنود التكلفة:",
      costDraft
        .filter((l) => l.label.trim() || l.itemKey !== "custom")
        .map((l) => justifiedBullet(costItemLabel(l), l.rationale)),
    ),
    narrativeSection("مبررات النسب غير المباشرة:", [
      ...INDIRECT_COST_ITEMS.map((item) =>
        justifiedBullet(
          `${item.label} (${fields.indirectDraft[item.key]?.pct ?? "0"}٪)`,
          fields.indirectDraft[item.key]?.rationale ?? "",
        ),
      ),
      `• التمويل — معدل ${fields.financingRate}٪ سنوياً على ${fields.financingMonths} شهراً بمتوسط سحب ٥٠٪`,
    ]),
    narrativeSection("مبررات العمر والتقادم:", [
      justifiedBullet(
        `العمر الفعلي (${fields.actualAge || "—"})`,
        fields.actualAgeRationale,
      ),
      justifiedBullet(
        `العمر الاقتصادي (${fields.economicAge || "—"})`,
        fields.economicAgeRationale,
      ),
      justifiedBullet(
        `تمديد العمر (${fields.lifeExtension || "0"})`,
        fields.lifeExtensionBasis,
      ),
      justifiedBullet(
        `التقادم الوظيفي (${fields.functionalObs || "0"}٪)`,
        fields.functionalObsRationale,
      ),
      justifiedBullet(
        `التقادم الخارجي (${fields.externalObs || "0"}٪)`,
        fields.externalObsRationale,
      ),
    ]),
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
