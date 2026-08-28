import type { EnfazTrackingRowDto } from "@platform/api-client";
import type { RevenueStage } from "./finance-nav";

/** أيام قبل اعتبار المعاملة «متوقفة» (فاتورة متأخرة أو جاهزة ولم تُرفع). */
const REVENUE_STALL_DAYS = 30;

function daysSinceIso(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

function isStalledWithoutInvoice(row: EnfazTrackingRowDto): boolean {
  if (row.invoiceNumber) return false;
  const age = daysSinceIso(row.completedAtUtc);
  return age != null && age >= REVENUE_STALL_DAYS;
}

/**
 * يطابق مرجع منطق المالية على بيانات التتبّع.
 * «متوقفة» = علامة يدوية، أو فاتورة مفتوحة متأخرة، أو مكتملة ≥30 يوماً دون فوترة/رفع.
 */
export function resolveRevenueStage(row: EnfazTrackingRowDto): RevenueStage {
  const flag = (row.financeFlag ?? "").toLowerCase();
  if (flag === "excluded") return "excluded";
  if (flag === "stopped" || flag === "difficult") return "stopped";

  const work = (row.workStatus ?? "").toLowerCase();
  if (work === "cancelled" || work === "excluded") return "excluded";
  if (work !== "done") return "under_study";

  const inv = (row.invoiceStatus ?? "").toLowerCase();
  if (inv === "collected") return "collected";

  const openInvoice =
    inv === "issued" ||
    inv === "partially_collected" ||
    Boolean(row.invoiceNumber && inv !== "collected");

  if (openInvoice && row.isOverdue) return "stopped";
  if (openInvoice) return "awaiting_collection";

  // جاهزة ولم تُرفع / لم تُفوتَر — متوقفة بسنّ العمر
  if (isStalledWithoutInvoice(row)) return "stopped";

  // أتعاب معبّأة = مطابقة تمت → مساعد الفوترة
  if (row.enfazFilled && row.enfazFeeSar > 0) return "billing_assistant";

  // مكتملة وجاهزة للمطابقة/الفوترة
  return "eligible";
}

type RevenueStageBuckets = Record<RevenueStage, EnfazTrackingRowDto[]>;

export function bucketRevenueRows(
  rows: EnfazTrackingRowDto[],
): RevenueStageBuckets {
  const empty = (): EnfazTrackingRowDto[] => [];
  const buckets: RevenueStageBuckets = {
    under_study: empty(),
    eligible: empty(),
    billing_assistant: empty(),
    awaiting_collection: empty(),
    collected: empty(),
    stopped: empty(),
    excluded: empty(),
  };
  for (const row of rows) {
    buckets[resolveRevenueStage(row)].push(row);
  }
  return buckets;
}

export function revenueStageEmptyHint(stage: RevenueStage): string | null {
  switch (stage) {
    case "eligible":
      return "تظهر هنا المعاملات المكتملة الجاهزة للمطابقة قبل الفوترة.";
    case "billing_assistant":
      return "معاملات طُوبِقت أتعابها وبانتظار تسجيل الفاتورة.";
    case "awaiting_collection":
      return "فواتير مرفوعة بانتظار توثيق التحويل.";
    case "stopped":
      return "فواتير مفتوحة متأخرة، أو معاملات مكتملة ≥30 يوماً دون فوترة.";
    case "under_study":
      return "معاملات لم تكتمل بعد — لا إجراء مالي.";
    case "excluded":
      return "ملغاة أو مستبعدة نهائياً — عرض فقط.";
    case "collected":
      return "معاملات وُثّق تحصيل فاتورتها.";
    default:
      return null;
  }
}

/** تجميع صفوف لنفس أمر العمل (العرض بالطيّ). */
export function groupRowsByPo(
  rows: EnfazTrackingRowDto[],
): { poNumber: string; rows: EnfazTrackingRowDto[] }[] {
  const map = new Map<string, EnfazTrackingRowDto[]>();
  for (const row of rows) {
    const key = row.poNumber || "—";
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return [...map.entries()].map(([poNumber, group]) => ({
    poNumber,
    rows: group,
  }));
}

/** التحصيل على الفاتورة: تجميع بانتظار التحصيل برقم الفاتورة. */
export function groupRowsByInvoice(
  rows: EnfazTrackingRowDto[],
): { invoiceKey: string; invoiceNumber: string; rows: EnfazTrackingRowDto[] }[] {
  const map = new Map<string, EnfazTrackingRowDto[]>();
  for (const row of rows) {
    const inv = (row.invoiceNumber ?? "").trim();
    const key = inv || `po:${row.poNumber || "—"}`;
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return [...map.entries()]
    .map(([invoiceKey, group]) => ({
      invoiceKey,
      invoiceNumber: (group[0]?.invoiceNumber ?? "").trim() || "—",
      rows: group,
    }))
    .sort((a, b) => a.invoiceNumber.localeCompare(b.invoiceNumber, "en"));
}

/** منسّق مشترك — إنشاء Intl.DateTimeFormat لكل صف مكلف */
const DATE_EN = new Intl.DateTimeFormat("en-GB");

export function formatDateEn(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  return DATE_EN.format(t);
}

export function uniqueCities(rows: EnfazTrackingRowDto[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    const c = (r.city ?? "").trim();
    if (c) set.add(c);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "ar"));
}

function taxableFeesSar(row: {
  caseStudyFeeSar: number;
  surveyFeeSar: number;
}): number {
  return (row.caseStudyFeeSar || 0) + (row.surveyFeeSar || 0);
}

/** (تقييم+رفع) + ضريبة 15٪ على مجموعهما + مفاتيح شاملة الضريبة */
function computeEnfazLineTotals(input: {
  caseStudyFeeSar: number;
  surveyFeeSar: number;
  keyFeeSar: number;
}): { taxable: number; vat: number; key: number; total: number } {
  const taxable = taxableFeesSar(input);
  const vat = Math.round(taxable * 0.15 * 100) / 100;
  const key = input.keyFeeSar || 0;
  return { taxable, vat, key, total: taxable + vat + key };
}

/** تفكيك بنود الأتعاب + الضريبة — مطابق حساب المرجع المنطقي. */
export function revenueAmountsFromRow(row: {
  caseStudyFeeSar: number;
  surveyFeeSar: number;
  keyFeeSar?: number;
  enfazFeeSar: number;
}): { taxable: number; vat: number; key: number; withVat: number; total: number } {
  const caseStudy = row.caseStudyFeeSar || 0;
  const survey = row.surveyFeeSar || 0;
  let key = row.keyFeeSar ?? 0;
  if (!(key > 0) && row.enfazFeeSar > 0) {
    key = Math.max(0, (row.enfazFeeSar || 0) - caseStudy - survey);
  }
  const { taxable, vat, total } = computeEnfazLineTotals({
    caseStudyFeeSar: caseStudy,
    surveyFeeSar: survey,
    keyFeeSar: key,
  });
  return {
    taxable,
    vat,
    key,
    withVat: taxable + vat,
    total,
  };
}

export function rowAgeDays(row: EnfazTrackingRowDto): number | null {
  return daysSinceIso(row.invoiceIssuedAtUtc ?? row.completedAtUtc);
}

export function stoppedReasonLabel(row: EnfazTrackingRowDto): string {
  const note = (row.financeFlagNote ?? "").trim();
  if (note) return note;
  const flag = (row.financeFlag ?? "").toLowerCase();
  if (flag === "difficult") return "متعذّرة من مركز التصفية";
  if (flag === "stopped") return "معلَّقة يدوياً";
  if (row.isOverdue && row.invoiceNumber)
    return "فاتورة مفتوحة متأخرة عن موعد التحصيل";
  if (!row.invoiceNumber) return "مكتملة ≥30 يوماً دون تسجيل فاتورة";
  return "متوقفة";
}

/** تاريخ مرجعي لفلتر الفترة (إصدار فاتورة / اكتمال). */
export function revenuePeriodDateIso(row: EnfazTrackingRowDto): string | null {
  return row.invoiceIssuedAtUtc ?? row.completedAtUtc;
}

export function revenueInPeriod(
  iso: string | null | undefined,
  period: "all" | "30" | "90",
): boolean {
  if (period === "all") return true;
  const age = daysSinceIso(iso);
  // قيد الدراسة غالباً بلا تاريخ اكتمال — لا تُستبعد كلها بفلتر الفترة
  if (age == null) return true;
  const max = period === "30" ? 30 : 90;
  return age <= max;
}
