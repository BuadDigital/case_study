import { describe, expect, it } from "vitest";
import {
  formatReportPropertyAgeYears,
  parseLicenseDateForAge,
  reportPropertyAgeYearsFromLicense,
} from "../valuation-report-property-age";

describe("reportPropertyAgeYearsFromLicense", () => {
  it("returns null when the license date is blank or unparseable", () => {
    expect(reportPropertyAgeYearsFromLicense("")).toBeNull();
    expect(reportPropertyAgeYearsFromLicense("abc")).toBeNull();
  });

  it("parses Gregorian and Hijri license dates", () => {
    const g = parseLicenseDateForAge("2020/03/15 م");
    expect(g?.getFullYear()).toBe(2020);
    expect(g?.getMonth()).toBe(2);
    expect(g?.getDate()).toBe(15);

    const h = parseLicenseDateForAge("هـ1441/03/15");
    expect(h).not.toBeNull();
    expect(h!.getFullYear()).toBeGreaterThanOrEqual(2019);
    expect(h!.getFullYear()).toBeLessThanOrEqual(2020);
  });

  it.each([
    ["30/02/2020", "impossible Gregorian day (used to roll to 01/03/2020)"],
    ["2021-02-29", "29 Feb in a common year"],
    ["31/04/2024 م", "31 April"],
    ["1445/08/30 هـ", "30 Sha'ban 1445 — a 29-day month"],
  ])("rejects %s (%s)", (raw) => {
    expect(parseLicenseDateForAge(raw)).toBeNull();
  });

  it.each([
    ["٢٩/٠٢/٢٠٢٠", 2020, 1, 29],
    ["1445/09/01 هـ", 2024, 2, 11],
    ["01/10/1445", 2024, 3, 10],
  ])("reads %s as local noon %i-%i-%i", (raw, y, m, d) => {
    const date = parseLicenseDateForAge(raw);
    expect([date?.getFullYear(), date?.getMonth(), date?.getDate(), date?.getHours()]).toEqual([
      y,
      m,
      d,
      12,
    ]);
  });

  it("subtracts two years from the completed age and never goes below zero", () => {
    const now = new Date(2026, 8, 22, 12, 0, 0, 0); // 2026-09-22
    // License 2020-09-22 → 6 full years − 2 = 4
    expect(reportPropertyAgeYearsFromLicense("2020/09/22 م", now)).toBe(4);
    // License 2020-09-23 → 5 full years − 2 = 3 (anniversary not reached)
    expect(reportPropertyAgeYearsFromLicense("2020/09/23 م", now)).toBe(3);
    // Recent license → 0 after offset
    expect(reportPropertyAgeYearsFromLicense("2025/01/01 م", now)).toBe(0);
    // Future license → 0
    expect(reportPropertyAgeYearsFromLicense("2027/01/01 م", now)).toBe(0);
  });

  it("formats the report label", () => {
    expect(formatReportPropertyAgeYears(0)).toBe("أقل من سنة");
    expect(formatReportPropertyAgeYears(1)).toBe("سنة واحدة");
    expect(formatReportPropertyAgeYears(2)).toBe("سنتين");
    expect(formatReportPropertyAgeYears(4)).toBe("4 سنوات");
    expect(formatReportPropertyAgeYears(10)).toBe("10 سنوات");
    expect(formatReportPropertyAgeYears(11)).toBe("11 سنة");
    expect(formatReportPropertyAgeYears(14)).toBe("14 سنة");
    expect(formatReportPropertyAgeYears(100)).toBe("100 سنة");
    expect(formatReportPropertyAgeYears(103)).toBe("103 سنوات");
  });
});
