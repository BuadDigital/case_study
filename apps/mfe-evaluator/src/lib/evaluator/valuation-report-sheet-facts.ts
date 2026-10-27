// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Report Services and surroundings print «—» when the inspector answered nothing; «غير متوفر» / «لا يوجد»
//           only when he picked others. A comparable without a factor shows «—», not a bare «٪».
//  • O14  A ground annex is matched only by GROUND_ANNEX_NEEDLES, so «الدور الأرضي» no longer prints as «مسطح
//         الملحق الأرضي»; one cost line never prints on two rows.
//  • Report Sequential factors (financing, market «(عامل الوقت)», transaction type) print in chain order with
//           a compounded subtotal «(مركّبة)»; the empty separate time row is gone.
//  • Report Every included difference factor prints (differenceFactorRows), so the rows add up to «مجموع نسب
//           التسويات»; the comparison value uses the unrounded marketOpinionValueRaw.
//  • The reconciliation row reads «أسلوب الدخل (رسملة مباشرة)».
// ──────────────────────────────────────────────────────────────────────────────────────────────

import {
  VALUER_ROSTER_MEMBERSHIP_OPTIONS,
  VALUER_SYS_ROLES,
  type BuildingInventoryLineDto,
  type ComparablePropertyDto,
  type ValuationComparableSelectionDto,
  type ValuationComparableSelectionListDto,
  type ValuationCostApproachDto,
  type ValuationCostLineDto,
  type ValuationReconciliationDto,
} from "@platform/api-client";
import type { InspectorWorkspaceDraft } from "@platform/app-shared/app-data/inspector-workspace-data";
import type { EvaluatorReportChoices } from "./evaluator-window-data";
import { formatAmountNumberDisplay } from "./arabic-amount-words";
import { costUnitLabel } from "@platform/app-shared/domain/cost-items";
import { parseLocaleNumber } from "@platform/app-shared/format/number";

export type SheetTableRow = {
  key: string;
  values: string[];
  /**
   * Section 19 factor rows (area, location, streets): per comparable the comparable's description and
   * the adjustment % — printed as two cells under the comparable's column.
   */
  pairs?: Array<[string, string]>;
};

type SheetAreaFacts = {
  ground: string;
  first: string;
  annex: string;
  annexGround: string;
  basement: string;
  annexTotal: string;
  builtUpTotal: string;
  descriptions: SheetTableRow[];
};

const AMENITY_TO_SURROUNDING: Record<string, string> = {
  مساجد: "جامع",
  "مرفق أمني": "مرفق أمني",
  "مقر حكومي": "مقر حكومي",
  مستشفيات: "مرفق طبي",
  "أسواق تجارية": "سوق تجاري",
  حدائق: "حديقة",
  مدارس: "مرفق تعليمي",
  "طرق رئيسية": "طريق سريع",
};

export function dashSheet(value: string | null | undefined): string {
  const t = (value ?? "").trim();
  return t || "—";
}

export function membershipCategoryLabel(key: string | null | undefined): string {
  const t = (key ?? "").trim();
  if (!t) return "";
  return VALUER_ROSTER_MEMBERSHIP_OPTIONS.find((o) => o.value === t)?.label ?? t;
}

export function valuerRoleLabel(key: string | null | undefined): string {
  const t = (key ?? "").trim();
  if (!t) return "";
  return VALUER_SYS_ROLES.find((o) => o.value === t)?.label ?? t;
}

export function yesNoFromFlag(value: string | null | undefined): string {
  const t = (value ?? "").trim();
  if (t === "نعم" || t === "لا") return t;
  return "";
}

/** Report sheet section 11 uses "exists" / "does not exist", not yes / no. */
export function existsFromYesNo(value: string | null | undefined): string {
  const t = (value ?? "").trim();
  if (t === "نعم" || t === "يوجد") return "يوجد";
  if (t === "لا" || t === "لا يوجد") return "لا يوجد";
  return "";
}

export function existsFromCount(value: string | null | undefined): string {
  const t = (value ?? "").trim().replace(/,/g, "");
  if (!t) return "";
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n)) return t;
  return n > 0 ? "يوجد" : "لا يوجد";
}

export function existsIf(
  present: boolean,
  knownAbsent = false,
): string {
  if (present) return "يوجد";
  if (knownAbsent) return "لا يوجد";
  return "";
}

