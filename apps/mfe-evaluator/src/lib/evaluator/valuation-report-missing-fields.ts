/**
 * Valuation report cells whose value comes from a party or a system setting. When the fill
 * leaves one empty (—) it is marked red on screen — like «رقم الطلب». Clicking a marked cell
 * asks the person who supplies that information (or, for the appraiser's own fields, opens the
 * tab that completes them). Template text is never marked, and neither is a dash that is itself
 * the answer (service not available, liquidation off, adjustment factor not applied, a section
 * or row removed because it does not apply to the property).
 */

import {
  normLabel,
  type ValuationReportLiveFill,
} from "./valuation-report-fill-model";

export type ReportFieldSource = "intake" | "inspector" | "survey" | "appraiser" | "org";
/** Evaluator window tabs that complete the appraiser's own report fields. */
export type ReportAppraiserTab = "basic" | "market" | "cost" | "final" | "review";
/** Organization-settings tabs that hold report values. */
export type ReportSettingsSection = "company" | "evaluator" | "report";

export const REPORT_FIELD_SOURCES: Record<ReportFieldSource, { label: string }> = {
  intake: { label: "البيانات الأولية" },
  inspector: { label: "المعاين الميداني" },
  survey: { label: "المكتب الهندسي" },
  appraiser: { label: "المقيّم" },
  org: { label: "إعدادات المنشأة" },
};

export const REPORT_APPRAISER_TAB_LABELS: Record<ReportAppraiserTab, string> = {
  basic: "البيانات الأساسية",
  market: "طريقة المقارنة",
  cost: "طريقة المقاول",
  final: "رأي القيمة النهائي",
  review: "المراجعة النهائية",
};

type FieldOrigin = {
  source: ReportFieldSource;
  tab?: ReportAppraiserTab;
  section?: ReportSettingsSection;
};

const INTAKE: FieldOrigin = { source: "intake" };
const INSPECTOR: FieldOrigin = { source: "inspector" };
const SURVEY: FieldOrigin = { source: "survey" };
const BASIC: FieldOrigin = { source: "appraiser", tab: "basic" };
const MARKET: FieldOrigin = { source: "appraiser", tab: "market" };
const COST: FieldOrigin = { source: "appraiser", tab: "cost" };
const FINAL: FieldOrigin = { source: "appraiser", tab: "final" };
const REVIEW: FieldOrigin = { source: "appraiser", tab: "review" };
const COMPANY: FieldOrigin = { source: "org", section: "company" };
const VALUERS: FieldOrigin = { source: "org", section: "evaluator" };
const REPORT_SETTINGS: FieldOrigin = { source: "org", section: "report" };

