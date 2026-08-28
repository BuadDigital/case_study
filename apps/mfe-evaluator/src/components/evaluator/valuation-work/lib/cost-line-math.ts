import type { ValuationCostLineDto } from "@platform/api-client";

export const INDIRECT_COST_ITEMS: { key: string; label: string }[] = [
  { key: "design_supervision", label: "التصميم والإشراف الهندسي" },
  { key: "licensing_fees", label: "الترخيص والرسوم الحكومية" },
  { key: "project_management", label: "إدارة المشروع" },
  { key: "utilities_connection", label: "توصيل الخدمات" },
  { key: "contingency", label: "مخصص الطوارئ" },
  { key: "developer_profit", label: "أرباح المطور والمخاطرة" },
];

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

/** مجموعة ١ — مسطحات المبنى والأدوار (تقبل نسبة البناء وتدخل في مسطحات البناء). */
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

export function costGroupOf(line: ValuationCostLineDto): "area" | "extra" {
  // بند مخصص يرث مجموعته من structureKind (floor = مسطحات) — كما في النموذج التفاعلي.
  if (line.itemKey === "custom") {
    return line.structureKind === "floor" ? "area" : "extra";
  }
  return COST_GROUP1_KEYS.has(line.itemKey) ? "area" : "extra";
}

/**
 * حساب البند محلياً بقواعد النموذج التفاعلي: الأدوار المتكررة تُشتق من مسطح الدور
 * الأول × العدد وترث سعر متره عند تركه فارغاً؛ نسبة البناء تُطبَّق على بنود م².
 */
export function costLineComputed(
  line: ValuationCostLineDto,
  all: ValuationCostLineDto[],
  // null = «معروف أنه غائب» — يوفّر find لكل بند حين يمرره المستدعي (js-perf).
  firstFloorHint?: ValuationCostLineDto | null,
) {
  const firstFloor =
    firstFloorHint === undefined
      ? all.find((l) => l.itemKey === "first_floor")
      : (firstFloorHint ?? undefined);
  const isRepeated = line.itemKey === "repeated_floors";
  const isLump = (line.unit || "sqm") === "lump";
  const base = isRepeated
    ? (firstFloor?.areaSqm ?? 0) * Math.max(0, line.repeatedFloorCount ?? 0)
    : line.areaSqm;
  const inArea = costGroupOf(line) === "area";
  const bp = line.buildRatioPct;
  const usesPct = inArea && (line.unit || "sqm") === "sqm";
  const qty =
    usesPct && bp != null && Number.isFinite(bp)
      ? (base * Math.min(Math.max(bp, 0), 100)) / 100
      : base;
  const inherited =
    isRepeated && (!line.unitCostSar || line.unitCostSar <= 0) &&
    (firstFloor?.unitCostSar ?? 0) > 0;
  const uc = inherited ? firstFloor!.unitCostSar : Math.max(0, line.unitCostSar);
  return {
    qty,
    uc,
    total: line.isIncluded !== false ? qty * uc : 0,
    rawTotal: qty * uc,
    inherited,
    isRepeated,
    isLump,
    inArea,
    usesPct,
  };
}
