import type {
  SaveValuationComparableMarketRequest,
  ValuationComparableAdjustmentLineDto,
  ValuationComparableSelectionDto,
} from "@platform/api-client";

export const SEQUENTIAL_KEYS = new Set(["financing", "market", "transaction_type"]);
export const AUTO_AREA_KEYS = new Set(["area"]);
export const DEFAULT_DIFFERENCE_KEYS = new Set([
  "ideal_area",
  "location",
  "attraction",
  "access",
  "street_count",
  "street_lengths",
]);

export const STANDARD_FACTORS: { factorKey: string; labelAr: string }[] = [
  { factorKey: "financing", labelAr: "تسوية شروط التمويل" },
  { factorKey: "market", labelAr: "تسوية ظروف السوق" },
  { factorKey: "transaction_type", labelAr: "تسوية نوع المقارن" },
  { factorKey: "area", labelAr: "المساحة" },
  { factorKey: "ideal_area", labelAr: "المساحة المثالية" },
  { factorKey: "location", labelAr: "الموقع" },
  { factorKey: "attraction", labelAr: "عامل الجذب للموقع" },
  { factorKey: "access", labelAr: "سهولة الوصول" },
  { factorKey: "street_count", labelAr: "عدد الشوارع" },
  { factorKey: "street_lengths", labelAr: "أطوال الشوارع" },
];

export function buildFactorRows(
  adopted: ValuationComparableSelectionDto[],
): { factorKey: string; labelAr: string }[] {
  // الصفوف من البيانات الفعلية — بند تسلسلي محذوف (تمويل/نوع) يبقى محذوفاً
  // حتى تستعيده شريحة «↺ استعادة»، ولا يُعاد فرضه هنا.
  const map = new Map<string, string>();
  const first = adopted[0]?.market?.adjustmentLines;
  if (first?.length) {
    for (const line of first) {
      map.set(
        line.factorKey,
        line.labelAr ||
          STANDARD_FACTORS.find((f) => f.factorKey === line.factorKey)?.labelAr ||
          line.factorKey,
      );
    }
  } else {
    for (const f of STANDARD_FACTORS) map.set(f.factorKey, f.labelAr);
  }
  for (const item of adopted) {
    for (const line of item.market?.adjustmentLines ?? []) {
      if (!map.has(line.factorKey)) map.set(line.factorKey, line.labelAr);
    }
  }
  return Array.from(map.entries()).map(([factorKey, labelAr]) => ({
    factorKey,
    labelAr,
  }));
}

export function linePercent(
  item: ValuationComparableSelectionDto,
  factorKey: string,
): number {
  const line = item.market?.adjustmentLines?.find((l) => l.factorKey === factorKey);
  if (line) return line.percent;
  if (factorKey === "area") return item.market?.suggestedAreaAdjustmentPct ?? 0;
  return 0;
}

export function ensureLinesForSave(
  item: ValuationComparableSelectionDto,
  factorKey: string,
  percent: number,
  factors: { factorKey: string; labelAr: string }[],
): ValuationComparableAdjustmentLineDto[] {
  const existing = item.market?.adjustmentLines ?? [];
  const byKey = new Map(existing.map((l) => [l.factorKey, { ...l }]));
  for (const f of factors) {
    if (!byKey.has(f.factorKey)) {
      byKey.set(f.factorKey, {
        id: crypto.randomUUID(),
        factorKey: f.factorKey,
        labelAr: f.labelAr,
        percent: f.factorKey === "area" ? (item.market?.suggestedAreaAdjustmentPct ?? 0) : 0,
        rationale: "",
        isIncluded: true,
        sortOrder: byKey.size,
      });
    }
  }
  const target = byKey.get(factorKey);
  if (target) {
    target.percent =
      factorKey === "area"
        ? (item.market?.suggestedAreaAdjustmentPct ?? percent)
        : percent;
    target.isIncluded = true;
    // الإدخال الصريح يلغي حالة «مقترح» لهذا البند.
    target.isSuggestedValue = false;
  }
  return Array.from(byKey.values()).map((l, i) => ({ ...l, sortOrder: i }));
}

/**
 * تجهيز سطر تسوية للحفظ: المساحة تُثبَّت على المقترح الآلي، والقيم «المقترحة»
 * (نوع المقارن غير المُدخل) تُعاد صفراً حتى لا يتحول المقترح إلى إدخال يدوي دائم.
 */
export function lineForSave(
  item: ValuationComparableSelectionDto,
  l: ValuationComparableAdjustmentLineDto,
  i: number,
) {
  return {
    id: l.id,
    factorKey: l.factorKey,
    labelAr: l.labelAr,
    percent:
      l.factorKey === "area"
        ? (item.market?.suggestedAreaAdjustmentPct ?? l.percent)
        : l.isSuggestedValue
          ? 0
          : l.percent,
    rationale: l.rationale,
    descriptionAr: l.descriptionAr ?? null,
    isIncluded: l.isIncluded,
    sortOrder: i,
  };
}

/** جسم حفظ التسويات مع الحفاظ على الوزن وتجاوزات compEdit الحالية. */
export function marketSaveBody(
  item: ValuationComparableSelectionDto,
  lines: ReturnType<typeof lineForSave>[],
  extra?: Partial<SaveValuationComparableMarketRequest>,
) {
  return {
    adjustmentLines: lines,
    weightIsManual: item.market?.weightIsManual ?? false,
    weightPct: item.market?.weightIsManual ? item.market.weightPct ?? null : null,
    weightOverrideRationale: item.market?.weightOverrideRationale ?? null,
    areaAdjustmentMethod: item.market?.areaAdjustmentMethod ?? null,
    priceOverrideSar: item.priceOverrideSar ?? null,
    areaOverrideSqm: item.areaOverrideSqm ?? null,
    ...extra,
  };
}
