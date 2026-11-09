/**
 * «مكونات العقار» (pure helpers). Two parts with two owners:
 * - the report text is the case specialist's (his own text, printed as «وصف العقار»);
 * - the inventory table «جدول الحصر» is the inspector's (the specialist may correct it); it is
 *   shown for anything with buildings or annexes worth valuing (a land asset only when the
 *   inspector said it holds such structures) but is not a condition for accepting the
 *   inspection.
 * The table uses the appraiser's direct-cost catalog so its lines drop straight into
 * «بنود التكلفة المباشرة»; see `SpecialistComponentsRules` on the server.
 */
import { toLatinDigits } from "@platform/ui-kit";
import type { BuildingInventoryDto, BuildingInventoryLineDto } from "@platform/api-client";
import { textLooksLikeVacantLand } from "@platform/app-shared/app-data/inspector-workspace-data";
import { parseLocaleNumber } from "@platform/app-shared/format/number";
import {
  COST_GROUP1_KEYS,
  COST_ITEM_OPTIONS,
  areaKindForItemName,
  costGroupOf,
  costItemForTypedName,
  effectiveStructureKind,
  structureKindForCostItem,
} from "@platform/app-shared/domain/cost-items";

export const SPECIALIST_COMPONENTS_TEXT_REQUIRED =
  "اكتب «مكونات العقار» للتقرير قبل قبول المعاينة";

/** Specialist-side hint under the inventory table: what it is for (it is not a condition). */
export const SPECIALIST_COMPONENTS_TABLE_HINT =
  "يُعدّ لكل عقار فيه مبانٍ أو ملاحق تستحق التقييم، وللأرض إن أفاد المعاين بوجود مبانٍ أو ملاحق تستحق التقييم؛ وإن كانت الملاحق لا تدخل في التقييم فتُوصف في حقل وصف العقار فقط. ليس شرطاً لقبول المعاينة.";

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

/**
 * The specialist (or the inspector) types the item name instead of picking it: a catalog name keeps
 * the catalog behaviour (unit, floor/annex kind, built-up ratio, repeated floors — what Infath areas
 * and the appraiser's cost table key on); anything else is a custom item that keeps its unit.
 *
 * How it works: the catalog match ignores «ال», hamza forms and spacing (`costItemForTypedName`), so
 * «سور» is «السور» (unit «م.ط») and «ملحق علوي» is «الملحق العلوي». A custom item is an extra
 * («تكاليف وتجهيزات إضافية»), except a name that is a building area (`areaKindForItemName`: a floor
 * «الدور الثاني» / «الميزانين» / «مساحة المحل», an annex, a basement) which takes that kind — judged
 * on the whole name each keystroke.
 *
 * Edge cases: fixed 2026-10-28: the kind was fixed at the first keystroke, so a shop's «مساحة المحل»
 * reached the cost table as an add-on with a double-counting alert instead of the building area.
 * Fixed 2026-11-04 (A→Z #30/#34/#52/#90): only exact catalog spellings and unit names counted —
 * «سور» stayed «م²», and «ملحق علوي», «الدور الثاني», «الميزانين» became extras outside the floor areas.
 */
export function componentLineForTypedName(
  line: BuildingInventoryLineDto,
  text: string,
): BuildingInventoryLineDto {
  const match = costItemForTypedName(text);
  if (match) {
    return match.key === line.itemKey
      ? { ...line, label: text }
      : { ...componentLineForItem(line, match.key), label: text };
  }
  const keptKind =
    line.itemKey === "custom" && !areaKindForItemName(line.label)
      ? line.structureKind
      : structureKindForCostItem("custom");
  return {
    ...line,
    itemKey: "custom",
    structureKind: areaKindForItemName(text) ?? keptKind,
    label: text,
    buildRatioPct: null,
    repeatedFloorCount: null,
  };
}

/**
 * What an «المساحة / العدد» cell keeps of what was typed: the text without any minus sign.
 *
 * How it works: every «-» is dropped, so «-1375» keeps «1375» and «-» alone keeps nothing.
 *
 * Fixed: the number field took a click on its down arrow below zero and saved «-1375» to the
 * server (seen 2026-10-28); an area or count is never negative. «e»/«+» are dropped too — a
 * typed «1e5» was stored and read as no area at all by the cost approach.
 */
export function nonNegativeAreaInput(raw: string): string {
  return raw.replace(/[-+eE]/g, "");
}

/**
 * A whole count typed by the inspector (rooms, halls, bathrooms, age in years…).
 *
 * How it works: Arabic digits become Latin, everything that is not a digit is dropped, and at most
 * four digits are kept.
 *
 * Edge cases: «-3», «خمسة» and «1e9» were stored as typed and printed in the report and the Enfaz
 * package (2026-10-28); they now keep only their digits («3», «», «19»).
 */
export function wholeCountInput(raw: string): string {
  return toLatinDigits(raw).replace(/\D/g, "").slice(0, 4);
}

/**
 * A non-negative measure with decimals (street width in metres…).
 *
 * How it works: Arabic digits and the Arabic decimal sign become Latin; only digits and the first
 * «.» are kept.
 *
 * Edge cases: «-5» was stored for a street width (2026-10-28); a sign or letters never reach the draft.
 */
export function nonNegativeDecimalInput(raw: string): string {
  const latin = toLatinDigits(raw).replace(/[٫,]/g, ".").replace(/[^\d.]/g, "");
  const dot = latin.indexOf(".");
  return dot === -1 ? latin : latin.slice(0, dot + 1) + latin.slice(dot + 1).replace(/\./g, "");
}

/**
 * Does the inventory line show the «نسبة البناء» cell — is it an m² line of the floor areas?
 *
 * How it works: same grouping as the appraiser's cost table (`costGroupOf`): catalog floor items
 * and custom lines that name a floor / annex / basement; the unit must be m².
 *
 * Edge cases: fixed 2026-11-04 (A→Z #65): only catalog keys counted, so «الدور الثاني» had no ratio
 * cell in the inventory while the cost table could treat it as a floor.
 */
export function componentLineAcceptsBuildRatio(line: BuildingInventoryLineDto): boolean {
  return Boolean(line.itemKey) && costGroupOf(line) === "area" && (line.unit || "sqm") === "sqm";
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
 * Does the property have buildings or annexes WORTH VALUING that the inventory table lists
 * (it decides whether the inspector sees the table; it is not an acceptance condition)?
 * Every non-land asset does. An asset the inspector typed «أرض» does only when he
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
 * Mirrors `SpecialistComponentsRules.MissingBeforeStudyIssue` (the server checks it when the study is issued
 * since 2026-11-08) — null when complete. The details page still asks for it before its own acceptance.
 * Only the report text is required; an empty «جدول الحصر» never blocks acceptance.
 */
export function specialistComponentsMissing(
  inventory: Pick<BuildingInventoryDto, "componentsText">,
): string | null {
  if (!(inventory.componentsText ?? "").trim()) return SPECIALIST_COMPONENTS_TEXT_REQUIRED;
  return null;
}

function num(value: string | null | undefined): number {
  const n = parseLocaleNumber(value);
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
  // A custom «other» line named «الدور الثاني» / «ملحق علوي» counts by its name (2026-11-04, #30).
  const sum = (kind: string) =>
    sqm.filter((l) => effectiveStructureKind(l) === kind).reduce((a, l) => a + num(l.areaSqm), 0);
  const firstFloor = sqm.find((l) => l.itemKey === "first_floor");
  let built = sum("floor");
  let floors = sqm.filter((l) => effectiveStructureKind(l) === "floor").length;
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