/**
 * One service's availability. «غير متوفر» only when the inspector answered the services
 * question (picked at least one service) and left this one out; no answer at all prints «—».
 */
export function presentChip(
  selected: string[] | undefined,
  label: string,
): string {
  const picked = selected ?? [];
  if (picked.length === 0) return "—";
  return picked.includes(label) ? "متوفر" : "غير متوفر";
}

/**
 * «المحيط» cells. «لا يوجد» only when the inspector picked at least one surrounding and left this
 * one out; nothing picked at all prints «—» (unknown, not «absent») — same rule as the services.
 */
export function mapSurroundings(
  amenities: string[] | undefined,
): Record<string, string> {
  const set = new Set(amenities ?? []);
  const answered = set.size > 0;
  const out: Record<string, string> = {};
  const used = new Set<string>();
  for (const [chip, label] of Object.entries(AMENITY_TO_SURROUNDING)) {
    out[label] = set.has(chip) ? "يوجد" : answered ? "لا يوجد" : "—";
    if (set.has(chip)) used.add(chip);
  }
  const other = (amenities ?? []).filter((a) => !used.has(a) && !AMENITY_TO_SURROUNDING[a]);
  out["أخرى"] = other.length ? other.join("، ") : "";
  return out;
}

export function joinObservations(inspector?: InspectorWorkspaceDraft | null): string {
  const rows = inspector?.observations ?? [];
  const bits = rows
    .map((o) => {
      const cat = (o.category ?? "").trim();
      const text = (o.text ?? "").trim();
      if (!cat && !text) return "";
      return cat && text ? `${cat}: ${text}` : cat || text;
    })
    .filter(Boolean);
  return bits.join("؛ ");
}

function lineKind(line: BuildingInventoryLineDto): string {
  return (line.structureKind ?? "").trim().toLowerCase();
}

function lineLabel(line: BuildingInventoryLineDto): string {
  return (line.label ?? "").trim();
}

function lineArea(line: BuildingInventoryLineDto): string {
  return (line.areaSqm ?? "").trim();
}

function looksLike(label: string, ...needles: string[]): boolean {
  return needles.some((n) => label.includes(n));
}

/** Labels that name a ground (lower) annex — «الدور الأرضي» alone does not. */
const GROUND_ANNEX_NEEDLES = ["ملحق أرضي", "الملحق الأرضي", "ملحق ارضي", "ملحق سفلي", "الملحق السفلي"];

