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
import type { InspectorWorkspaceDraft } from "@case-study/mfe/lib/prototype/inspector-workspace-data";
import type { EvaluatorReportChoices } from "./evaluator-window-data";
import { formatAmountNumberDisplay } from "./arabic-amount-words";

export type SheetTableRow = {
  key: string;
  values: string[];
};

export type SheetAreaFacts = {
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

/** Report sheet §11 uses يوجد / لا يوجد, not نعم / لا. */
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

export function countOrFlag(
  count: string | null | undefined,
  flag: string | null | undefined,
): string {
  const n = (count ?? "").trim();
  if (n) return n;
  return yesNoFromFlag(flag);
}

export function presentChip(
  selected: string[] | undefined,
  label: string,
): string {
  return (selected ?? []).includes(label) ? "متوفر" : "غير متوفر";
}

export function mapSurroundings(
  amenities: string[] | undefined,
): Record<string, string> {
  const set = new Set(amenities ?? []);
  const out: Record<string, string> = {};
  const used = new Set<string>();
  for (const [chip, label] of Object.entries(AMENITY_TO_SURROUNDING)) {
    out[label] = set.has(chip) ? "يوجد" : "لا يوجد";
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

export function areasFromInventory(
  lines: BuildingInventoryLineDto[] | null | undefined,
  inspector?: InspectorWorkspaceDraft | null,
): SheetAreaFacts {
  const rows = [...(lines ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const pick = (
    kind: string,
    needles: string[],
    fallback: string,
  ): { area: string; desc: string; label: string } => {
    const match = rows.find((l) => {
      const k = lineKind(l);
      const lab = lineLabel(l);
      if (k === kind) return needles.length === 0 || looksLike(lab, ...needles);
      return looksLike(lab, ...needles);
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
  const annexGround = pick("annex", ["أرضي", "ارضى", "سفلي"], "");
  const basement = pick("basement", ["قبو"], inspector?.basementTotal ?? "");
  const annexSum = rows
    .filter((l) => lineKind(l) === "annex")
    .map((l) => Number.parseFloat((l.areaSqm ?? "").replace(/,/g, "")))
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
    const n = Number.parseFloat(lineArea(line).replace(/,/g, ""));
    if (!Number.isFinite(n) || n <= 0) continue;
    builtSum += n;
    builtAny = true;
  }

  const descriptions: SheetTableRow[] = rows
    .filter((l) => lineKind(l) === "floor" || lineKind(l) === "annex" || lineKind(l) === "basement")
    .map((l) => ({
      key: lineLabel(l) || lineKind(l),
      values: [
        [lineLabel(l), (l.notes ?? "").trim()].filter(Boolean).join(" — ") || "—",
      ],
    }));

  if (!descriptions.length) {
    descriptions.push(
      { key: "الدور الأرضي", values: [ground.desc] },
      { key: "الدور الأول", values: [first.desc] },
      { key: "الملحق العلوي", values: [annex.desc] },
      { key: "الملحق الأرضي", values: [annexGround.desc] },
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
): ValuationCostLineDto | undefined {
  const list = (lines ?? []).filter((l) => l.isIncluded !== false);
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
      needles: ["أرضي", "سفلي"],
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
    const line = costLineByKey(cost?.lines, slot.itemKeys, slot.needles);
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

export function adoptedComparables(
  market: ValuationComparableSelectionListDto | null | undefined,
) {
  return [...(market?.items ?? [])]
    .filter((i) => i.isAdopted)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, 3);
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

function threeCols(
  comps: ValuationComparableSelectionDto[],
  pick: (item: ValuationComparableSelectionDto) => string,
): string[] {
  return [0, 1, 2].map((i) => dashSheet(comps[i] ? pick(comps[i]!) : ""));
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

export function buildAdjustmentSheetRows(
  comps: ValuationComparableSelectionDto[],
  market: ValuationComparableSelectionListDto | null | undefined,
): { rows: SheetTableRow[]; comparisonLabel: string } {
  const finMkt = (item: ValuationComparableSelectionDto) => {
    const lines = item.market?.adjustmentLines ?? [];
    const has = lines.some(
      (l) =>
        l.isIncluded &&
        (l.factorKey === "financing" || l.factorKey === "market"),
    );
    if (!has) return "";
    const fin =
      lines.find((l) => l.isIncluded && l.factorKey === "financing")?.percent ??
      0;
    const mkt =
      lines.find((l) => l.isIncluded && l.factorKey === "market")?.percent ?? 0;
    return formatSheetPct(fin + mkt);
  };
  const ppsm = market?.weightedPricePerSqm;
  const area = market?.subjectAreaSqm;
  const opinion = market?.marketOpinionValue;
  const comparisonLabel =
    ppsm != null && ppsm > 0 && area != null && area > 0
      ? `القيمة بطريقة المقارنة (${formatMoneyCell(ppsm)} × ${formatMoneyCell(area)} م²)`
      : "القيمة بطريقة المقارنة";
  const rows: SheetTableRow[] = [
    {
      key: "وصف العقار المقارن",
      values: threeCols(comps, (x) => x.comparable.comparablePropertyType),
    },
    {
      key: "قيمة العقارات المقارنة",
      values: threeCols(comps, (x) => formatMoneyCell(x.comparable.price)),
    },
    { key: "تسوية عامل الوقت", values: threeCols(comps, () => "") },
    {
      key: "تسوية شروط التمويل",
      values: threeCols(comps, (x) => includedPct(x, "financing")),
    },
    {
      key: "تسوية ظروف السوق",
      values: threeCols(comps, (x) => includedPct(x, "market")),
    },
    {
      key: "إجمالي تسويات التمويل والسوق ٪",
      values: threeCols(comps, finMkt),
    },
    {
      key: "سعر البيع بعد تسوية شروط التمويل وظروف السوق",
      values: threeCols(comps, (x) =>
        formatMoneyCell(x.market?.pricePerSqmAfterSequential),
      ),
    },
    {
      key: "تسوية المساحة",
      values: threeCols(comps, (x) => {
        const areaTxt = x.comparable.areaSqm
          ? String(x.comparable.areaSqm)
          : "";
        const p = includedPct(x, "area");
        return [areaTxt, p].filter(Boolean).join(" · ");
      }),
    },
    {
      key: "الموقع العام",
      values: threeCols(comps, (x) => {
        const d = (x.comparable.district ?? "").trim();
        const p = includedPct(x, "location");
        return [d, p].filter(Boolean).join(" ");
      }),
    },
    {
      key: "عدد الشوارع",
      values: threeCols(comps, (x) => includedPct(x, "street_count")),
    },
    {
      key: "مجموع نسب التسويات (٪)",
      values: threeCols(comps, (x) =>
        formatSheetPct(x.market?.sumDifferencePct),
      ),
    },
    {
      key: "سعر البيع بعد التسويات",
      values: threeCols(comps, (x) =>
        formatMoneyCell(
          x.market?.pricePerSqmAfterDifference ??
            x.market?.pricePerSqmAfterSequential,
        ),
      ),
    },
    {
      key: "الأوزان النسبية للعقارات المقارنة",
      values: threeCols(comps, (x) =>
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
  if (group.none) return "لا يوجد أثر جوهري";
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
      key: "أسلوب التكلفة — طريقة التكلفة (الإحلال)",
      kinds: ["cost", "replacement"],
    },
    { key: "أسلوب الدخل", kinds: ["income"], optional: true },
  ];
  const rows: SheetTableRow[] = [];
  for (const slot of slots) {
    const line = reconWeight(recon, slot.kinds);
    const unused = line.weight === "غير مستخدم";
    if (slot.optional && unused) continue;
    rows.push({
      key: slot.key,
      values: unused
        ? ["غير مستخدم", "غير مستخدم", "—"]
        : [dashSheet(line.value), dashSheet(line.weight), dashSheet(line.contrib)],
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
