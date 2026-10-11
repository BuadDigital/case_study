import { describe, expect, it } from "vitest";
import {
  formatValuationReportIssueDateIso,
  formatValuationReportNumber,
  reservedValuationReportNumber,
} from "../valuation-report-number";

// Numbering workshop (decision item 3): unified pattern TQ-{year}-{5-digit sequence}.
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

describe("formatValuationReportIssueDateIso", () => {
  // Local-time constructor, so the case holds in any machine TZ: 01:30 on 1 Jan is still
  // 1 Jan locally — the UTC slice used to give 2026-12-31 east of Greenwich.
  it("uses the local calendar, same as the number's year", () => {
    const issuedAt = new Date(2027, 0, 1, 1, 30);
    expect(formatValuationReportIssueDateIso(issuedAt)).toBe("2027-01-01");
    expect(formatValuationReportNumber(issuedAt, 1)).toBe("TQ-2027-00001");
  });

  it("keeps the local date just before midnight", () => {
    expect(formatValuationReportIssueDateIso(new Date(2026, 9, 8, 23, 59))).toBe(
      "2026-10-08",
    );
  });
});