export function areasFromInventory(
  lines: BuildingInventoryLineDto[] | null | undefined,
  inspector?: InspectorWorkspaceDraft | null,
): SheetAreaFacts {
  const rows = [...(lines ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  // «الأدوار المتكررة» carry a floor count, not an area — they repeat the first floor
  // (same rule as the appraiser's cost table).
  const firstFloorArea = rows.find((l) => l.itemKey === "first_floor")?.areaSqm ?? "";
  const areaOf = (line: BuildingInventoryLineDto): string => {
    if (line.itemKey !== "repeated_floors") return lineArea(line);
    const each = parseLocaleNumber(firstFloorArea);
    const count = Math.max(0, line.repeatedFloorCount ?? 0);
    return Number.isFinite(each) && each > 0 && count > 0 ? String(each * count) : "";
  };
  const pick = (
    kind: string,
    needles: string[],
    fallback: string,
    /** Label needles for lines of another kind (defaults to `needles`). */
    otherKindNeedles: string[] = needles,
  ): { area: string; desc: string; label: string } => {
    const match = rows.find((l) => {
      const k = lineKind(l);
      const lab = lineLabel(l);
      if (k === kind) return needles.length === 0 || looksLike(lab, ...needles);
      return looksLike(lab, ...otherKindNeedles);
    });
    if (match) {
      return {
        area: lineArea(match),
        desc: [lineLabel(match), (match.notes ?? "").trim()].filter(Boolean).join(" — "),
        label: lineLabel(match) || needles[0] || kind,
      };
    }
    return { area: fallback, desc: "", label: needles[0] || kind };
  };

  const ground = pick("floor", ["أرضي", "الأرضي"], "");
  const first = pick("floor", ["الأول", "اول"], "");
  const annex = pick("annex", ["علوي", "upper"], "");
  // A ground annex is an «annex» line, or a line named «ملحق أرضي» — never «الدور الأرضي».
  const annexGround = pick("annex", ["أرضي", "ارضى", "سفلي"], "", GROUND_ANNEX_NEEDLES);
  const basement = pick("basement", ["قبو"], inspector?.basementTotal ?? "");
  const annexSum = rows
    .filter((l) => lineKind(l) === "annex")
    .map((l) => parseLocaleNumber(l.areaSqm ?? ""))
    .filter((n) => Number.isFinite(n) && n > 0)
    .reduce((a, b) => a + b, 0);
  const annexTotal =
    annexSum > 0
      ? String(annexSum)
      : (inspector?.annexTotal ?? "").trim();

  let builtSum = 0;
  let builtAny = false;
  for (const line of rows) {
    const kind = lineKind(line);
    if (kind !== "floor" && kind !== "annex" && kind !== "basement") continue;
    const n = parseLocaleNumber(areaOf(line));
    if (!Number.isFinite(n) || n <= 0) continue;
    builtSum += n;
    builtAny = true;
  }

  // Section 10 lists every component the specialist recorded (fence, elevator… too); the built-up
  // total below still sums floor areas only. Non-m² items show their quantity and unit.
  const descriptions: SheetTableRow[] = rows.map((l) => {
    const unit = (l.unit || "sqm").trim();
    const qty = areaOf(l);
    return {
      key: lineLabel(l) || lineKind(l),
      values: [
        [lineLabel(l), (l.notes ?? "").trim()].filter(Boolean).join(" — ") || "—",
        unit === "sqm" || !qty ? qty : `${qty} ${costUnitLabel(unit)}`,
      ],
    };
  });

  if (!descriptions.length) {
    descriptions.push(
      { key: "الدور الأرضي", values: [ground.desc, ground.area] },
      { key: "الدور الأول", values: [first.desc, first.area] },
      { key: "الملحق العلوي", values: [annex.desc, annex.area] },
      { key: "الملحق الأرضي", values: [annexGround.desc, annexGround.area] },
    );
  }

  return {
    ground: ground.area,
    first: first.area,
    annex: annex.area,
    annexGround: annexGround.area,
    basement: basement.area,
    annexTotal,
    builtUpTotal: builtAny ? String(builtSum) : "",
    descriptions,
  };
}

export function formatMoneyCell(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  return formatAmountNumberDisplay(n);
}

function costLineByKey(
  lines: ValuationCostLineDto[] | undefined,
  keys: string[],
  labelNeedles: string[],
  /** Lines already printed on another row — one cost line never prints twice. */
  taken?: ReadonlySet<string>,
): ValuationCostLineDto | undefined {
  const list = (lines ?? []).filter((l) => l.isIncluded !== false && !taken?.has(l.id));
  return (
    list.find((l) => keys.includes((l.itemKey ?? "").toLowerCase())) ??
    list.find((l) => labelNeedles.some((n) => (l.itemLabelAr || l.label || "").includes(n)))
  );
}

export function costLinePresent(
  cost: ValuationCostApproachDto | null | undefined,
  keys: string[],
  needles: string[],
): boolean {
  return Boolean(costLineByKey(cost?.lines, keys, needles));
}

export function inventoryLinePresent(
  lines: BuildingInventoryLineDto[] | null | undefined,
  kind: string,
  needles: string[],
): boolean {
  return [...(lines ?? [])].some((l) => {
    const k = (l.structureKind ?? "").trim().toLowerCase();
    const lab = (l.label ?? "").trim();
    if (k === kind) return needles.length === 0 || needles.some((n) => lab.includes(n));
    return needles.some((n) => lab.includes(n));
  });
}

export function annexCountDisplay(
  inspector?: InspectorWorkspaceDraft | null,
): string {
  const upper = Number.parseInt((inspector?.annexUpperCount ?? "").trim(), 10);
  const ground = Number.parseInt((inspector?.annexGroundCount ?? "").trim(), 10);
  const u = Number.isFinite(upper) && upper > 0 ? upper : 0;
  const g = Number.isFinite(ground) && ground > 0 ? ground : 0;
  if (u + g > 0) return String(u + g);
  return yesNoFromFlag(inspector?.hasAnnex);
}

export function costRowCells(
  cost: ValuationCostApproachDto | null | undefined,
  keys: string[],
  needles: string[],
  inventoryArea: string,
): [string, string, string] {
  const line = costLineByKey(cost?.lines, keys, needles);
  if (!line) {
    return [inventoryArea, "", ""];
  }
  const qty = line.areaSqm ? String(line.areaSqm) : inventoryArea;
  const unit = line.unitCostSar ? formatMoneyCell(line.unitCostSar) : "";
  const total = line.lineTotal ? formatMoneyCell(line.lineTotal) : "";
  return [qty, unit, total];
}

function costLineSheetValues(
  line: ValuationCostLineDto | undefined,
  inventoryArea: string,
): string[] {
  if (!line) {
    return [dashSheet(inventoryArea), "—", "—"];
  }
  const total = dashSheet(formatMoneyCell(line.lineTotal));
  if ((line.unit ?? "").toLowerCase() === "lump") {
    return ["مقطوعية", total];
  }
  const qty = line.areaSqm ? String(line.areaSqm) : inventoryArea;
  return [
    dashSheet(qty),
    dashSheet(formatMoneyCell(line.unitCostSar)),
    total,
  ];
}

export function buildDirectCostSheetRows(
  cost: ValuationCostApproachDto | null | undefined,
  areas: SheetAreaFacts,
): SheetTableRow[] {
  const slots: Array<{
    key: string;
    itemKeys: string[];
    needles: string[];
    inventory: string;
    optional?: boolean;
  }> = [
    {
      key: "مسطح الدور الأرضي",
      itemKeys: ["ground_floor"],
      needles: ["أرضي"],
      inventory: areas.ground,
    },
    {
      key: "مسطح الدور الأول",
      itemKeys: ["first_floor"],
      needles: ["الأول"],
      inventory: areas.first,
    },
    {
      key: "مسطح الملحق العلوي",
      itemKeys: ["upper_annex"],
      needles: ["علوي"],
      inventory: areas.annex,
    },
    {
      key: "السور",
      itemKeys: ["fence"],
      needles: ["سور"],
      inventory: "",
    },
    {
      key: "المواقف",
      itemKeys: ["parking"],
      needles: ["مواقف"],
      inventory: "",
    },
    {
      key: "خزانات ومضخات",
      itemKeys: ["tanks_pumps"],
      needles: ["خزان"],
      inventory: "",
    },
    {
      key: "تشجير وتنسيق الموقع",
      itemKeys: ["landscaping"],
      needles: ["تشجير"],
      inventory: "",
    },
    {
      key: "مسطح الملحق الأرضي",
      itemKeys: ["lower_annex"],
      // «الدور الأرضي» is not an annex — only a line named as a ground annex matches by label.
      needles: GROUND_ANNEX_NEEDLES,
      inventory: areas.annexGround,
      optional: true,
    },
    {
      key: "القبو",
      itemKeys: ["basement"],
      needles: ["قبو"],
      inventory: areas.basement,
      optional: true,
    },
    {
      key: "المسبح",
      itemKeys: ["pool"],
      needles: ["مسبح"],
      inventory: "",
      optional: true,
    },
  ];
  const used = new Set<string>();
  const rows: SheetTableRow[] = [];
  for (const slot of slots) {
    const line = costLineByKey(cost?.lines, slot.itemKeys, slot.needles, used);
    const hasInv = Boolean((slot.inventory ?? "").trim());
    if (slot.optional && !line && !hasInv) continue;
    if (line?.id) used.add(line.id);
    rows.push({
      key: slot.key,
      values: costLineSheetValues(line, slot.inventory),
    });
  }
  for (const line of cost?.lines ?? []) {
    if (line.isIncluded === false || used.has(line.id)) continue;
    const label = (line.itemLabelAr || line.label || "").trim();
    if (!label) continue;
    used.add(line.id);
    rows.push({ key: label, values: costLineSheetValues(line, "") });
  }
  rows.push({
    key: "مجموع التكلفة المباشرة",
    values: [dashSheet(cost ? formatMoneyCell(cost.directCostTotal) : "")],
  });
  return rows;
}

const INDIRECT_COST_SHEET_SLOTS: Array<{ key: string; label: string }> = [
  { key: "design_supervision", label: "التصميم والإشراف الهندسي" },
  { key: "licensing_fees", label: "الترخيص والرسوم الحكومية" },
  { key: "project_management", label: "إدارة المشروع" },
  { key: "utilities_connection", label: "توصيل الخدمات" },
  { key: "contingency", label: "مخصص الطوارئ" },
  { key: "developer_profit", label: "أرباح المطور والمخاطرة" },
];

export function buildIndirectCostSheetRows(
  cost: ValuationCostApproachDto | null | undefined,
): { rows: SheetTableRow[]; totalLabel: string } {
  const items = cost?.indirectItems ?? [];
  const used = new Set<string>();
  const rows: SheetTableRow[] = [];
  for (const slot of INDIRECT_COST_SHEET_SLOTS) {
    const item = items.find((i) => (i.itemKey ?? "").trim() === slot.key);
    if (item) used.add(slot.key);
    rows.push({
      key: slot.label,
      values: [dashSheet(item ? formatSheetPct(item.pct) : "")],
    });
  }
  for (const item of items) {
    const k = (item.itemKey ?? "").trim();
    if (used.has(k)) continue;
    const label = (item.labelAr ?? "").trim() || k;
    if (!label) continue;
    used.add(k);
    rows.push({
      key: label,
      values: [dashSheet(formatSheetPct(item.pct))],
    });
  }
  rows.push({
    key: "مجموع النسب غير المباشرة",
    values: [dashSheet(formatSheetPct(cost?.indirectRatesSumPct))],
  });
  const direct = cost?.directCostTotal;
  const grand = cost?.totalCostWithIndirect;
  const factor =
    cost?.indirectRatesSumPct != null
      ? 1 + Number(cost.indirectRatesSumPct) / 100
      : null;
  const totalLabel =
    direct != null &&
    grand != null &&
    grand > 0 &&
    factor != null &&
    Number.isFinite(factor)
      ? `التكلفة الإجمالية — المباشرة × (1 + غير المباشرة) = ${formatMoneyCell(direct)} × ${factor.toFixed(2)}`
      : "التكلفة الإجمالية — المباشرة × (1 + غير المباشرة)";
  rows.push({
    key: "التكلفة الإجمالية",
    values: [dashSheet(grand != null && grand > 0 ? formatMoneyCell(grand) : "")],
  });
  return { rows, totalLabel };
}

/** Interactive form spec: up to 5 approved comparables print in full in the report. */
const MAX_REPORT_COMPARABLES = 5;

export function adoptedComparables(
  market: ValuationComparableSelectionListDto | null | undefined,
) {
  return [...(market?.items ?? [])]
    .filter((i) => i.isAdopted)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, MAX_REPORT_COMPARABLES);
}

/** Effective comparable values after compEdit overrides (price/area for this valuation). */
export function effectiveComparableValues(item: ValuationComparableSelectionDto) {
  return {
    price: item.effectivePriceSar ?? item.comparable.price,
    areaSqm: item.effectiveAreaSqm ?? item.comparable.areaSqm,
    pricePerSqm: item.effectivePricePerSqm ?? item.comparable.pricePerSqm,
  };
}

const COMPARABLE_SOURCE_AR: Record<string, string> = {
  listing_platform: "منصة عقارية",
  bourse: "البورصة العقارية",
  field: "رصد ميداني",
  prior_valuation: "تقييم سابق",
  other: "أخرى",
};

/** Same join as ValuationReportDocumentService.ComposeTransactionCell. */
export function composeTransactionCell(
  c: Pick<
    ComparablePropertyDto,
    | "transactionKind"
    | "transactionKindLabelAr"
    | "priceDescription"
    | "priceDescriptionLabelAr"
    | "source"
    | "listingNumber"
    | "transactionReference"
    | "advertiserPhone"
  >,
): string {
  const bits: string[] = [];
  const kind = (c.transactionKindLabelAr ?? "").trim();
  if (kind) bits.push(kind);
  else if (c.transactionKind === "executed") bits.push("صفقة منفّذة");
  else if ((c.transactionKind ?? "").trim()) bits.push("عرض");
  const price = (c.priceDescriptionLabelAr ?? "").trim();
  if (price) bits.push(price);
  const srcKey = (c.source ?? "").trim();
  const src = COMPARABLE_SOURCE_AR[srcKey] ?? srcKey;
  if (src) bits.push(src);
  const listing =
    (c.listingNumber ?? "").trim() || (c.transactionReference ?? "").trim();
  if (listing) bits.push(listing);
  const phone = (c.advertiserPhone ?? "").trim();
  if (phone) bits.push(phone);
  return bits.join(" / ");
}

export function formatSheetPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "";
  return `${Number(n).toFixed(2)}٪`;
}

