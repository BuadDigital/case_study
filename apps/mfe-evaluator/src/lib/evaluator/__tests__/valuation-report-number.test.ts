import { describe, expect, it } from "vitest";
import { formatValuationReportNumber, reservedValuationReportNumber } from "../valuation-report-number";

describe("formatValuationReportNumber", () => {
  it("formats TQ + yyyyMMdd + 4-digit ordinal", () => {
    expect(formatValuationReportNumber(new Date(2026, 7, 19), 1)).toBe(
      "TQ202608190001",
    );
    expect(formatValuationReportNumber(new Date(2026, 7, 19), 12)).toBe(
      "TQ202608190012",
    );
  });

  it("clamps invalid ordinals to 0001", () => {
    expect(formatValuationReportNumber(new Date(2026, 0, 1), 0)).toBe(
      "TQ202601010001",
    );
  });
});

describe("reservedValuationReportNumber", () => {
  it("uses the request date and display-id digits", () => {
    expect(reservedValuationReportNumber("VR-12", "2026-08-19")).toBe(
      "TQ202608190012",
    );
  });
});