/** Per section: `td.k` label → who fills the value cell beside it. */
const KEYED_FIELDS: Record<string, Record<string, FieldOrigin>> = {
  "1": {
    "اسم المقيم المعتمد": VALUERS,
    "رقم ترخيص مزاولة المهنة": COMPANY,
    "تاريخ الإصدار": COMPANY,
    "تاريخ الانتهاء": COMPANY,
    "فرع التقييم": REPORT_SETTINGS,
  },
  "2": {
    "اسم العميل": INTAKE,
    "تاريخ التقييم": BASIC,
    "اسم مستخدم تقرير التقييم": INTAKE,
    "تاريخ المعاينة": INSPECTOR,
    "اسم المالك": INTAKE,
    "رقم الطلب": INTAKE,
    // Purpose, basis and premise derive from the work order's assignment type.
    "الغرض من التقييم": INTAKE,
    "تاريخ الطلب": INTAKE,
    "أساس القيمة": INTAKE,
    "فرضية القيمة (الاستخدام المفترض)": INTAKE,
    "نوع التقرير": REPORT_SETTINGS,
    "عملة التقييم": REPORT_SETTINGS,
    "نوع العقار": INSPECTOR,
    "أساليب التقييم المستخدمة": BASIC,
  },
  "6": {
    "نوع العقار": INSPECTOR,
    "حالة العقار": INSPECTOR,
    "وصف العقار": INSPECTOR,
    "نوع الملكية": INTAKE,
    "هل يوجد منقولات": INSPECTOR,
    "وصف المنقولات": INSPECTOR,
  },
  "7": {
    "اسم المنطقة": INTAKE,
    "اسم المدينة": INTAKE,
    "اسم الحي": INTAKE,
    "اسم المخطط": INTAKE,
    "رقم المخطط": INTAKE,
    "رقم البلك": INTAKE,
    "رقم القطعة": INTAKE,
    "استخدام العقار": INTAKE,
    "إحداثيات الموقع": INSPECTOR,
    "اسم المالك": INTAKE,
    "رقم الصك": INTAKE,
    "تاريخ الصك": INTAKE,
    "رقم رخصة البناء وتاريخها": INSPECTOR,
    "عمر البناء": INSPECTOR,
    "محضر التجزئة": INTAKE,
    "حالة البناء": INSPECTOR,
    "حالة الإشغال": INSPECTOR,
  },
  "9": { "مساحة الأرض (حسب الصك)": INTAKE },
  "11": {
    سور: INSPECTOR,
    مواقف: INSPECTOR,
    مسبح: INSPECTOR,
    مصعد: INSPECTOR,
    "تكييف مركزي": INSPECTOR,
    خزانات: INSPECTOR,
    تشجير: INSPECTOR,
  },
  "20": {
    "سعر المتر المستورد من طريقة المقارنة": COST,
    "سعر متر الأرض من مقارنات الأراضي الفضاء": COST,
    "مساحة الأرض (م²)": INTAKE,
    "قيمة الأرض": COST,
  },
  "23": {
    "العمر الفعلي": INSPECTOR,
    "العمر الاقتصادي": COST,
    "التقادم المادي": COST,
    "التقادم الوظيفي": COST,
    "التقادم الخارجي": COST,
    "مجموع التقادم": COST,
    "قيمة الإهلاك": COST,
    "قيمة المباني بعد الإهلاك": COST,
    "قيمة الأرض": COST,
    "ناتج أسلوب التكلفة (الأرض + المباني)": COST,
  },
  "24": { "مبرر استخدام طرق التقييم": FINAL },
  "25": { "القيمة المرجّحة": FINAL, "قيمة العقار": FINAL },
  "30": {
    "التأثيرات البيئية": REVIEW,
    "التأثيرات الاجتماعية": REVIEW,
    "تأثيرات الحوكمة": REVIEW,
  },
  "33": { الموقع: INTAKE, "إحداثيات الموقع": INSPECTOR },
};

/** §25 — printed only when the value basis is liquidation. */
const LIQUIDATION_FIELDS: Record<string, FieldOrigin> = {
  "نسبة خصم التصفية المنظمة": FINAL,
  "مبرر معامل التصفية": FINAL,
};

/** §26 approval table (the certified valuer). */
const APPROVAL_FIELDS: Record<string, FieldOrigin> = {
  الاسم: VALUERS,
  "رقم العضوية": VALUERS,
  "فئة العضوية": VALUERS,
  صفته: VALUERS,
  "تاريخ انتهاء العضوية": VALUERS,
  "فرع التقييم": REPORT_SETTINGS,
};

/** §26 participant rows filled from the valuers roster (one column per participant). */
const PARTICIPANT_ROWS = [
  "المسمى الوظيفي",
  "فئة العضوية",
  "رقم العضوية",
  "تاريخ انتهاء العضوية",
] as const;

const BOUNDARY_SIDES = new Set(["الشمالية", "الجنوبية", "الشرقية", "الغربية"]);
const METERED_SERVICES = new Set(["كهرباء", "ماء"]);

/** §19 rows with one value per adopted comparable — factor rows stay unmarked (dash = not applied). */
const ADJUSTMENT_COMPARABLE_ROWS = new Set([
  "وصف العقار المقارن",
  "قيمة العقارات المقارنة",
  "سعر البيع بعد تسوية شروط التمويل وظروف السوق",
  "مجموع نسب التسويات (٪)",
  "سعر البيع بعد التسويات",
  "الأوزان النسبية للعقارات المقارنة",
]);

/** What a marked cell carries — enough to ask its source or open the appraiser tab. */
export type ReportMissingCell = {
  label: string;
  source: ReportFieldSource;
  tab?: ReportAppraiserTab;
  section?: ReportSettingsSection;
};

