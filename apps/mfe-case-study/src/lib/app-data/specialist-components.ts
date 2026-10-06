/**
 * «مكونات العقار» (pure helpers). Two parts with two owners:
 * - the report text is the case specialist's (his own text, printed as «وصف العقار»);
 * - the inventory table «جدول الحصر» is the inspector's (the specialist may correct it) and
 *   is mandatory for anything with buildings or annexes worth valuing (a land asset only when
 *   the inspector said it holds such structures).
 * The table uses the appraiser's direct-cost catalog so its lines drop straight into
 * «بنود التكلفة المباشرة»; see `SpecialistComponentsRules` on the server.
 */
import type { BuildingInventoryDto, BuildingInventoryLineDto } from "@platform/api-client";
import { textLooksLikeVacantLand } from "@platform/app-shared/app-data/inspector-workspace-data";
import {
  COST_GROUP1_KEYS,
  COST_ITEM_OPTIONS,
  costItemLabel,
  structureKindForCostItem,
} from "@platform/app-shared/domain/cost-items";

export const SPECIALIST_COMPONENTS_TEXT_REQUIRED =
  "اكتب «مكونات العقار» للتقرير قبل قبول المعاينة";

export const SPECIALIST_COMPONENTS_TABLE_REQUIRED =
  "جدول الحصر إلزامي للمباني والملاحق (وللأرض التي فيها مبانٍ تستحق التقييم) قبل قبول المعاينة";

/** Specialist-side hint under the inventory table: when it is mandatory. */
export const SPECIALIST_COMPONENTS_TABLE_HINT =
  "جدول الحصر إلزامي لكل عقار فيه مبانٍ أو ملاحق، وللأرض إن أفاد المعاين بوجود مبانٍ أو ملاحق تستحق التقييم؛ وإن كانت الملاحق لا تدخل في التقييم فتُوصف في حقل وصف العقار فقط.";

export function emptyComponentLine(sortOrder: number): BuildingInventoryLineDto {
  return {
    sortOrder,
    itemKey: "",
    structureKind: "floor",
    label: "",
    areaSqm: "",
    unit: "sqm",
    buildRatioPct: null,
    repeatedFloorCount: null,
    notes: "",
  };
}

/** Picking a catalog item sets its unit, inventory kind and (for non-custom items) its label. */
export function componentLineForItem(
  line: BuildingInventoryLineDto,
  itemKey: string,
): BuildingInventoryLineDto {
  const option = COST_ITEM_OPTIONS.find((o) => o.key === itemKey);
  const isCustom = itemKey === "custom";
  return {
    ...line,
    itemKey,
    unit: option?.unit ?? line.unit ?? "sqm",
    structureKind: structureKindForCostItem(itemKey),
    label: isCustom ? (line.itemKey === "custom" ? line.label : "") : (option?.label ?? line.label),
    buildRatioPct: COST_GROUP1_KEYS.has(itemKey) ? line.buildRatioPct ?? null : null,
    repeatedFloorCount: itemKey === "repeated_floors" ? line.repeatedFloorCount ?? null : null,
  };
}

/** Catalog item whose Arabic name the specialist typed (ignores spacing / alef-hamza variants). */
export function catalogItemForTypedName(text: string) {
  const norm = (v: string) => v.replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/\s+/g, " ").trim();
  const typed = norm(text);
  if (!typed) return undefined;
  return COST_ITEM_OPTIONS.find((o) => o.key !== "custom" && norm(o.label) === typed);
}

/**
 * The specialist types the item name instead of picking it: an exact catalog name keeps the
 * catalog behaviour (unit, floor/annex kind, built-up ratio, repeated floors — what Infath areas
 * and the appraiser's cost table key on); anything else is a custom item that keeps its unit.
 */
export function componentLineForTypedName(
  line: BuildingInventoryLineDto,
  text: string,
): BuildingInventoryLineDto {
  const match = catalogItemForTypedName(text);
  if (match) {
    return match.key === line.itemKey
      ? { ...line, label: text }
      : { ...componentLineForItem(line, match.key), label: text };
  }
  return {
    ...line,
    itemKey: "custom",
    structureKind: line.itemKey === "custom" ? line.structureKind : structureKindForCostItem("custom"),
    label: text,
    buildRatioPct: null,
    repeatedFloorCount: null,
  };
}

