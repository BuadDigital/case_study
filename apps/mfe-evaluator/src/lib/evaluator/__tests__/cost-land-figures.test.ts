import { describe, expect, it } from "vitest";
import type { ValuationCostApproachDto } from "@platform/api-client";
import {
  apartmentLandHint,
  costLandMultiplierLabel,
  costLandMultiplierSqm,
  costLandReportRows,
} from "../cost-land-figures";
import { rebuildLandValueTable } from "../valuation-report-live-fill-dom";

/** VR-542 (RT2-KAPT): plot 900 m², share 60 m², adjusted rate 3,561.58 → land 213,694.80. */
const VR542 = {
  landAreaSqm: 900,
  apartmentLandShareSqm: 60,
  buildingPlotAreaSqm: 900,
  landUnitRateFromMarket: 3561.58,
  useRestrictionDiscountPct: 0,
  landUnitRateAfterDiscount: 3561.58,
  landValueFromMarket: 213694.8,
  landEstimateComplete: true,
} as ValuationCostApproachDto;

describe("cost land figures (decision A)", () => {
  it("prints the apartment's land in the order the figures multiply, and every line adds up", () => {
    const rows = costLandReportRows(VR542, true);

    expect(rows).toEqual([
      { key: "مساحة أرض العمارة كاملة (م²)", value: "900" },
      { key: "سعر المتر بعد التسويات (ر.س./م²)", value: "3,561.58" },
      { key: "حصة الشقة من الأرض (م²)", value: "60" },
      { key: "قيمة الأرض قبل التقريب", value: "213,694.80" },
      { key: "قيمة الأرض", value: "213,694.80", total: true },
    ]);
    // Rate × share = the land value (never rate × plot = 3,205,422).
    expect(Math.round(3561.58 * 60 * 100) / 100).toBe(213694.8);
    expect(rows.map((r) => r.value)).not.toContain("3,205,422");
  });

  it("puts a use-restriction discount between the rate and the share", () => {
    const rows = costLandReportRows(
      { ...VR542, useRestrictionDiscountPct: 10, landUnitRateAfterDiscount: 3205.42, landValueFromMarket: 192325.2 },
      true,
    );
    expect(rows.map((r) => r.key)).toEqual([
      "مساحة أرض العمارة كاملة (م²)",
      "سعر المتر بعد التسويات (ر.س./م²)",
      "خصم تقييد الاستخدام",
      "سعر المتر بعد الخصم (ر.س./م²)",
      "حصة الشقة من الأرض (م²)",
      "قيمة الأرض قبل التقريب",
      "قيمة الأرض",
    ]);
    expect(rows[2]!.value).toBe("10.00٪");
    expect(rows[5]!.value).toBe("192,325.20");
  });

  it("values land that is not shared on the plot itself, with no share line", () => {
    const villa = {
      ...VR542,
      apartmentLandShareSqm: null,
      landAreaSqm: 450,
      landValueFromMarket: 1602711,
    } as ValuationCostApproachDto;
    const rows = costLandReportRows(villa, false);
    expect(rows.map((r) => r.key)).toEqual([
      "مساحة الأرض (م²)",
      "سعر المتر بعد التسويات (ر.س./م²)",
      "قيمة الأرض قبل التقريب",
      "قيمة الأرض",
    ]);
    expect(rows[2]!.value).toBe("1,602,711");
    expect(costLandMultiplierSqm(villa)).toBe(450);
    expect(costLandMultiplierLabel(villa)).toBe("مساحة الأرض");
    expect(costLandMultiplierSqm(VR542)).toBe(60);
    expect(costLandMultiplierLabel(VR542)).toBe("حصة الشقة");
  });

  it("shows dashes, not a value, while the land is incomplete", () => {
    const rows = costLandReportRows(
      { ...VR542, landAreaSqm: 0, landEstimateComplete: false, landUnitRateFromMarket: 0 },
      true,
    );
    expect(rows.find((r) => r.key === "قيمة الأرض")?.value).toBe("—");
    expect(rows.find((r) => r.key === "مساحة أرض العمارة كاملة (م²)")?.value).toBe("—");
  });

  it("tells the apartment appraiser where the plot goes, then what it is compared with", () => {
    expect(apartmentLandHint(null)).toContain("أدخل مساحة أرض العمارة كاملة");
    expect(apartmentLandHint(VR542)).toBe(
      "تُقارن الأراضي بمساحة أرض العمارة كاملة 900 م² — وقيمة الأرض = سعر المتر × حصة الشقة 60 م²",
    );
  });

  it("rebuilds the template's §20 key table one figure per line", () => {
    const dom = new DOMParser().parseFromString(
      `<section data-sec="20"><table>
        <tr><td class="k">سعر المتر المستورد من طريقة المقارنة</td><td class="v num">2,000.00</td><td class="k">مساحة الأرض (م²)</td><td class="v num">400.00</td></tr>
        <tr class="total"><td class="k">قيمة الأرض</td><td class="v num" colspan="3">800,000.00</td></tr>
      </table><table class="mx"><tr><td class="v">قيمة الأرض</td></tr></table></section>`,
      "text/html",
    );
    const sec = dom.querySelector('[data-sec="20"]')!;
    rebuildLandValueTable(sec, costLandReportRows(VR542, true));

    const lines = [...sec.querySelectorAll("table:not(.mx) tr")].map((tr) =>
      [...tr.querySelectorAll("td")].map((td) => td.textContent),
    );
    expect(lines).toEqual([
      ["مساحة أرض العمارة كاملة (م²)", "900"],
      ["سعر المتر بعد التسويات (ر.س./م²)", "3,561.58"],
      ["حصة الشقة من الأرض (م²)", "60"],
      ["قيمة الأرض قبل التقريب", "213,694.80"],
      ["قيمة الأرض", "213,694.80"],
    ]);
    expect(sec.querySelector("table:not(.mx) tr:last-child")?.className).toBe("total");
    // The comparables matrix is left alone.
    expect(sec.querySelector("table.mx td")?.textContent).toBe("قيمة الأرض");
  });
});
