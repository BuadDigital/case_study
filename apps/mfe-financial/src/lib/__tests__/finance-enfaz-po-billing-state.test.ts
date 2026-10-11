import { describe, expect, it } from "vitest";
import type { PoEnfazRevenueLineDto } from "@platform/api-client";
import {
  EMPTY_BILLING_TOTALS,
  billingActionHint,
  billingTotals,
  collectAmountDiffers,
  collectMismatchPrompt,
  defaultCollectAmount,
  draftFromBillingLines,
  invoiceHeaderPill,
  invoiceStatusLabel,
  lineTotal,
  patchLineDraft,
  remainingToCollect,
  saveLinesRequest,
} from "../finance-enfaz-po-billing-state";

function line(
  propertyId: string,
  overrides: Partial<PoEnfazRevenueLineDto> = {},
): PoEnfazRevenueLineDto {
  return {
    id: `line-${propertyId}`,
    poNumber: "PO-1",
    propertyId,
    propertyLabel: `عقار ${propertyId}`,
    workStatus: "done",
    workStatusLabel: "مكتملة",
    caseStudyFeeSar: 0,
    surveyFeeSar: 0,
    keyFeeSar: 0,
    keyEntitlementEnvelopeId: null,
    hasKeyEntitlement: false,
    includedInBilling: true,
    ...overrides,
  } as PoEnfazRevenueLineDto;
}

describe("lineTotal", () => {
  it("adds the three fee inputs, treating blanks and junk as zero", () => {
    expect(lineTotal(undefined)).toBe(0);
    expect(
      lineTotal({ caseStudyFee: "100", surveyFee: "", keyFee: "abc", inc: true }),
    ).toBe(100);
    expect(
      lineTotal({ caseStudyFee: "100", surveyFee: "50.5", keyFee: "20", inc: false }),
    ).toBe(170.5);
  });

  it("clamps negatives to 0 and keeps 2 decimals, as the server saves them", () => {
    expect(
      lineTotal({ caseStudyFee: "-100", surveyFee: "10.005", keyFee: "١٠", inc: true }),
    ).toBe(20.01);
  });
});

describe("invoiceStatusLabel", () => {
  it("maps the known statuses and defaults to «مُفوتَرة»", () => {
    expect(invoiceStatusLabel("collected")).toBe("محصّلة");
    expect(invoiceStatusLabel("partially_collected")).toBe("تحصيل جزئي");
    expect(invoiceStatusLabel("issued")).toBe("صادرة");
    expect(invoiceStatusLabel(null)).toBe("مُفوتَرة");
    expect(invoiceStatusLabel("something-else")).toBe("مُفوتَرة");
  });
});

describe("draftFromBillingLines", () => {
  it("copies fees as strings with zero as empty and keeps the inclusion flag", () => {
    expect(
      draftFromBillingLines([
        line("a", { caseStudyFeeSar: 100, surveyFeeSar: 0, keyFeeSar: 25 }),
        line("b", { includedInBilling: false }),
      ]),
    ).toEqual({
      a: { caseStudyFee: "100", surveyFee: "", keyFee: "25", inc: true },
      b: { caseStudyFee: "", surveyFee: "", keyFee: "", inc: false },
    });
  });
});

describe("patchLineDraft", () => {
  it("merges into an existing line and defaults a new one to included", () => {
    const prev = { a: { caseStudyFee: "1", surveyFee: "2", keyFee: "3", inc: false } };
    expect(patchLineDraft(prev, "a", { surveyFee: "9" })).toEqual({
      a: { caseStudyFee: "1", surveyFee: "9", keyFee: "3", inc: false },
    });
    expect(patchLineDraft(prev, "b", { keyFee: "7" }).b).toEqual({
      caseStudyFee: "",
      surveyFee: "",
      keyFee: "7",
      inc: true,
    });
    expect(prev.a.surveyFee).toBe("2");
  });
});

describe("remainingToCollect / defaultCollectAmount", () => {
  it("never goes below zero and prefills only a positive balance", () => {
    expect(remainingToCollect({ totalSar: 500, collectedAmountSar: 200 })).toBe(300);
    expect(remainingToCollect({ totalSar: 100, collectedAmountSar: 150 })).toBe(0);
    expect(defaultCollectAmount({ totalSar: 500, collectedAmountSar: 200 })).toBe("300");
    expect(defaultCollectAmount({ totalSar: 100, collectedAmountSar: 100 })).toBe("");
  });
});

