import type { ValuationCostLineDto } from "@platform/api-client";
import { costGroupOf } from "@platform/app-shared/domain/cost-items";

export const INDIRECT_COST_ITEMS: { key: string; label: string }[] = [
  { key: "design_supervision", label: "التصميم والإشراف الهندسي" },
  { key: "licensing_fees", label: "الترخيص والرسوم الحكومية" },
  { key: "project_management", label: "إدارة المشروع" },
  { key: "utilities_connection", label: "توصيل الخدمات" },
  { key: "contingency", label: "مخصص الطوارئ" },
  { key: "developer_profit", label: "أرباح المطور والمخاطرة" },
];

// The item catalog (and its area / extra grouping, which the printed report follows too) is shared
// with the case specialist's «جدول المكونات».
export {
  COST_GROUP1_KEYS,
  COST_ITEM_OPTIONS,
  COST_UNIT_OPTIONS,
  costGroupOf,
} from "@platform/app-shared/domain/cost-items";

/** Built-up ratio counts only on m² lines of the area group — elsewhere it is not stored. */
export function buildRatioApplies(
  line: Pick<ValuationCostLineDto, "itemKey" | "structureKind" | "unit">,
): boolean {
  return costGroupOf(line) === "area" && (line.unit || "sqm") === "sqm";
}

/**
 * Local line math per interactive-form rules: repeated floors derive from first-floor area
 * × count and inherit its unit rate when left empty; built-up ratio applies to m² lines.
 */
export function costLineComputed(
  line: ValuationCostLineDto,
  all: ValuationCostLineDto[],
  // null = “known absent” — skips find-per-line when the caller passes it (js-perf).
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
  const usesPct = buildRatioApplies(line);
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
