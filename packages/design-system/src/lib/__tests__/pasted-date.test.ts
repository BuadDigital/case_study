import { describe, expect, it } from "vitest";
import { parsePastedDate } from "../pasted-date";

describe("parsePastedDate", () => {
  it("accepts ISO dates", () => {
    expect(parsePastedDate("2026-08-12")).toBe("2026-08-12");
    expect(parsePastedDate("2026/08/12")).toBe("2026-08-12");
  });

  it("parses DD/MM/YYYY from Excel-style paste", () => {
    expect(parsePastedDate("12/08/2026")).toBe("2026-08-12");
    expect(parsePastedDate("12-08-2026")).toBe("2026-08-12");
    expect(parsePastedDate("12.08.2026")).toBe("2026-08-12");
  });

  it("uses first cell when Excel pastes tab-separated row", () => {
    expect(parsePastedDate("12/08/2026\t12345")).toBe("2026-08-12");
  });

  it("strips time portion", () => {
    expect(parsePastedDate("12/08/2026 00:00:00")).toBe("2026-08-12");
  });

  it("normalizes Arabic-Indic digits", () => {
    expect(parsePastedDate("١٢/٠٨/٢٠٢٦")).toBe("2026-08-12");
  });

  it("parses Excel serial numbers", () => {
    expect(parsePastedDate("45881")).toBe("2025-08-12");
  });

  it("returns null for invalid dates", () => {
    expect(parsePastedDate("")).toBeNull();
    expect(parsePastedDate("not-a-date")).toBeNull();
    expect(parsePastedDate("31/02/2026")).toBeNull();
  });
});