export type ReportMissingField = ReportMissingCell & {
  /** DOM id of the first marked cell with this label. */
  targetId: string;
  /** How many cells in the report show this gap. */
  count: number;
};

const MISSING_ATTR = "data-rpt-missing";
const MISSING_SELECTOR = `td[${MISSING_ATTR}]`;

const text = (el: Element | null | undefined) => normLabel(el?.textContent ?? "");

function tdCells(row: Element): Element[] {
  return [...row.children].filter((c) => c.tagName === "TD");
}

function headerTexts(table: Element | null | undefined): string[] {
  const first = table?.querySelector("tr");
  return first ? [...first.querySelectorAll("th")].map((th) => text(th)) : [];
}

function isEmptyValue(cell: Element): boolean {
  if (cell.querySelector("img, image-slot, figure")) return false;
  const t = text(cell);
  return !t || t === "—" || t === "-";
}

export function missingCellTitle(cell: ReportMissingCell): string {
  if (cell.source === "appraiser" && cell.tab) {
    return `ناقص — اضغط للانتقال إلى «${REPORT_APPRAISER_TAB_LABELS[cell.tab]}»`;
  }
  return `ناقص — اضغط لإشعار المسؤول (${REPORT_FIELD_SOURCES[cell.source].label})`;
}

type MarkCell = (
  cell: Element | null | undefined,
  label: string,
  origin: FieldOrigin,
) => void;

function createMarker(): MarkCell {
  let n = 0;
  return (cell, label, origin) => {
    if (!cell || cell.tagName !== "TD" || !isEmptyValue(cell)) return;
    if (cell.hasAttribute(MISSING_ATTR)) return;
    n += 1;
    if (!cell.id) cell.id = `rpt-missing-${n}`;
    cell.setAttribute(MISSING_ATTR, "1");
    cell.setAttribute("data-rpt-missing-source", origin.source);
    cell.setAttribute("data-rpt-missing-label", label);
    if (origin.tab) cell.setAttribute("data-rpt-missing-tab", origin.tab);
    if (origin.section) cell.setAttribute("data-rpt-missing-section", origin.section);
    cell.setAttribute("title", missingCellTitle({ label, ...origin }));
  };
}

function markKeyed(
  scope: Element,
  fields: Record<string, FieldOrigin>,
  mark: MarkCell,
) {
  scope.querySelectorAll("td.k").forEach((labelCell) => {
    const label = text(labelCell);
    const origin = fields[label];
    if (origin) mark(labelCell.nextElementSibling, label, origin);
  });
}

function rowByFirstCell(
  scope: Element,
  match: (label: string) => boolean,
): Element[] | null {
  for (const row of scope.querySelectorAll("tr")) {
    const cells = tdCells(row);
    if (cells.length > 1 && match(text(cells[0]))) return cells;
  }
  return null;
}

function markBoundaries(sec: Element, origin: FieldOrigin, mark: MarkCell) {
  for (const table of sec.querySelectorAll("table")) {
    const headers = headerTexts(table);
    for (const row of table.querySelectorAll("tr")) {
      const cells = tdCells(row);
      const side = text(cells[0]);
      if (!BOUNDARY_SIDES.has(side)) continue;
      for (const i of [1, 2]) {
        mark(cells[i], `${headers[i] || "الحد"} (الجهة ${side})`, origin);
      }
    }
  }
}

function markServices(sec: Element, mark: MarkCell) {
  for (const table of sec.querySelectorAll("table")) {
    const headers = headerTexts(table);
    for (const row of table.querySelectorAll("tr")) {
      const cells = tdCells(row);
      const service = text(cells[0]);
      // Meter count / numbers only matter when the service is on site.
      if (!METERED_SERVICES.has(service) || text(cells[1]) !== "متوفر") continue;
      for (const i of [2, 3]) {
        mark(cells[i], `${headers[i] || "العدادات"} (${service})`, INSPECTOR);
      }
    }
  }
}