function includedPct(
  item: ValuationComparableSelectionDto,
  factorKey: string,
): string {
  const line = item.market?.adjustmentLines?.find(
    (l) => l.isIncluded && l.factorKey === factorKey,
  );
  return line ? formatSheetPct(line.percent) : "";
}

/** The comparable's description for one adjustment factor (compSpec), e.g. «الفيحاء» or «1». */
function factorDescription(item: ValuationComparableSelectionDto, factorKey: string): string {
  return (
    item.market?.adjustmentLines?.find((l) => l.factorKey === factorKey)?.descriptionAr ?? ""
  ).trim();
}

/** Factor row cells: [description, %] per comparable, same column count as `compCols`. */
function compPairs(
  comps: ValuationComparableSelectionDto[],
  pick: (item: ValuationComparableSelectionDto) => [string, string],
): Array<[string, string]> {
  const count = Math.min(Math.max(comps.length, 1), MAX_REPORT_COMPARABLES);
  return Array.from({ length: count }, (_, i) => {
    const [value, pct] = comps[i] ? pick(comps[i]!) : ["", ""];
    // A comparable without this factor shows «—», not a bare «٪».
    return [dashSheet(value), pct || "—"];
  });
}

/** One column per approved comparable (up to 5) — a single dash column when none. */
function compCols(
  comps: ValuationComparableSelectionDto[],
  pick: (item: ValuationComparableSelectionDto) => string,
): string[] {
  const count = Math.min(Math.max(comps.length, 1), MAX_REPORT_COMPARABLES);
  return Array.from({ length: count }, (_, i) =>
    dashSheet(comps[i] ? pick(comps[i]!) : ""),
  );
}

