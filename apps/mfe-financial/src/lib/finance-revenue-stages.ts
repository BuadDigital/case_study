import type { EnfazTrackingRowDto } from "@platform/api-client";
import { sumSar, toHalalas, vatSar } from "@platform/app-shared/format/money";
import type { RevenueStage } from "./finance-nav";

/** Days before a transaction is treated as «stopped» (overdue invoice or ready but not uploaded). */
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
 * Matches finance logic reference against tracking data.
 * «Stopped» = manual flag, overdue open invoice, or completed ≥30 days without billing/upload.
 *
 * How it works: decides one stage per deed row, top to bottom — manual flag (excluded / stopped /
 * difficult) → cancelled work → work not yet delivered (`under_study`) → collected → open invoice
 * (overdue → `stopped`, else `awaiting_collection`) → stalled 30 days without an invoice → the
 * accountant's mark → fees matched.
 *
 * Edge cases and the fix: «مؤهلة» used to mean «handed over»; a delivered deed is now billable only
 * after the accountant marks it «جاهز للفوترة» (Enfaz's procurement review takes time before any figures
 * exist). So an UNMARKED deed stays in `eligible` even when fees were typed earlier — otherwise it
 * would land in the billing assistant, where the invoice is refused because the order is not ready.
 * A marked deed moves to `billing_assistant` only once its fees are matched (`enfazFilled` and a total
 * above zero); marked with no fees stays in `eligible` for «مطابقة الأتعاب». The stall rule still runs
 * before the mark check, on the handover date.
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

  // Ready but not uploaded / not invoiced — stopped by age
  if (isStalledWithoutInvoice(row)) return "stopped";

  // Handed over to Enfaz, but its financial data has not appeared yet: the accountant has not marked
  // the deed «جاهز للفوترة», so it cannot be matched or invoiced — whatever fees were typed before.
  if (!row.billingReadyAtUtc) return "eligible";

  // Fees filled = match done → billing assistant
  if (row.enfazFilled && row.enfazFeeSar > 0) return "billing_assistant";

  // Marked ready for billing, fees still to match
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

/** Group rows for the same work order (collapsible display). */
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

/** Collection by invoice: group awaiting-collection by invoice number. */
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

/** Shared formatter — avoid new Intl.DateTimeFormat per row */
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

/** (valuation+survey) + 15% VAT on their sum + keys fees VAT-inclusive */
function computeEnfazLineTotals(input: {
  caseStudyFeeSar: number;
  surveyFeeSar: number;
  keyFeeSar: number;
}): { taxable: number; vat: number; key: number; total: number } {
  const taxable = taxableFeesSar(input);
  const vat = vatSar(taxable);
  const key = input.keyFeeSar || 0;
  return { taxable, vat, key, total: sumSar(taxable, vat, key) };
}

/** Break down fee lines + tax — matches logic-reference calculation. */
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
    withVat: sumSar(taxable, vat),
    total,
  };
}

type RevenueRowsTotals = { taxable: number; vat: number; key: number; total: number };

/**
 * Totals of several rows as the invoices charge them: VAT is rounded once on each work
 * order's (valuation+survey) total, not per line and summed (PoEnfazBillingDtoBuilder) —
 * two lines of 100.5 carry 30.15 VAT, not 30.16.
 */
export function revenueTotalsForRows(rows: readonly EnfazTrackingRowDto[]): RevenueRowsTotals {
  const taxableByPo = new Map<string, number>();
  let keyHalalas = 0;
  for (const row of rows) {
    const { taxable, key } = revenueAmountsFromRow(row);
    const po = row.poNumber || "";
    taxableByPo.set(po, (taxableByPo.get(po) ?? 0) + toHalalas(taxable));
    keyHalalas += toHalalas(key);
  }
  let taxableHalalas = 0;
  let vatHalalas = 0;
  for (const halalas of taxableByPo.values()) {
    taxableHalalas += halalas;
    vatHalalas += toHalalas(vatSar(halalas / 100));
  }
  return {
    taxable: taxableHalalas / 100,
    vat: vatHalalas / 100,
    key: keyHalalas / 100,
    total: (taxableHalalas + vatHalalas + keyHalalas) / 100,
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

/** Reference date for period filter (invoice issue / completion). */
export function revenuePeriodDateIso(row: EnfazTrackingRowDto): string | null {
  return row.invoiceIssuedAtUtc ?? row.completedAtUtc;
}

export function revenueInPeriod(
  iso: string | null | undefined,
  period: "all" | "30" | "90",
): boolean {
  if (period === "all") return true;
  const age = daysSinceIso(iso);
  // Under study often has no completion date — do not exclude them all via period filter
  if (age == null) return true;
  const max = period === "30" ? 30 : 90;
  return age <= max;
}
