import { describe, expect, it } from "vitest";
import { formatValuationReportIssueDateIso } from "../valuation-report-number";

describe("formatValuationReportIssueDateIso", () => {
  // Local-time constructor, so the case holds in any machine TZ: 01:30 on 1 Jan is still
  // 1 Jan locally — the UTC slice used to give 2026-12-31 east of Greenwich.
  it("uses the local calendar", () => {
    const issuedAt = new Date(2027, 0, 1, 1, 30);
    expect(formatValuationReportIssueDateIso(issuedAt)).toBe("2027-01-01");
  });

  it("keeps the local date just before midnight", () => {
    expect(formatValuationReportIssueDateIso(new Date(2026, 9, 8, 23, 59))).toBe(
      "2026-10-08",
    );
  });
});