export function componentLineAcceptsBuildRatio(line: BuildingInventoryLineDto): boolean {
  return Boolean(line.itemKey && COST_GROUP1_KEYS.has(line.itemKey)) && (line.unit || "sqm") === "sqm";
}

/** Row-level problems the save button reports before calling the server. */
export function componentLinesIssue(lines: BuildingInventoryLineDto[]): string | null {
  for (const [i, line] of lines.entries()) {
    const n = i + 1;
    if (!line.label.trim()) return `اكتب اسم البند في السطر ${n}`;
  }
  return null;
}

/** The inspector's «الأصل محل التقييم» is land (the intake type / classification are not read). */
export function inspectedAssetIsLand(assetSubject: string | null | undefined): boolean {
  return textLooksLikeVacantLand(assetSubject);
}

/**
 * Does the property have buildings or annexes WORTH VALUING that the inventory table must
 * list? Every non-land asset does. An asset the inspector typed «أرض» does only when he
 * explicitly answered «نعم» to «هل في الأرض مبانٍ أو ملاحق تستحق التقييم؟»
 * (`landHasValuableStructures`); «لا», no answer, and a legacy land submission with no such key
 * are exempt (their annexes, if any, are just described in the description field). The intake
 * type / classification are not a declaration and are not read. Mirrors
 * `SpecialistComponentsRules.HasStructures` on the server.
 */
export function inspectionHasStructures(declaration: {
  assetSubject?: string | null;
  landHasValuableStructures?: string | null;
}): boolean {
  if (!inspectedAssetIsLand(declaration.assetSubject)) return true;
  return (declaration.landHasValuableStructures ?? "").trim().toLowerCase() === "yes";
}

/**
 * Mirrors `SpecialistComponentsRules.MissingForAcceptance` — null when the specialist may accept.
 * The report text is always required; the inventory table («جدول الحصر», filled by the
 * inspector) needs at least one line whenever the property has structures.
 */
export function specialistComponentsMissing(
  inventory: Pick<BuildingInventoryDto, "componentsText" | "lines">,
  hasStructures: boolean,
): string | null {
  if (!(inventory.componentsText ?? "").trim()) return SPECIALIST_COMPONENTS_TEXT_REQUIRED;
  if (hasStructures && inventory.lines.length === 0) return SPECIALIST_COMPONENTS_TABLE_REQUIRED;
  return null;
}

/** Display name of a line: catalog label, the custom text, or the legacy free label. */
export function componentLineName(line: BuildingInventoryLineDto): string {
  if (line.itemKey && line.itemKey !== "custom") return costItemLabel(line.itemKey) || line.label;
  return line.label;
}

function num(value: string | null | undefined): number {
  const n = Number.parseFloat(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function fmt(n: number): string {
  return n > 0 ? String(Math.round(n * 100) / 100) : "";
}

/**
 * Infath «مساحات المباني» from the specialist's table (the inspector no longer enters them):
 * built area = floor lines, basement and annex totals by kind, buildings total = all three.
 */
export function infathBuildingAreasFromComponents(lines: BuildingInventoryLineDto[]): {
  builtArea: string;
  buildingFloors: string;
  basementTotal: string;
  annexTotal: string;
  buildingsTotal: string;
} {
  const sqm = lines.filter(
    (l) => (l.unit || "sqm") === "sqm" && l.itemKey !== "repeated_floors",
  );
  const sum = (kind: string) =>
    sqm.filter((l) => l.structureKind === kind).reduce((a, l) => a + num(l.areaSqm), 0);
  const firstFloor = sqm.find((l) => l.itemKey === "first_floor");
  let built = sum("floor");
  let floors = sqm.filter((l) => l.structureKind === "floor").length;
  // «الأدوار المتكررة» repeat the first floor's area (same rule as the appraiser's cost table).
  for (const line of lines.filter((l) => l.itemKey === "repeated_floors")) {
    const count = Math.max(0, line.repeatedFloorCount ?? 0);
    floors += count;
    built += num(firstFloor?.areaSqm) * count;
  }
  const basement = sum("basement");
  const annex = sum("annex");
  return {
    builtArea: fmt(built),
    buildingFloors: floors > 0 ? String(floors) : "",
    basementTotal: fmt(basement),
    annexTotal: fmt(annex),
    buildingsTotal: fmt(built + basement + annex),
  };
}
