import { describe, expect, it } from "vitest";
import { formatValuationReportNumber, reservedValuationReportNumber } from "../valuation-report-number";

// ورشة الترقيم (بند البتّ 3): النمط الموحد TQ-{سنة}-{تسلسل ٥}.
describe("formatValuationReportNumber", () => {
  it("formats TQ-{yyyy}-{#####}", () => {
    expect(formatValuationReportNumber(new Date(2026, 7, 19), 1)).toBe(
      "TQ-2026-00001",
    );
    expect(formatValuationReportNumber(new Date(2026, 7, 19), 12)).toBe(
      "TQ-2026-00012",
    );
  });

  it("clamps invalid ordinals to 00001", () => {
    expect(formatValuationReportNumber(new Date(2026, 0, 1), 0)).toBe(
      "TQ-2026-00001",
    );
  });
});

describe("reservedValuationReportNumber", () => {
  it("uses the request year and display-id digits", () => {
    expect(reservedValuationReportNumber("VR-12", "2026-08-19")).toBe(
      "TQ-2026-00012",
    );
  });
});