describe("billingTotals", () => {
  it("returns zeros without lines", () => {
    expect(billingTotals(undefined, {})).toBe(EMPTY_BILLING_TOTALS);
  });

  it("counts only included, completed lines and taxes valuation+survey only", () => {
    const lines = [
      line("a"),
      line("b"),
      line("c", { workStatus: "cancelled" }),
      line("d"),
    ];
    const draft = {
      a: { caseStudyFee: "100", surveyFee: "100", keyFee: "30", inc: true },
      b: { caseStudyFee: "50", surveyFee: "", keyFee: "", inc: false },
      c: { caseStudyFee: "999", surveyFee: "", keyFee: "", inc: true },
    };
    expect(billingTotals(lines, draft)).toEqual({
      taxable: 200,
      key: 30,
      vat: 30,
      total: 260,
      billable: 1,
      sub: 200,
    });
  });

  it("rounds VAT once on the work order total, half away from zero (= the invoice)", () => {
    const lines = [line("a"), line("b")];
    // 3500.5 × 15% = 525.075 → 525.08 (Math.round gave 525.07).
    expect(
      billingTotals([line("a")], {
        a: { caseStudyFee: "3000.5", surveyFee: "500", keyFee: "", inc: true },
      }),
    ).toMatchObject({ taxable: 3500.5, vat: 525.08, total: 4025.58 });
    // Two lines of 100.5: VAT on 201 = 30.15, not 15.08 + 15.08 = 30.16.
    expect(
      billingTotals(lines, {
        a: { caseStudyFee: "100.5", surveyFee: "", keyFee: "", inc: true },
        b: { caseStudyFee: "100.5", surveyFee: "", keyFee: "", inc: true },
      }),
    ).toMatchObject({ taxable: 201, vat: 30.15, total: 231.15 });
  });

  it("clamps a typed negative fee to 0 and rounds 3+ decimals like the server", () => {
    expect(
      billingTotals([line("a")], {
        a: { caseStudyFee: "-100", surveyFee: "200.555", keyFee: "-5", inc: true },
      }),
    ).toMatchObject({ taxable: 200.56, key: 0, vat: 30.08, total: 230.64 });
  });
});

describe("saveLinesRequest", () => {
  it("serialises numbers from the draft and includes undrafted lines with zero fees", () => {
    const request = saveLinesRequest(
      [line("a", { keyEntitlementEnvelopeId: "env-1" }), line("b")],
      { a: { caseStudyFee: "10", surveyFee: "x", keyFee: "5", inc: false } },
    );
    expect(request).toEqual({
      lines: [
        {
          propertyId: "a",
          caseStudyFeeSar: 10,
          surveyFeeSar: 0,
          keyFeeSar: 5,
          keyEntitlementEnvelopeId: "env-1",
          includedInBilling: false,
        },
        {
          propertyId: "b",
          caseStudyFeeSar: 0,
          surveyFeeSar: 0,
          keyFeeSar: 0,
          keyEntitlementEnvelopeId: null,
          includedInBilling: true,
        },
      ],
    });
  });
});

describe("collectAmountDiffers", () => {
  it("tolerates sub-cent noise and ignores a zero balance", () => {
    expect(collectAmountDiffers(300, 300.005)).toBe(false);
    expect(collectAmountDiffers(250, 300)).toBe(true);
    expect(collectAmountDiffers(250, 0)).toBe(false);
  });
});

describe("invoiceHeaderPill", () => {
  it("describes an issued invoice with its status, overdue flag and number", () => {
    expect(
      invoiceHeaderPill({
        invoiceNumber: "INV-7",
        invoiceStatus: "issued",
        isOverdue: true,
        poReadyForBilling: true,
      }),
    ).toEqual({ label: "صادرة · متأخر · INV-7", tone: "danger" });
    expect(
      invoiceHeaderPill({
        invoiceNumber: "INV-8",
        invoiceStatus: "partially_collected",
        isOverdue: false,
        poReadyForBilling: true,
      }),
    ).toEqual({ label: "تحصيل جزئي · INV-8", tone: "warning" });
    expect(
      invoiceHeaderPill({
        invoiceNumber: "INV-9",
        invoiceStatus: "collected",
        isOverdue: false,
        poReadyForBilling: true,
      }).tone,
    ).toBe("success");
  });

  it("falls back to readiness before an invoice exists", () => {
    const base = { invoiceNumber: null, invoiceStatus: null, isOverdue: false };
    expect(invoiceHeaderPill({ ...base, poReadyForBilling: true })).toEqual({
      label: "جاهز للإصدار",
      tone: "default",
    });
    expect(invoiceHeaderPill({ ...base, poReadyForBilling: false })).toEqual({
      label: "يحتاج حفظ",
      tone: "warning",
    });
  });
});

describe("billingActionHint", () => {
  it("picks the hint for the current step", () => {
    expect(billingActionHint({ fullyCollected: true, issued: true, total: 1 })).toBe(
      "الفاتورة محصّلة بالكامل.",
    );
    expect(billingActionHint({ fullyCollected: false, issued: true, total: 1 })).toBe(
      "سجّل مبلغ التحصيل (جزئي أو كامل).",
    );
    expect(billingActionHint({ fullyCollected: false, issued: false, total: 0 })).toBe(
      "عبّئ أتعاب معاملة واحدة على الأقل قبل الإصدار.",
    );
    expect(billingActionHint({ fullyCollected: false, issued: false, total: 10 })).toBe(
      "احفظ ثم أصدر الفاتورة.",
    );
  });
});

describe("amount formatting", () => {
  it("uses the shared SAR format in the mismatch prompt", () => {
    expect(collectMismatchPrompt(250, 1000)).toBe(
      "مبلغ التحويل (250 ر.س) يختلف عن المتبقي (1,000 ر.س). المتابعة؟",
    );
  });
});
