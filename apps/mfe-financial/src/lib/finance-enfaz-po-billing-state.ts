import type {
  PoEnfazBillingDto,
  PoEnfazRevenueLineDto,
  SavePoEnfazBillingRequest,
} from "@platform/api-client";

/**
 * Pure decisions behind the Enfaz work-order billing screen
 * (`FinanceEnfazPoBilling` and its regions): the fee drafts, totals, status
 * labels and hints. No React, no DOM.
 */

export type LineDraft = {
  caseStudyFee: string;
  surveyFee: string;
  keyFee: string;
  inc: boolean;
};

export type LineDraftMap = Record<string, LineDraft>;

export function lineTotal(d: LineDraft | undefined): number {
  if (!d) return 0;
  return (
    (Number(d.caseStudyFee) || 0) +
    (Number(d.surveyFee) || 0) +
    (Number(d.keyFee) || 0)
  );
}

export function invoiceStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "collected":
      return "محصّلة";
    case "partially_collected":
      return "تحصيل جزئي";
    case "issued":
      return "صادرة";
    default:
      return "مُفوتَرة";
  }
}

/** Editable copy of the saved lines — zero fees show as empty inputs. */
export function draftFromBillingLines(
  lines: PoEnfazRevenueLineDto[],
): LineDraftMap {
  const next: LineDraftMap = {};
  for (const line of lines) {
    next[line.propertyId] = {
      caseStudyFee: String(line.caseStudyFeeSar || ""),
      surveyFee: String(line.surveyFeeSar || ""),
      keyFee: String(line.keyFeeSar || ""),
      inc: line.includedInBilling,
    };
  }
  return next;
}

/** Merge a partial edit into one line, defaulting a line the draft did not have yet. */
export function patchLineDraft(
  prev: LineDraftMap,
  propertyId: string,
  patch: Partial<LineDraft>,
): LineDraftMap {
  return {
    ...prev,
    [propertyId]: {
      caseStudyFee: prev[propertyId]?.caseStudyFee ?? "",
      surveyFee: prev[propertyId]?.surveyFee ?? "",
      keyFee: prev[propertyId]?.keyFee ?? "",
      inc: prev[propertyId]?.inc ?? true,
      ...patch,
    },
  };
}

export function remainingToCollect(
  billing: Pick<PoEnfazBillingDto, "totalSar" | "collectedAmountSar">,
): number {
  return Math.max(
    0,
    (billing.totalSar || 0) - (billing.collectedAmountSar || 0),
  );
}

/** Default collect-amount input after a load: the remaining balance, or empty when nothing is owed. */
export function defaultCollectAmount(
  billing: Pick<PoEnfazBillingDto, "totalSar" | "collectedAmountSar">,
): string {
  const remaining = remainingToCollect(billing);
  return remaining > 0 ? String(remaining) : "";
}

export type BillingTotals = {
  taxable: number;
  key: number;
  vat: number;
  total: number;
  billable: number;
  /** Legacy UI compat: taxable subtotal before VAT */
  sub: number;
};

export const EMPTY_BILLING_TOTALS: BillingTotals = {
  taxable: 0,
  key: 0,
  vat: 0,
  total: 0,
  billable: 0,
  sub: 0,
};

/** Totals of the included, completed lines as currently drafted. */
export function billingTotals(
  lines: PoEnfazRevenueLineDto[] | undefined,
  draft: LineDraftMap,
): BillingTotals {
  if (!lines) return EMPTY_BILLING_TOTALS;
  let taxable = 0;
  let key = 0;
  let billable = 0;
  for (const line of lines) {
    const d = draft[line.propertyId];
    if (!d?.inc || line.workStatus !== "done") continue;
    billable += 1;
    taxable += (Number(d.caseStudyFee) || 0) + (Number(d.surveyFee) || 0);
    key += Number(d.keyFee) || 0;
  }
  // 15% VAT on (valuation+survey) only — keys fees are VAT-inclusive
  const vat = Math.round(taxable * 0.15 * 100) / 100;
  return { taxable, key, vat, total: taxable + vat + key, billable, sub: taxable };
}

/** The save request built from the draft — a missing draft line saves as zero fees, included. */
export function saveLinesRequest(
  lines: PoEnfazRevenueLineDto[],
  draft: LineDraftMap,
): SavePoEnfazBillingRequest {
  return {
    lines: lines.map((line) => {
      const d = draft[line.propertyId];
      return {
        propertyId: line.propertyId,
        caseStudyFeeSar: Number(d?.caseStudyFee) || 0,
        surveyFeeSar: Number(d?.surveyFee) || 0,
        keyFeeSar: Number(d?.keyFee) || 0,
        keyEntitlementEnvelopeId: line.keyEntitlementEnvelopeId,
        includedInBilling: d?.inc ?? true,
      };
    }),
  };
}

/** True when a collect amount is meaningfully different from what is still owed. */
export function collectAmountDiffers(amount: number, remaining: number): boolean {
  return remaining > 0 && Math.abs(amount - remaining) > 0.009;
}

export type InvoiceHeaderPill = {
  label: string;
  tone: "danger" | "success" | "warning" | "default";
};

/** The pill beside the work-order number: invoice status, or the save / issue readiness. */
export function invoiceHeaderPill(
  billing: Pick<
    PoEnfazBillingDto,
    "invoiceNumber" | "invoiceStatus" | "isOverdue" | "poReadyForBilling"
  >,
): InvoiceHeaderPill {
  if (billing.invoiceNumber) {
    return {
      label: `${invoiceStatusLabel(billing.invoiceStatus)}${billing.isOverdue ? " · متأخر" : ""} · ${billing.invoiceNumber}`,
      tone: billing.isOverdue
        ? "danger"
        : billing.invoiceStatus === "collected"
          ? "success"
          : billing.invoiceStatus === "partially_collected"
            ? "warning"
            : "default",
    };
  }
  if (billing.poReadyForBilling) return { label: "جاهز للإصدار", tone: "default" };
  return { label: "يحتاج حفظ", tone: "warning" };
}

/** The one-line hint beside the action buttons. */
export function billingActionHint(args: {
  fullyCollected: boolean;
  issued: boolean;
  total: number;
}): string {
  if (args.fullyCollected) return "الفاتورة محصّلة بالكامل.";
  if (args.issued) return "سجّل مبلغ التحصيل (جزئي أو كامل).";
  if (args.total <= 0) return "عبّئ أتعاب معاملة واحدة على الأقل قبل الإصدار.";
  return "احفظ ثم أصدر الفاتورة.";
}

/** «1,234.5 ر.س» with en-US grouping — the screen's amount format. */
export function sarEn(n: number): string {
  return `${n.toLocaleString("en-US")} ر.س`;
}

/** The confirm prompt when the entered collect amount differs from the balance. */
export function collectMismatchPrompt(amount: number, remaining: number): string {
  return `مبلغ التحويل (${amount.toLocaleString("en-US")} ر.س) يختلف عن المتبقي (${remaining.toLocaleString("en-US")} ر.س). المتابعة؟`;
}
