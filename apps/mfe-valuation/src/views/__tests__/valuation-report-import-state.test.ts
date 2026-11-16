import { describe, expect, it } from "vitest";
import type { ValuationReportImportPreviewDto } from "@platform/api-client";
import { importBlockReason, isExcelFile } from "../valuation-report-import-state";

function preview(over: Partial<ValuationReportImportPreviewDto> = {}): ValuationReportImportPreviewDto {
  return {
    source: "meqyas",
    fileName: "export.xlsx",
    totalRows: 10,
    matchedColumns: 15,
    requiredColumns: 15,
    missingColumns: [],
    newCount: 8,
    replacedCount: 1,
    rejectedCount: 1,
    noValueCount: 0,
    rejected: [],
    previousBatchGap: null,
    hasPreviousBatch: true,
    internalMissingCount: 0,
    internalGapCount: 0,
    largestInternalGaps: [],
    ...over,
  };
}

describe("importBlockReason", () => {
  it("lets a clean file through", () => {
    expect(importBlockReason(preview(), false)).toBeNull();
  });

  it("stops on a missing required column", () => {
    expect(importBlockReason(preview({ missingColumns: ["خط الطول"] }), true)).toMatch("أعمدة");
  });

  it("stops when nothing in the file is valid", () => {
    expect(importBlockReason(preview({ newCount: 0, replacedCount: 0 }), true)).toMatch("لا توجد");
  });

  it("needs the gap after the previous upload acknowledged", () => {
    const gap = {
      lastNumber: "100200",
      lastImportedAtUtc: "2026-10-01T08:00:00Z",
      firstNumber: "100260",
      missingCount: 59,
    };
    expect(importBlockReason(preview({ previousBatchGap: gap }), false)).toMatch("الفجوة");
    expect(importBlockReason(preview({ previousBatchGap: gap }), true)).toBeNull();
  });

  it("does not block on gaps inside the file", () => {
    expect(importBlockReason(preview({ internalGapCount: 4, internalMissingCount: 300 }), false)).toBeNull();
  });
});

describe("isExcelFile", () => {
  it("accepts xlsx and xls only", () => {
    expect(isExcelFile(new File([], "a.XLSX"))).toBe(true);
    expect(isExcelFile(new File([], "a.xls"))).toBe(true);
    expect(isExcelFile(new File([], "a.csv"))).toBe(false);
  });
});
