import { stripArabicAl } from "./courts/circuit-search";

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

/** Leading words of a building-area name, by inventory kind (compared without «ال» and hamza forms). */
const AREA_NAME_FIRST_WORDS: Record<"floor" | "annex" | "basement", readonly string[]> = {
  floor: [
    "دور", "ادوار", "طابق", "طوابق", "ميزانين", "ميزانيين", "مزانين",
    "ارضي", "علوي", "اول", "ثاني", "ثالث", "رابع", "خامس", "سادس", "سابع", "ثامن", "تاسع", "عاشر",
    // a unit's or a building's own floor area: «مساحة المحل», «المكتب», «معرض», «المستودع»…
    "محل", "مكتب", "معرض", "وحده", "شقه", "مستودع", "هنجر", "ورشه", "مصنع",
  ],
  annex: ["ملحق", "ملاحق", "سطح"],
  basement: ["قبو", "بدروم", "سرداب"],
};

/** Words that may come before the area name: «مسطح الدور الثاني», «مساحة المحل». */
const AREA_NAME_PREFIXES = new Set(["مسطح", "مسطحات", "مساحه"]);

/**
 * The inventory kind a typed item name means when it names a building area: a floor
 * («الدور الثاني», «طابق ثالث», «الميزانين», «مساحة المحل»), an annex («ملحق علوي», «ملحق السطح»)
 * or a basement («البدروم»); null for anything else («غرفة حارس», «مظلة سيارات», «المسبح»).
 *
 * How it works: the name is normalized with `stripArabicAl` (Arabic digits, hamza / taa marbuta /
 * alef maqsura forms and every word's «ال» dropped); after an optional «مسطح / مساحة» its first
 * word is looked up in `AREA_NAME_FIRST_WORDS`.
 *
 * Edge cases: whole-word match only — «دورة مياه», «مكتبة» and «عزل السطح» are not areas. Fixed
 * 2026-11-04 (A→Z #30/#52/#65/#90): names outside the catalog («ملحق علوي» without «ال»,
 * «الدور الثاني», «الميزانين») fell into «تكاليف وتجهيزات إضافية», demanded a rationale and dropped
 * out of «مجموع مسطحات البناء». Mirrors `CostLineItemKeys.AreaKindForName` on the server.
 */
export function areaKindForItemName(
  name: string | null | undefined,
): "floor" | "annex" | "basement" | null {
  const words = stripArabicAl(name ?? "").split(" ").filter(Boolean);
  const first = words[0] && AREA_NAME_PREFIXES.has(words[0]) ? words[1] : words[0];
  if (!first) return null;
  for (const kind of ["floor", "annex", "basement"] as const) {
    if (AREA_NAME_FIRST_WORDS[kind].includes(first)) return kind;
  }
  return null;
}

/**
 * Catalog item whose Arabic name was typed instead of picked: «سور», «ملحق علوي», «دور ارضي»
 * mean «السور», «الملحق العلوي», «الدور الأرضي».
 *
 * How it works: both names are compared after `stripArabicAl` (no «ال», no hamza / spacing
 * variants); «بند مخصص» never matches.
 *
 * Edge cases: fixed 2026-11-04 (A→Z #30/#34): only the exact catalog spelling matched, so «سور»
 * kept «م²» instead of «م.ط» and «ملحق علوي» became a custom extra.
 */
export function costItemForTypedName(text: string | null | undefined) {
  const typed = stripArabicAl(text ?? "");
  if (!typed) return undefined;
  return COST_ITEM_OPTIONS.find((o) => o.key !== "custom" && stripArabicAl(o.label) === typed);
}

/**
 * The inventory kind a line really has: a custom line saved as «other» (or with no kind) whose
 * name is a building area counts as that floor / annex / basement.
 *
 * How it works: catalog items and lines with an explicit floor / annex / basement / fence kind
 * keep their kind; a custom «other» line takes `areaKindForItemName(label)` when it names an area.
 *
 * Edge cases: lines saved before 2026-11-04 («الدور الثاني», «ملحق علوي», «الميزانين» stored as
 * custom «other») are read right without re-saving the inventory.
 */
export function effectiveStructureKind(line: {
  itemKey?: string | null;
  structureKind?: string | null;
  label?: string | null;
}): string {
  const kind = (line.structureKind ?? "").trim().toLowerCase();
  const key = (line.itemKey ?? "").trim() || "custom";
  if (key !== "custom" || (kind && kind !== "other")) return kind || "other";
  return areaKindForItemName(line.label) ?? "other";
}

const AREA_STRUCTURE_KINDS = new Set(["floor", "annex", "basement"]);

/**
 * Which group of the cost table a line sits in: «مسطحات المبنى والأدوار» (area) or «تكاليف
 * وتجهيزات إضافية» (extra).
 *
 * How it works: a catalog item is in the area group when its key is in COST_GROUP1_KEYS; a custom
 * line is an area line when its effective kind (`effectiveStructureKind`: its saved kind, or what
 * its name says) is a floor, an annex or a basement — anything else is an extra.
 *
 * Edge cases: moved here from the appraiser's cost screen so the printed report lists the lines in
 * the same two groups, in the same order, as the screen. Fixed 2026-11-04 (A→Z #30/#52/#65/#90):
 * a custom line counted only with kind «floor», so «الدور الثاني» / «ملحق علوي» / «الميزانين»
 * (saved as «other») and custom annexes / basements went to the extras and demanded a rationale.
 * Mirrors `CostLineItemKeys.IsAreaGroup` on the server.
 */
export function costGroupOf(line: {
  itemKey?: string | null;
  structureKind?: string | null;
  label?: string | null;
}): "area" | "extra" {
  if (line.itemKey === "custom") {
    return AREA_STRUCTURE_KINDS.has(effectiveStructureKind(line)) ? "area" : "extra";
  }
  return COST_GROUP1_KEYS.has(line.itemKey ?? "") ? "area" : "extra";
}

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