export function buildAdjustmentRationaleText(
  comps: ValuationComparableSelectionDto[],
): string {
  const items: string[] = [];
  comps.forEach((item, i) => {
    for (const line of item.market?.adjustmentLines ?? []) {
      if (!line.isIncluded) continue;
      const r = (line.rationale ?? "").trim();
      if (!r) continue;
      items.push(`${line.labelAr} — المقارن (${i + 1}): ${r}`);
    }
  });
  return items.join("\n");
}

/** Sequential factors in chain order (multiplied one after the other on the unit price). */
const SEQUENTIAL_FACTORS: Array<{ key: string; label: string; always?: boolean }> = [
  { key: "financing", label: "تسوية شروط التمويل", always: true },
  // Ejada folds the time gap into market conditions — one row, named for both.
  { key: "market", label: "تسوية ظروف السوق (عامل الوقت)", always: true },
  { key: "transaction_type", label: "تسوية نوع المقارن" },
];
const SEQUENTIAL_FACTOR_KEYS = new Set(SEQUENTIAL_FACTORS.map((f) => f.key));

/** Fallback labels for built-in difference factors (the server's line label wins). */
const DIFFERENCE_FACTOR_LABELS: Record<string, string> = {
  ideal_area: "المساحة المثالية",
  attraction: "عامل الجذب للموقع",
  access: "سهولة الوصول",
  street_count: "عدد الشوارع",
  street_lengths: "أطوال الشوارع",
  plot_shape: "شكل القطعة",
  topography: "طبوغرافيا الأرض",
  zoning: "تنظيم البناء",
  services: "الخدمات والبنية التحتية",
  restrictions: "القيود والارتفاقات",
  development: "حالة التطوير",
};

