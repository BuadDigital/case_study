import { describe, expect, it } from "vitest";
import type { ValuationIncomeApproachDto, ValuationReconciliationDto } from "@platform/api-client";

import { createEvaluatorDraft } from "../evaluator-window-data";
import { classifyHandOverBlockers } from "../handover-blockers";
import { buildReconSheetRows } from "../valuation-report-sheet-facts";
import { applyIncomeSection, buildIncomeSheetRows, INCOME_SECTION_TITLE } from "../valuation-report-income";
import { applyValuationReportLiveFill, buildValuationReportLiveFill } from "../valuation-report-live-fill";

/** The server answer for GPI 600,000 · vacancy 5٪ · opex 20٪ of EGI · cap 7.5٪. */
const income = {
  valuationRequestId: "vr1",
  propertyId: "p1",
  isSaved: true,
  incomeApproachEnabled: true,
  grossPotentialIncome: 600000,
  vacancyCollectionLossPct: 5,
  vacancyLossAmount: 30000,
  otherIncome: 0,
  effectiveGrossIncome: 570000,
  operatingExpensesMode: "pct_of_egi",
  operatingExpensesAmount: 0,
  operatingExpensesPct: 20,
  operatingExpensesTotal: 114000,
  operatingExpensesPctOfEgi: 20,
  netOperatingIncome: 456000,
  capitalisationRatePct: 7.5,
  capRateRationale: "عوائد صفقات مكاتب مماثلة في الحي",
  incomeValue: 6080000,
  isComplete: true,
} satisfies ValuationIncomeApproachDto;

const recon = {
  methods: [
    { approachKind: "market", labelAr: "أسلوب السوق", approachValue: 6_000_000, weightPct: 50, contributionValue: 3_000_000, isIncluded: true },
    { approachKind: "income", labelAr: "أسلوب الدخل (رسملة مباشرة)", approachValue: 6_080_000, weightPct: 50, contributionValue: 3_040_000, isIncluded: true },
  ],
  weightSumPct: 100,
  weightedValue: 6_040_000,
} as unknown as ValuationReconciliationDto;

const TEMPLATE = `
  <section class="page pg"><div class="pg-meta">م</div>
    <section class="sec" data-sec="23"><h2><span class="n">23</span>العمر والإهلاك</h2><table></table></section>
    <section class="sec" data-sec="24"><h2><span class="n">24</span>ترجيح أساليب التقييم</h2>
      <table class="mx"><tr><th>الأسلوب</th></tr></table></section>
    <section class="sec" data-sec="25"><h2><span class="n">25</span>القيمة النهائية</h2><table></table></section>
    <div class="pg-num">صفحة 7 من 20</div>
  </section>`;

const draft = () => createEvaluatorDraft({ taskId: "t1", propertyId: "p1", poNumber: "PO-1" });

