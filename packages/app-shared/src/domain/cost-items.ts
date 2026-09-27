/**
 * Direct-cost item catalog («بنود التكلفة المباشرة»). Shared by the appraiser's cost table
 * and the case specialist's «جدول المكونات» — the specialist lists the items, the appraiser
 * prices them, so both must speak the same keys and units.
 */

export const COST_ITEM_OPTIONS: { key: string; label: string; unit: string }[] = [
  { key: "basement", label: "القبو", unit: "sqm" },
  { key: "ground_floor", label: "الدور الأرضي", unit: "sqm" },
  { key: "first_floor", label: "الدور الأول", unit: "sqm" },
  { key: "repeated_floors", label: "الأدوار المتكررة", unit: "sqm" },
  { key: "upper_annex", label: "الملحق العلوي", unit: "sqm" },
  { key: "lower_annex", label: "الملحق الأرضي", unit: "sqm" },
  { key: "apartment_area", label: "مساحة الشقة", unit: "sqm" },
  { key: "shared_portion", label: "حصة المشترك من المبنى", unit: "sqm" },
  { key: "parking", label: "المواقف", unit: "count" },
  { key: "fence", label: "السور", unit: "lm" },
  { key: "pool", label: "المسبح", unit: "lump" },
  { key: "central_ac", label: "التكييف المركزي", unit: "lump" },
  { key: "elevator", label: "المصعد", unit: "count" },
  { key: "landscaping", label: "تشجير وتنسيق الموقع", unit: "lump" },
  { key: "tanks_pumps", label: "خزانات ومضخات", unit: "lump" },
  { key: "electromechanical", label: "أعمال كهروميكانيكية", unit: "lump" },
  { key: "custom", label: "بند مخصص", unit: "sqm" },
];

export const COST_UNIT_OPTIONS = [
  { key: "sqm", label: "م²" },
  { key: "lm", label: "م.ط" },
  { key: "count", label: "عدد" },
  { key: "lump", label: "مقطوع" },
];

/** Group 1 — building floor areas (accepts built-up ratio; included in building areas). */
export const COST_GROUP1_KEYS = new Set([
  "basement",
  "ground_floor",
  "first_floor",
  "repeated_floors",
  "upper_annex",
  "lower_annex",
  "apartment_area",
  "shared_portion",
]);

export function costItemLabel(key: string | null | undefined): string {
  return COST_ITEM_OPTIONS.find((o) => o.key === key)?.label ?? "";
}

export function costUnitLabel(key: string | null | undefined): string {
  return COST_UNIT_OPTIONS.find((o) => o.key === (key || "sqm"))?.label ?? "م²";
}

/**
 * Inventory `structureKind` for a catalog item — keeps the report's floor/annex/basement
 * grouping and the cost table's area/extra grouping in step.
 */
export function structureKindForCostItem(itemKey: string | null | undefined): string {
  switch (itemKey) {
    case "basement":
      return "basement";
    case "fence":
      return "fence";
    case "upper_annex":
    case "lower_annex":
      return "annex";
    default:
      return itemKey && COST_GROUP1_KEYS.has(itemKey) ? "floor" : "other";
  }
}