function includedLine(item: ValuationComparableSelectionDto, factorKey: string) {
  return item.market?.adjustmentLines?.find((l) => l.isIncluded && l.factorKey === factorKey);
}

/**
 * Difference factors any comparable applies — besides area and location, which always print —
 * in the matrix order: access, streets, custom factors, catalog extras… Every included factor
 * prints, so the rows add up to «مجموع نسب التسويات».
 */
function differenceFactorRows(
  comps: ValuationComparableSelectionDto[],
): Array<{ key: string; label: string }> {
  const seen = new Map<string, { label: string; order: number }>();
  for (const item of comps) {
    for (const line of item.market?.adjustmentLines ?? []) {
      const key = line.factorKey;
      if (!line.isIncluded || SEQUENTIAL_FACTOR_KEYS.has(key) || key === "area" || key === "location") {
        continue;
      }
      const label = (line.labelAr ?? "").trim() || DIFFERENCE_FACTOR_LABELS[key] || key;
      const prev = seen.get(key);
      if (!prev || line.sortOrder < prev.order) seen.set(key, { label, order: line.sortOrder });
    }
  }
  return [...seen.entries()]
    .sort((a, b) => a[1].order - b[1].order)
    .map(([key, v]) => ({ key, label: v.label }));
}

export function buildAdjustmentSheetRows(
  comps: ValuationComparableSelectionDto[],
  market: ValuationComparableSelectionListDto | null | undefined,
): { rows: SheetTableRow[]; comparisonLabel: string } {
  const sequential = SEQUENTIAL_FACTORS.filter(
    (f) => f.always || comps.some((x) => includedLine(x, f.key)),
  );
  const withKind = sequential.some((f) => f.key === "transaction_type");
  // The chain multiplies: (1 + p₁)(1 + p₂)… − 1 is what turns the comparable's unit price
  // into the price after the sequential factors.
  const chainPct = (item: ValuationComparableSelectionDto) => {
    const lines = sequential
      .map((f) => includedLine(item, f.key))
      .filter((l): l is NonNullable<typeof l> => Boolean(l));
    if (lines.length === 0) return "";
    const factor = lines.reduce((acc, l) => acc * (1 + Number(l.percent) / 100), 1);
    return formatSheetPct((factor - 1) * 100);
  };
  const compounded = comps.some(
    (x) => sequential.filter((f) => Number(includedLine(x, f.key)?.percent ?? 0) !== 0).length > 1,
  );
  const ppsm = market?.weightedPricePerSqm;
  const opinion = market?.marketOpinionValueRaw ?? market?.marketOpinionValue;
  // The label stays plain — no «(سعر المتر × المساحة)» formula beside it.
  const comparisonLabel = "القيمة بطريقة المقارنة";
  const rows: SheetTableRow[] = [
    {
      key: "وصف العقار المقارن",
      values: compCols(comps, (x) => x.comparable.comparablePropertyType),
    },
    {
      key: "قيمة العقارات المقارنة",
      values: compCols(comps, (x) =>
        formatMoneyCell(effectiveComparableValues(x).price),
      ),
    },
    ...sequential.map((f) => ({
      key: f.label,
      values: compCols(comps, (x) => includedPct(x, f.key)),
    })),
    {
      key: `${withKind ? "إجمالي التسويات التسلسلية ٪" : "إجمالي تسويات التمويل والسوق ٪"}${compounded ? " (مركّبة)" : ""}`,
      values: compCols(comps, chainPct),
    },
    {
      key: withKind
        ? "سعر البيع بعد التسويات التسلسلية"
        : "سعر البيع بعد تسوية شروط التمويل وظروف السوق",
      values: compCols(comps, (x) =>
        formatMoneyCell(x.market?.pricePerSqmAfterSequential),
      ),
    },
    {
      key: "تسوية المساحة",
      values: compCols(comps, (x) => {
        const effArea = effectiveComparableValues(x).areaSqm;
        const areaTxt = effArea ? String(effArea) : "";
        const p = includedPct(x, "area");
        return [areaTxt, p].filter(Boolean).join(" · ");
      }),
      pairs: compPairs(comps, (x) => {
        const effArea = effectiveComparableValues(x).areaSqm;
        return [effArea ? formatMoneyCell(effArea) : "", includedPct(x, "area")];
      }),
    },
    {
      key: "الموقع العام",
      values: compCols(comps, (x) => {
        const d = (x.comparable.district ?? "").trim();
        const p = includedPct(x, "location");
        return [d, p].filter(Boolean).join(" ");
      }),
      pairs: compPairs(comps, (x) => [
        (x.comparable.district ?? "").trim() || factorDescription(x, "location"),
        includedPct(x, "location"),
      ]),
    },
    ...differenceFactorRows(comps).map((f) => ({
      key: f.label,
      values: compCols(comps, (x) => includedPct(x, f.key)),
      pairs: compPairs(comps, (x) => [factorDescription(x, f.key), includedPct(x, f.key)]),
    })),
    {
      key: "مجموع نسب التسويات (٪)",
      values: compCols(comps, (x) =>
        formatSheetPct(x.market?.sumDifferencePct),
      ),
    },
    {
      key: "سعر البيع بعد التسويات",
      values: compCols(comps, (x) =>
        formatMoneyCell(
          x.market?.pricePerSqmAfterDifference ??
            x.market?.pricePerSqmAfterSequential,
        ),
      ),
    },
    {
      key: "الأوزان النسبية للعقارات المقارنة",
      values: compCols(comps, (x) =>
        formatSheetPct(x.market?.effectiveWeightPct),
      ),
    },
    {
      key: "المتوسط المرجح لسعر المتر",
      values: [dashSheet(ppsm != null && ppsm > 0 ? formatMoneyCell(ppsm) : "")],
    },
    {
      key: "القيمة بطريقة المقارنة",
      values: [
        dashSheet(
          opinion != null && opinion > 0 ? formatMoneyCell(opinion) : "",
        ),
      ],
    },
  ];
  return { rows, comparisonLabel };
}