function markNumberedRows(
  table: Element | null | undefined,
  count: number,
  rowName: string,
  origin: FieldOrigin,
  mark: MarkCell,
) {
  if (!table || count <= 0) return;
  const headers = headerTexts(table);
  for (const row of table.querySelectorAll("tr")) {
    const cells = tdCells(row);
    const n = Number.parseInt(text(cells[0]), 10);
    if (!/^\d+$/.test(text(cells[0])) || n > count) continue;
    cells.slice(1).forEach((cell, i) => {
      mark(cell, `${headers[i + 1] || "بيان"} (${rowName} ${n})`, origin);
    });
  }
}

function markAdjustments(
  sec: Element,
  fill: ValuationReportLiveFill,
  mark: MarkCell,
) {
  if (fill.methodRow[0] === "غير مستخدم") return;
  const comps = fill.comparableRows.length;
  for (const row of sec.querySelectorAll("tr")) {
    const cells = tdCells(row);
    const label = text(cells[0]);
    if (comps > 0 && ADJUSTMENT_COMPARABLE_ROWS.has(label)) {
      cells.slice(1).forEach((cell, i) => {
        mark(cell, `${label} (المقارن ${i + 1})`, MARKET);
      });
    } else if (label === "المتوسط المرجح لسعر المتر") {
      mark(cells[1], label, MARKET);
    } else if (label.startsWith("القيمة بطريقة المقارنة")) {
      mark(cells[1], "القيمة بطريقة المقارنة", MARKET);
    }
  }
}

function markRecon(sec: Element, mark: MarkCell) {
  const table = [...sec.querySelectorAll("table")].find((t) => t.querySelector("th"));
  if (!table) return;
  const headers = headerTexts(table);
  for (const row of table.querySelectorAll("tr")) {
    const cells = tdCells(row);
    const label = text(cells[0]);
    if (label.startsWith("أسلوب") && !text(row).includes("غير مستخدم")) {
      cells.slice(1).forEach((cell, i) => {
        mark(cell, `${headers[i + 1] || "القيمة"} (${label})`, FINAL);
      });
    } else if (label === "مجموع نسب المشاركة") {
      // Only the percentage column — the value columns are blank by design.
      mark(cells[2], label, FINAL);
    } else if (label === "القيمة المرجّحة") {
      mark(cells[1], label, FINAL);
    }
  }
}

function markParticipants(sec: Element, mark: MarkCell) {
  const heading = [...sec.querySelectorAll("h2")].find((h) =>
    text(h).includes("إعتماد"),
  );
  const approval =
    heading?.nextElementSibling?.tagName === "TABLE"
      ? heading.nextElementSibling
      : null;
  const participants = [...sec.querySelectorAll("table")].find(
    (t) => t !== approval,
  );
  if (participants) {
    const names = (
      rowByFirstCell(participants, (l) => l === "الاسم") ?? []
    )
      .slice(1)
      .map((c) => text(c));
    for (const rowLabel of PARTICIPANT_ROWS) {
      const cells = rowByFirstCell(participants, (l) => l === rowLabel);
      cells?.slice(1).forEach((cell, i) => {
        const who = names[i] && names[i] !== "—" ? names[i] : `المشارك ${i + 1}`;
        mark(cell, `${rowLabel} (${who})`, VALUERS);
      });
    }
    // One branch for every participant — the same gap.
    rowByFirstCell(participants, (l) => l === "فرع التقييم")
      ?.slice(1)
      .forEach((cell) => mark(cell, "فرع التقييم", REPORT_SETTINGS));
  }
  if (approval) markKeyed(approval, APPROVAL_FIELDS, mark);
}

