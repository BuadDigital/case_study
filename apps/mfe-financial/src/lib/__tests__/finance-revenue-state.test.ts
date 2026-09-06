import { describe, expect, it } from "vitest";
import type { EnfazTrackingRowDto } from "@platform/api-client";
import {
  filterRows,
  fmtSar,
  followButtonLabel,
  followupSuffix,
  knownFeesTotal,
  rowsPerPo,
  sortByCompletedDesc,
  studyGroups,
  studyPropertyCaption,
  studyRowStatus,
  sumRevenueAmounts,
  textOrDash,
} from "../finance-revenue-state";

function row(
  propertyId: string,
  overrides: Partial<EnfazTrackingRowDto> = {},
): EnfazTrackingRowDto {
  return {
    poNumber: "PO-1",
    propertyId,
    propertyLabel: `عقار ${propertyId}`,
    deedNumber: `D-${propertyId}`,
    city: "جدة",
    landArea: "500",
    completedAtUtc: null,
    workStatus: "done",
    workStatusLabel: "مكتملة",
    enfazFilled: false,
    caseStudyFeeSar: 0,
    surveyFeeSar: 0,
    keyFeeSar: 0,
    enfazFeeSar: 0,
    invoiceNumber: null,
    invoiceStatus: null,
    invoiceIssuedAtUtc: null,
    isOverdue: false,
    ...overrides,
  } as EnfazTrackingRowDto;
}

describe("fmtSar", () => {
  it("drops decimals on whole amounts and keeps two otherwise", () => {
    expect(fmtSar(1500)).toBe("1,500 ر.س");
    expect(fmtSar(1500.5)).toBe("1,500.50 ر.س");
  });
});

describe("textOrDash", () => {
  it("returns a dash for empty, null or whitespace", () => {
    expect(textOrDash(null)).toBe("—");
    expect(textOrDash("")).toBe("—");
    expect(textOrDash("   ")).toBe("—");
    expect(textOrDash(" الرياض ")).toBe("الرياض");
  });
});

describe("filterRows", () => {
  const rows = [
    row("a", { poNumber: "PO-1", city: "جدة", invoiceNumber: "INV-9" }),
    row("b", { poNumber: "PO-2", city: "الرياض", deedNumber: "D-777" }),
    row("c", { poNumber: "PO-3", city: " جدة ", propertyLabel: "فيلا البحر" }),
  ];

  it("keeps everything with no search, city «all» and period «all»", () => {
    expect(filterRows(rows, "", "all", "all")).toHaveLength(3);
    expect(filterRows(rows, "  ", "", "all")).toHaveLength(3);
  });

  it("matches the city after trimming", () => {
    expect(filterRows(rows, "", "جدة", "all").map((r) => r.propertyId)).toEqual([
      "a",
      "c",
    ]);
  });

  it("searches po, deed, label, invoice and city case-insensitively", () => {
    expect(filterRows(rows, "inv-9", "all", "all").map((r) => r.propertyId)).toEqual(["a"]);
    expect(filterRows(rows, "777", "all", "all").map((r) => r.propertyId)).toEqual(["b"]);
    expect(filterRows(rows, "البحر", "all", "all").map((r) => r.propertyId)).toEqual(["c"]);
    expect(filterRows(rows, "الرياض", "all", "all").map((r) => r.propertyId)).toEqual(["b"]);
  });

  it("drops rows outside the period but keeps undated ones", () => {
    const old = new Date(Date.now() - 100 * 86_400_000).toISOString();
    const recent = new Date(Date.now() - 5 * 86_400_000).toISOString();
    const dated = [
      row("old", { completedAtUtc: old }),
      row("recent", { completedAtUtc: recent }),
      row("undated"),
    ];
    expect(filterRows(dated, "", "all", "30").map((r) => r.propertyId)).toEqual([
      "recent",
      "undated",
    ]);
    expect(filterRows(dated, "", "all", "90").map((r) => r.propertyId)).toEqual([
      "recent",
      "undated",
    ]);
  });
});