export function esgCell(
  group: EvaluatorReportChoices["esgEnv"] | undefined,
): string {
  if (!group) return "";
  if (group.none) {
    const notes = (group.notes ?? "").trim();
    return notes || "لا يوجد تأثير للعوامل على القيمة التقديرية للعقار.";
  }
  const bits = [...(group.selected ?? [])];
  const notes = (group.notes ?? "").trim();
  if (notes) bits.push(notes);
  return bits.join(" — ");
}

export function finishingLevelLabel(
  key: EvaluatorReportChoices["finishingLevel"] | undefined,
): string {
  switch (key) {
    case "luxury":
      return "تشطيب فاخر";
    case "medium":
      return "تشطيب متوسط";
    case "ordinary":
      return "تشطيب عادي";
    case "none":
      return "بدون تشطيب";
    default:
      return "";
  }
}

export function reconWeight(
  recon: ValuationReconciliationDto | null | undefined,
  kinds: string[],
): { weight: string; contrib: string; value: string } {
  const m = (recon?.methods ?? []).find((row) =>
    kinds.includes((row.approachKind ?? "").trim().toLowerCase()),
  );
  if (!m || m.isIncluded === false) {
    return { weight: "غير مستخدم", contrib: "", value: "" };
  }
  return {
    weight: formatSheetPct(m.weightPct) || `${m.weightPct}٪`,
    contrib: formatMoneyCell(m.contributionValue),
    value: formatMoneyCell(m.approachValue),
  };
}

