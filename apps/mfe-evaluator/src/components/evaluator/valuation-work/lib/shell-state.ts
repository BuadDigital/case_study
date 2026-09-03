/**
 * Pure state helpers behind `ValuationWorkShell` — screen identity, the nav
 * model, the auto-generated adjustments narrative, the difference-factor
 * catalog projection and the small parsing utilities the workflow
 * hooks share. No React, no I/O.
 */
import type {
  DifferenceFactorDefinitionDto,
  ValuationApproachSettingsDto,
  ValuationComparableSelectionDto,
} from "@platform/api-client";
import {
  DEFAULT_DIFFERENCE_KEYS,
  type lineForSave,
} from "./market-save-mappers";

export const LAND_WITHIN_COST = "land_within_cost";
export const MARKET_CONTEXT = "market";
/** Interactive-form spec: “N of 5 adopted”. */
export const MAX_ADOPTED_COMPARABLES = 5;

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

export type ValuationWorkNavItem = {
  id: ValuationWorkScreenId;
  label: string;
  badge?: number;
  show: boolean;
};

/** Arabic decimal comma is accepted everywhere a number is typed. */
export function parseDecimal(raw: string | number): number {
  return Number(String(raw).replace(",", "."));
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
export function buildFactorCatalog(factors: DifferenceFactorDefinitionDto[]): {
  definitions: Record<string, string>;
  addable: { factorKey: string; labelAr: string }[];
} {
  const definitions: Record<string, string> = {};
  const addable: { factorKey: string; labelAr: string }[] = [];
  for (const f of factors) {
    if (!f.isActive) continue;
    definitions[f.key] = f.excludesAr
      ? `${f.definitionAr}\nلا يشمل: ${f.excludesAr}`
      : f.definitionAr;
    if (!DEFAULT_DIFFERENCE_KEYS.has(f.key) && f.key !== "area") {
      addable.push({ factorKey: f.key, labelAr: f.labelAr });
    }
  }
  return { definitions, addable };
}

/**
 * Interactive-form spec (buildNarrative): adjustments analysis text is generated from factor
 * justifications (“not justified” when empty) until the appraiser edits it manually.
 */
export function buildAutoNarrative(
  adopted: ValuationComparableSelectionDto[],
  factorRows: { factorKey: string; labelAr: string }[],
): string {
  if (!adopted.length) {
    return "لم تُعتمد أي مقارنة بعد؛ يلزم اعتماد مقارن واحد على الأقل لتكوين رأي القيمة.";
  }
  const first = adopted[0]?.market?.adjustmentLines ?? [];
  const bullets: string[] = [];
  for (const f of factorRows) {
    const line = first.find((l) => l.factorKey === f.factorKey);
    const just = (line?.rationale ?? "").trim();
    bullets.push(`• ${f.labelAr || f.factorKey} — ${just || "لم يتم تبريره"}`);
  }
  const weightJust = (
    adopted[0]?.market?.weightOverrideRationale ?? ""
  ).trim();
  bullets.push(`• الوزن النسبي — ${weightJust || "لم يتم تبريره"}`);
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
    id: crypto.randomUUID(),
    factorKey,
    labelAr,
    percent: 0,
    rationale: "",
    descriptionAr: null,
    isIncluded: true,
    sortOrder,
  };
}

/** One-shot key so the far-comparable auto-unadopt does not loop on the same set. */
export function farUnadoptSignature(
  requestId: string,
  farMarket: ValuationComparableSelectionDto[],
  farLand: ValuationComparableSelectionDto[],
): string {
  const ids = (items: ValuationComparableSelectionDto[]) =>
    items
      .map((i) => i.comparablePropertyId)
      .sort()
      .join(",");
  return `${requestId}:m${ids(farMarket)}:l${ids(farLand)}`;
}
