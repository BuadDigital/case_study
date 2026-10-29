/**
 * Pure state helpers behind `ValuationWorkShell` — screen identity, the nav
 * model, the auto-generated adjustments narrative and the small parsing
 * utilities the workflow hooks share. No React, no I/O.
 */
import type {
  ValuationApproachSettingsDto,
  ValuationComparableSelectionDto,
} from "@platform/api-client";
import { parseLocaleNumber } from "@platform/app-shared/format/number";
import { factorIncludedByDefault } from "./factor-registry";
import { type lineForSave } from "./market-save-mappers";

export const LAND_WITHIN_COST = "land_within_cost";
export const MARKET_CONTEXT = "market";

export type ValuationWorkScreenId =
  | "basic"
  | "market"
  | "cost"
  | "final"
  | "review";

export type ValuationWorkNavAvailability = {
  market: boolean;
  cost: boolean;
};

export type ValuationWorkPropertyHint = {
  area?: string;
  district?: string;
  city?: string;
  deedNumber?: string;
  propertyType?: string;
  classification?: string | null;
};

type ValuationWorkNavItem = {
  id: ValuationWorkScreenId;
  label: string;
  badge?: number;
  show: boolean;
};

/**
 * Typed number → value via the shared locale rule ("1,250" → 1250, "12,5" → 12.5,
 * Arabic digits, units). Blank stays 0 as callers have always relied on; junk is NaN.
 */
export function parseDecimal(raw: string | number): number {
  if (typeof raw === "string" && raw.trim() === "") return 0;
  return parseLocaleNumber(raw);
}

/** Official valuation date from saved settings — not from unsaved drafts. */
export function officialValuationDateOf(
  settings: ValuationApproachSettingsDto | null,
): string | null {
  if (settings?.valuationDateMode !== "retrospective") return null;
  const start = settings.retrospectiveDate?.trim();
  if (!start) return null;
  const end = settings.retrospectiveDateEnd?.trim();
  return end ? `${start} — ${end}` : start;
}

/** Split the server catalog into tooltip definitions and the “add factor” menu. */

/**
 * Interactive-form spec (buildNarrative): adjustments analysis lists only written
 * factor justifications until the appraiser edits it manually. Empty factors are omitted.
 * The factor-level justification (مبرر التسوية) lives in its own per-request table,
 * not on the adjustment line — same precedence as `useAdjustmentsMatrixModel.justValue`. The
 * per-comparable line rationale is a back-compat/override fallback only.
 */
/** Former demo seed filler — never treat as a real manual narrative. */
export const SEED_MARKET_ANALYSIS_NOTES =
  "بيانات تجريبية — بنك المقارنات وجدول التسويات من تصميم طريقة المقارنة.";

export function isSeedMarketAnalysisNotes(text: string | null | undefined): boolean {
  return (text ?? "").trim() === SEED_MARKET_ANALYSIS_NOTES;
}

export function buildAutoNarrative(
  adopted: ValuationComparableSelectionDto[],
  factorRows: { factorKey: string; labelAr: string }[],
  factorRationales?: { factorKey: string; rationaleAr: string }[],
): string {
  if (!adopted.length) {
    return "لم تُعتمد أي مقارنة بعد؛ يلزم اعتماد مقارن واحد على الأقل لتكوين رأي القيمة.";
  }
  const rationaleByKey = new Map(
    (factorRationales ?? []).map((r) => [r.factorKey, r.rationaleAr]),
  );
  const first = adopted[0]?.market?.adjustmentLines ?? [];
  const bullets: string[] = [];
  for (const f of factorRows) {
    const line = first.find((l) => l.factorKey === f.factorKey);
    const just = (rationaleByKey.get(f.factorKey) ?? line?.rationale ?? "").trim();
    if (!just) continue;
    bullets.push(`• ${f.labelAr || f.factorKey} — ${just}`);
  }
  const weightJust = (
    rationaleByKey.get("weight") ??
    adopted[0]?.market?.weightOverrideRationale ??
    ""
  ).trim();
  if (weightJust) {
    bullets.push(`• الوزن النسبي — ${weightJust}`);
  }
  if (bullets.length === 0) return "مبررات التسويات:";
  return `مبررات التسويات:\n${bullets.join("\n")}`;
}

export function buildNavItems({
  marketEnabled,
  costEnabled,
  adoptedMarketCount,
}: {
  marketEnabled: boolean;
  costEnabled: boolean;
  adoptedMarketCount: number;
}): ValuationWorkNavItem[] {
  return [
    { id: "basic", label: "البيانات الأساسية", show: true },
    {
      id: "market",
      label: "طريقة المقارنة",
      badge: adoptedMarketCount || undefined,
      show: marketEnabled,
    },
    { id: "cost", label: "طريقة المقاول", show: costEnabled },
    { id: "final", label: "رأي القيمة النهائي", show: true },
    { id: "review", label: "المراجعة النهائية", show: true },
  ];
}

/** Active screen is derived during render — hiding an approach moves selection immediately. */
export function resolveEffectiveScreen(
  navItems: ValuationWorkNavItem[],
  screen: ValuationWorkScreenId,
): ValuationWorkScreenId {
  const visible = navItems.filter((n) => n.show).map((n) => n.id);
  return visible.includes(screen) ? screen : (visible[0] ?? "basic");
}

/** A fresh adjustment line at 0% — restored sequential items and added factors share it. */
export function newAdjustmentLine(
  factorKey: string,
  labelAr: string,
  sortOrder: number,
): ReturnType<typeof lineForSave> {
  return {
    id: null,
    factorKey,
    labelAr,
    percent: 0,
    rationale: "",
    descriptionAr: null,
    isIncluded: factorIncludedByDefault(factorKey),
    sortOrder,
  };
}