/** Mark every empty sourced cell still present in the filled report; returns them grouped by label. */
export function markReportMissingFields(
  dom: Document,
  fill: ValuationReportLiveFill,
): ReportMissingField[] {
  const mark = createMarker();
  const sec = (id: string) => dom.querySelector(`[data-sec="${id}"]`);

  for (const id of ["1", "2", "6", "7", "8", "9", "11", "13", "14", "17", "19", "20", "21", "22", "23", "24", "25", "26", "30", "33"]) {
    const scope = sec(id);
    if (!scope) continue;
    const keyed = KEYED_FIELDS[id];
    if (keyed) markKeyed(scope, keyed, mark);
    switch (id) {
      case "8":
        markBoundaries(scope, fill.boundariesSource === "survey" ? SURVEY : INTAKE, mark);
        break;
      case "9":
        mark(
          rowByFirstCell(scope, (l) => l === "مجموع مسطحات البناء")?.[1],
          "مجموع مسطحات البناء",
          INSPECTOR,
        );
        break;
      case "13":
        mark(scope.querySelector("td.v, td.num"), "وصف العيوب الإنشائية", INSPECTOR);
        break;
      case "14":
        markServices(scope, mark);
        break;
      case "17":
        markNumberedRows(
          [...scope.querySelectorAll("table")].find((t) => t.querySelector("th")),
          fill.comparableRows.length,
          "المقارن",
          MARKET,
          mark,
        );
        break;
      case "19":
        markAdjustments(scope, fill, mark);
        break;
      case "20":
        markNumberedRows(
          scope.querySelector("[data-land-comps]"),
          fill.landComparableRows.length,
          "مقارن الأرض",
          COST,
          mark,
        );
        break;
      case "21":
        mark(
          rowByFirstCell(scope, (l) => l === "مجموع التكلفة المباشرة")?.[1],
          "مجموع التكلفة المباشرة",
          COST,
        );
        break;
      case "22":
        mark(
          rowByFirstCell(scope, (l) => l === "مجموع النسب غير المباشرة")?.[1],
          "مجموع النسب غير المباشرة",
          COST,
        );
        mark(
          rowByFirstCell(scope, (l) => l.startsWith("التكلفة الإجمالية"))?.[1],
          "التكلفة الإجمالية",
          COST,
        );
        break;
      case "24":
        markRecon(scope, mark);
        break;
      case "25":
        if (fill.liquidationDiscountOn ?? fill.isLiquidation) {
          markKeyed(scope, LIQUIDATION_FIELDS, mark);
        }
        break;
      case "26":
        markParticipants(scope, mark);
        break;
    }
  }

  return reportMissingFieldsFromRoot(dom);
}

/** The marked cell under a click, with what it needs to ask its source. */
export function readMissingCell(target: EventTarget | null): {
  element: HTMLElement;
  cell: ReportMissingCell;
} | null {
  if (!(target instanceof Element)) return null;
  const element = target.closest<HTMLElement>(MISSING_SELECTOR);
  if (!element) return null;
  const source = element.getAttribute("data-rpt-missing-source") ?? "";
  if (!(source in REPORT_FIELD_SOURCES)) return null;
  const tab = element.getAttribute("data-rpt-missing-tab") ?? "";
  const section = element.getAttribute("data-rpt-missing-section") ?? "";
  return {
    element,
    cell: {
      label: element.getAttribute("data-rpt-missing-label") ?? "",
      source: source as ReportFieldSource,
      tab: tab in REPORT_APPRAISER_TAB_LABELS ? (tab as ReportAppraiserTab) : undefined,
      section:
        section === "company" || section === "evaluator" || section === "report"
          ? section
          : undefined,
    },
  };
}

/** Marked cells grouped by source + label, first cell as target. */
export function reportMissingFieldsFromRoot(root: ParentNode): ReportMissingField[] {
  const byKey = new Map<string, ReportMissingField>();
  root.querySelectorAll(MISSING_SELECTOR).forEach((el) => {
    const read = readMissingCell(el);
    if (!read) return;
    const key = missingCellKey(read.cell);
    const seen = byKey.get(key);
    if (seen) {
      seen.count += 1;
      return;
    }
    byKey.set(key, { ...read.cell, targetId: el.id, count: 1 });
  });
  return [...byKey.values()];
}

/** Same gap wherever it prints (e.g. «اسم المالك» in §2 and §7). */
export function missingCellKey(cell: ReportMissingCell): string {
  return `${cell.source}|${cell.label}`;
}

/** Every printed cell of one gap, for the «notified» state after sending. */
export function cellsForMissingKey(root: ParentNode, key: string): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(MISSING_SELECTOR)].filter((el) => {
    const read = readMissingCell(el);
    return read ? missingCellKey(read.cell) === key : false;
  });
}