export function buildReconSheetRows(
  recon: ValuationReconciliationDto | null | undefined,
): SheetTableRow[] {
  const slots: Array<{
    key: string;
    kinds: string[];
    optional?: boolean;
  }> = [
    {
      key: "أسلوب السوق — طريقة المقارنة",
      kinds: ["market", "comparison"],
    },
    {
      key: "أسلوب التكلفة — طريقة المقاول",
      kinds: ["cost", "replacement"],
    },
    // Direct capitalisation, printed with its method.
    { key: "أسلوب الدخل (رسملة مباشرة)", kinds: ["income"] },
  ];
  const rows: SheetTableRow[] = [];
  // Reconciliation is between the indicators of the approaches in use — an approach that was
  // not chosen is not listed at all (no «غير مستخدم» rows).
  for (const slot of slots) {
    const line = reconWeight(recon, slot.kinds);
    if (line.weight === "غير مستخدم") continue;
    rows.push({
      key: slot.key,
      values: [dashSheet(line.value), dashSheet(line.weight), dashSheet(line.contrib)],
    });
  }
  // «مستند ذو قيمة» indicators — one row per method the appraiser took from a document.
  for (const m of recon?.methods ?? []) {
    if (!m.valueDocumentAttachmentId || m.isIncluded === false) continue;
    rows.push({
      key: m.labelAr,
      values: [
        dashSheet(formatMoneyCell(m.approachValue)),
        dashSheet(formatSheetPct(m.weightPct) || `${m.weightPct}٪`),
        dashSheet(formatMoneyCell(m.contributionValue)),
      ],
    });
  }
  rows.push({
    key: "مجموع نسب المشاركة",
    values: ["", dashSheet(formatSheetPct(recon?.weightSumPct)), ""],
  });
  rows.push({
    key: "القيمة المرجّحة",
    values: [
      dashSheet(
        recon?.weightedValue != null && recon.weightedValue > 0
          ? formatMoneyCell(recon.weightedValue)
          : "",
      ),
    ],
  });
  return rows;
}