describe("sortByCompletedDesc", () => {
  it("orders newest first without mutating the input", () => {
    const input = [
      row("a", { completedAtUtc: "2026-01-01T00:00:00Z" }),
      row("b", { completedAtUtc: "2026-03-01T00:00:00Z" }),
      row("c"),
    ];
    const sorted = sortByCompletedDesc(input);
    expect(sorted.map((r) => r.propertyId)).toEqual(["b", "a", "c"]);
    expect(input.map((r) => r.propertyId)).toEqual(["a", "b", "c"]);
  });
});

describe("studyGroups", () => {
  it("sorts work orders A→Z and rows inside newest-completed first", () => {
    const groups = studyGroups([
      row("z1", { poNumber: "PO-9", completedAtUtc: "2026-01-01T00:00:00Z" }),
      row("a1", { poNumber: "PO-1", completedAtUtc: "2026-01-01T00:00:00Z" }),
      row("z2", { poNumber: "PO-9", completedAtUtc: "2026-02-01T00:00:00Z" }),
    ]);
    expect(groups.map((g) => g.poNumber)).toEqual(["PO-1", "PO-9"]);
    expect(groups[1]!.rows.map((r) => r.propertyId)).toEqual(["z2", "z1"]);
  });
});

describe("rowsPerPo", () => {
  it("counts rows per work order and buckets blanks under «—»", () => {
    const counts = rowsPerPo([
      row("a", { poNumber: "PO-1" }),
      row("b", { poNumber: "PO-1" }),
      row("c", { poNumber: "" }),
    ]);
    expect(counts.get("PO-1")).toBe(2);
    expect(counts.get("—")).toBe(1);
  });
});

describe("knownFeesTotal", () => {
  it("sums only rows with a positive total and flags when none have one", () => {
    expect(knownFeesTotal([row("a"), row("b")])).toEqual({
      feesSum: 0,
      feesKnown: false,
    });
    const known = knownFeesTotal([
      row("a", { caseStudyFeeSar: 100 }),
      row("b"),
      row("c", { keyFeeSar: 50 }),
    ]);
    expect(known.feesKnown).toBe(true);
    // 100 + 15% VAT + 50 key (VAT-inclusive)
    expect(known.feesSum).toBe(165);
  });
});

describe("sumRevenueAmounts", () => {
  it("adds taxable, vat, key and gross across the group", () => {
    const sums = sumRevenueAmounts([
      row("a", { caseStudyFeeSar: 100, surveyFeeSar: 100 }),
      row("b", { caseStudyFeeSar: 200, keyFeeSar: 30 }),
    ]);
    expect(sums).toEqual({ base: 400, vat: 60, key: 30, gross: 490 });
  });

  it("is all zeros for an empty group", () => {
    expect(sumRevenueAmounts([])).toEqual({ base: 0, vat: 0, key: 0, gross: 0 });
  });
});

describe("studyRowStatus", () => {
  it("shows a partial-invoice warning when an invoice number exists", () => {
    expect(studyRowStatus(row("a", { invoiceNumber: " INV-1 " }))).toEqual({
      label: "مفوتر جزئياً",
      tone: "warning",
    });
  });

  it("falls back to the work status label, then «لم يستحق بعد»", () => {
    expect(studyRowStatus(row("a", { workStatusLabel: " قيد المعاينة " }))).toEqual({
      label: "قيد المعاينة",
      tone: "default",
    });
    expect(studyRowStatus(row("a", { workStatusLabel: "" }))).toEqual({
      label: "لم يستحق بعد",
      tone: "default",
    });
  });
});

describe("studyPropertyCaption", () => {
  it("returns the label only when it differs from the deed", () => {
    expect(studyPropertyCaption(row("a", { deedNumber: "D", propertyLabel: "D" }))).toBeNull();
    expect(studyPropertyCaption(row("a", { propertyLabel: "  " }))).toBeNull();
    expect(studyPropertyCaption(row("a", { deedNumber: "D", propertyLabel: "فيلا" }))).toBe("فيلا");
  });
});

describe("follow-up labels", () => {
  it("appends counts only when there were follow-ups", () => {
    expect(followupSuffix(0)).toBe("");
    expect(followupSuffix(3)).toBe(" · 3 متابعة");
    expect(followButtonLabel(0)).toBe("متابعة");
    expect(followButtonLabel(2)).toBe("متابعة (2)");
  });
});