describe("income approach in the report (D17)", () => {
  it("lists the inputs, EGI, expenses, NOI, cap rate, value and rationale", () => {
    const rows = buildIncomeSheetRows(income);
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    expect(byKey["الدخل الإجمالي المحتمل (سنويًا)"]).toContain("600,000");
    expect(byKey["نسبة الشغور وخسائر التحصيل"]).toBe("5.00٪");
    expect(byKey["الدخل الإجمالي الفعلي"]).toContain("570,000");
    expect(byKey["مصروفات التشغيل (20.00٪ من الدخل الإجمالي الفعلي)"]).toContain("114,000");
    expect(byKey["صافي الدخل التشغيلي"]).toContain("456,000");
    expect(byKey["معدل الرسملة"]).toBe("7.50٪");
    expect(rows.find((r) => r.total)?.value).toContain("6,080,000");
    expect(byKey["مبرر معدل الرسملة"]).toBe("عوائد صفقات مكاتب مماثلة في الحي");
    expect(buildIncomeSheetRows({ ...income, isSaved: false })).toEqual([]);
  });

  it("prints the income row in the §24 reconciliation as «أسلوب الدخل (رسملة مباشرة)»", () => {
    const row = buildReconSheetRows(recon).find((r) => r.key === "أسلوب الدخل (رسملة مباشرة)");
    expect(row?.values[1]).toBe("50.00٪");
    expect(row?.values[2]).toContain("3,040,000");
  });

  it("counts income as an approach, names its method and fills the income cells", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      marketApproachEnabled: true,
      costApproachEnabled: false,
      incomeApproachEnabled: true,
      income,
      recon,
    });
    expect(fill.incomeApproachEnabled).toBe(true);
    expect(fill.approachCount).toBe(2);
    expect(fill.methodRow[2]).toContain("الرسملة المباشرة");
    expect(fill.cells["أساليب التقييم المستخدمة"]).toContain("أسلوب الدخل");
    expect(fill.cells["معدل الرسملة"]).toBe("7.50٪");
    expect(fill.cells["أسلوب الدخل"]).toBe("50.00٪");
    expect(fill.incomeRows.length).toBeGreaterThan(5);

    const off = buildValuationReportLiveFill({
      draft: draft(),
      marketApproachEnabled: true,
      costApproachEnabled: false,
      incomeApproachEnabled: false,
      income,
    });
    expect(off.incomeApproachEnabled).toBe(false);
    expect(off.methodRow[2]).toBe("غير مستخدم");
  });

  it("adds the section before §24 and moves the reconciliation to its own sheet", () => {
    const dom = new DOMParser().parseFromString(TEMPLATE, "text/html");
    applyIncomeSection(dom, { incomeApproachEnabled: true, incomeRows: buildIncomeSheetRows(income) });

    const pages = [...dom.querySelectorAll("section.page")];
    expect(pages).toHaveLength(2);
    const secs = (p: Element) => [...p.querySelectorAll("[data-sec]")].map((s) => s.getAttribute("data-sec"));
    expect(secs(pages[0]!)).toEqual(["23", "income"]);
    expect(secs(pages[1]!)).toEqual(["24", "25"]);
    expect(pages[1]!.querySelector(".pg-meta")).not.toBeNull();
    expect(pages[1]!.querySelector(".pg-num")).not.toBeNull();
    expect(dom.querySelector('[data-sec="income"] h2')?.textContent).toContain(INCOME_SECTION_TITLE);

    // Applying again refreshes the section without another split.
    applyIncomeSection(dom, { incomeApproachEnabled: true, incomeRows: buildIncomeSheetRows(income) });
    expect(dom.querySelectorAll('[data-sec="income"]')).toHaveLength(1);
    expect(dom.querySelectorAll("section.page")).toHaveLength(2);
  });

  it("prints nothing while the approach is off", () => {
    const dom = new DOMParser().parseFromString(TEMPLATE, "text/html");
    applyIncomeSection(dom, { incomeApproachEnabled: false, incomeRows: buildIncomeSheetRows(income) });
    expect(dom.querySelector('[data-sec="income"]')).toBeNull();
    expect(dom.querySelectorAll("section.page")).toHaveLength(1);
  });

  it("the live fill puts the income section into the report", () => {
    const fill = buildValuationReportLiveFill({
      draft: draft(),
      marketApproachEnabled: false,
      costApproachEnabled: false,
      incomeApproachEnabled: true,
      income,
    });
    const dom = new DOMParser().parseFromString(TEMPLATE, "text/html");
    applyValuationReportLiveFill(dom, fill, { markMissingFields: false });
    expect(dom.querySelector('[data-sec="income"]')?.textContent).toContain("6,080,000");
  });

  it("an incomplete income approach blocks the hand-over on the income screen", () => {
    const [b] = classifyHandOverBlockers({
      gates: [
        { code: "income_approach_complete", labelAr: "أسلوب الدخل مكتمل", passed: false, isHard: true, isWarning: false, detailAr: null },
      ],
      methodologyAlerts: [],
    });
    expect(b).toMatchObject({ owner: "appraiser", blocksHandOver: true, screen: "income" });
  });
});
