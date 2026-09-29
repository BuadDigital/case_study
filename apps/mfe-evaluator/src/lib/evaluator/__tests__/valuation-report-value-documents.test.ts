// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { ValuationReconciliationDto } from "@platform/api-client";
import { buildReconSheetRows } from "../valuation-report-sheet-facts";
import { fillValueAdditions } from "../valuation-report-live-fill-dom";
import type { ValuationReportLiveFill } from "../valuation-report-fill-model";

function recon(partial: Partial<ValuationReconciliationDto>): ValuationReconciliationDto {
  return {
    valuationRequestId: "vr",
    propertyId: "p",
    marketOpinionValue: 0,
    costOpinionWithLand: 1_000_000,
    methods: [],
    weightSumPct: 100,
    weightsSumTo100: true,
    meetsMultiMethodGate: true,
    weightedValue: 1_060_000,
    finalRoundDecimals: 0,
    finalOpinionValue: 1_060_000,
    methodsRationale: "",
    liquidationDiscountPct: 0,
    liquidationDiscountApplied: false,
    ...partial,
  };
}

describe("«مستند ذو قيمة» in the report", () => {
  it("§24 lists a document indicator under the label the server gives it", () => {
    const rows = buildReconSheetRows(
      recon({
        methods: [
          {
            approachKind: "cost",
            labelAr: "أسلوب التكلفة",
            approachValue: 1_000_000,
            weightPct: 70,
            suggestedWeightPct: 50,
            contributionValue: 700_000,
            rationale: "",
            isIncluded: true,
            sortOrder: 0,
          },
          {
            approachKind: "doc:abc",
            labelAr: "أسلوب الدخل — الطريقة المتبقية (مستند)",
            approachValue: 1_200_000,
            weightPct: 30,
            suggestedWeightPct: 50,
            contributionValue: 360_000,
            rationale: "",
            isIncluded: true,
            sortOrder: 1,
            valueDocumentAttachmentId: "abc",
            documentApproachKey: "income",
            documentMethodName: "الطريقة المتبقية",
          },
        ],
      }),
    );
    const keys = rows.map((r) => r.key);
    expect(keys).toContain("أسلوب التكلفة — طريقة المقاول");
    expect(keys).toContain("أسلوب الدخل — الطريقة المتبقية (مستند)");
    expect(keys).not.toContain("أسلوب الدخل");
  });

  it("§25 prints the value after the discount, each addition, then the total", () => {
    document.body.innerHTML = `
      <section data-sec="25">
        <table>
          <tr><td class="k">القيمة المرجّحة</td><td class="v num" colspan="3">—</td></tr>
          <tr><td class="k">قيمة العقار</td><td class="v num" colspan="3">—</td></tr>
        </table>
        <div style="background:#102b4e"><div><div>القيمة النهائية للعقار</div><div>—</div></div><div>—</div></div>
      </section>`;
    const sec = document.querySelector('[data-sec="25"]')!;
    fillValueAdditions(sec, {
      valueAdditions: [{ label: "تقرير تقييم الآلات", value: "150,000.00" }],
      propertyValueAfterLiquidation: "987,653.60",
      finalDisplay: "1,138,000.00 ر.س.",
    } as ValuationReportLiveFill);

    const labels = [...sec.querySelectorAll("td.k")].map((td) => td.textContent);
    expect(labels).toEqual([
      "القيمة المرجّحة",
      "قيمة العقار بعد خصم التصفية",
      "+ تقرير تقييم الآلات",
      "القيمة الإجمالية",
    ]);
    expect(sec.querySelector("tr.total td.v")?.textContent).toBe("1,138,000.00");
    expect(sec.textContent).toContain("القيمة النهائية الإجمالية");
  });
});

describe("§19 adjustments sheet layout", () => {
  it("splits factor rows into description | % under each comparable and rules the groups", async () => {
    const { fillAdjustmentSection } = await import("../valuation-report-live-fill-dom");
    document.body.innerHTML = `
      <section data-sec="19"><table class="mx">
        <tr><th>عناصر المقارنة</th><th>العقار المقارن (1)</th></tr>
        <tr class="sub"><td class="v">سعر البيع بعد تسوية شروط التمويل وظروف السوق</td><td class="num">—</td></tr>
        <tr class="total"><td class="v">القيمة بطريقة المقارنة</td><td class="num">—</td></tr>
      </table><table><tr><td class="k">مبررات التسويات</td><td class="v">—</td></tr></table></section>`;
    const sec = document.querySelector('[data-sec="19"]')!;
    fillAdjustmentSection(sec, {
      adjustmentRows: [
        { key: "قيمة العقارات المقارنة", values: ["180,000.00", "199,800.00"] },
        { key: "سعر البيع بعد تسوية شروط التمويل وظروف السوق", values: ["285.00", "333.00"] },
        { key: "تسوية المساحة", values: ["", ""], pairs: [["600.00", "5.00٪"], ["600.00", "٪"]] },
        { key: "الموقع العام", values: ["", ""], pairs: [["الفيحاء", "٪"], ["الفيحاء", "٪"]] },
        { key: "مجموع نسب التسويات (٪)", values: ["5.00٪", "5.00٪"] },
        { key: "القيمة بطريقة المقارنة", values: ["125,868.00"] },
      ],
      adjustmentComparisonLabel: "القيمة بطريقة المقارنة",
      adjustmentNotes: "",
    });
    const rows = [...sec.querySelectorAll("table.mx tr")];
    expect([...rows[0]!.querySelectorAll("th")].map((th) => th.getAttribute("colspan"))).toEqual([null, "2", "2"]);
    expect(rows[1]!.querySelectorAll("td")[1]!.getAttribute("colspan")).toBe("2");
    expect([...rows[3]!.querySelectorAll("td")].map((td) => td.textContent)).toEqual([
      "تسوية المساحة", "600.00", "5.00٪", "600.00", "٪",
    ]);
    expect(rows[3]!.className).toContain("grp");
    expect(rows[5]!.className).toContain("grp");
    expect(rows[2]!.className).toBe("sub");
    expect(rows[6]!.className).toBe("total");
    expect(rows[6]!.querySelectorAll("td")[1]!.getAttribute("colspan")).toBe("4");
  });
});
