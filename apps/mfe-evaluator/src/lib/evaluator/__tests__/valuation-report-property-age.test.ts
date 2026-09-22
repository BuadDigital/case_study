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
    expect(formatReportPropertyAgeYears(4)).toBe("4 سنوات");
  });
});
