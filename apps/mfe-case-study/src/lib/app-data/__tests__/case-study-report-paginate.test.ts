import { afterEach, describe, expect, it, vi } from "vitest";
import {
  caseStudyReportPaginateScript,
  paginateCaseStudyReport,
} from "../case-study-report-paginate";

const SHEET_HEIGHT = 100;

function mountReport(heights: number[], breakBefore: number[] = []): HTMLElement {
  document.body.innerHTML = `<div class="csrd-root"><div class="csrd-flow"></div><div class="csrd-sheets"></div></div>`;
  const root = document.querySelector<HTMLElement>(".csrd-root")!;
  const flow = root.querySelector(".csrd-flow")!;
  heights.forEach((height, index) => {
    const block = document.createElement("div");
    block.className = `block${breakBefore.includes(index) ? " csrd-section--break" : ""}`;
    block.textContent = `block-${index}`;
    block.getBoundingClientRect = () => ({ height }) as DOMRect;
    flow.appendChild(block);
  });
  return root;
}

function sheetTexts(): string[][] {
  return [...document.querySelectorAll(".csrd-sheet")].map((sheet) =>
    [...sheet.querySelectorAll(".block")].map((b) => b.textContent ?? ""),
  );
}

describe("paginateCaseStudyReport", () => {
  afterEach(() => vi.restoreAllMocks());

  function fixedSheetHeight() {
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(SHEET_HEIGHT + 1);
  }

  it("fills a sheet until the next block would not fit", () => {
    fixedSheetHeight();
    const root = mountReport([40, 40, 40, 20]);
    paginateCaseStudyReport(root);
    expect(sheetTexts()).toEqual([
      ["block-0", "block-1"],
      ["block-2", "block-3"],
    ]);
    expect(root.getAttribute("data-paginated")).toBe("1");
  });

  it("starts a new sheet for a section that forces a page break", () => {
    fixedSheetHeight();
    const root = mountReport([10, 10, 10], [2]);
    paginateCaseStudyReport(root);
    expect(sheetTexts()).toEqual([["block-0", "block-1"], ["block-2"]]);
  });

  it("gives an oversized block its own sheet instead of dropping it", () => {
    fixedSheetHeight();
    const root = mountReport([10, 250, 10]);
    paginateCaseStudyReport(root);
    expect(sheetTexts()).toEqual([["block-0"], ["block-1"], ["block-2"]]);
  });

  it("puts the four letterhead strips on every sheet and can run twice", () => {
    fixedSheetHeight();
    const root = mountReport([60, 60]);
    paginateCaseStudyReport(root);
    paginateCaseStudyReport(root);
    const sheets = document.querySelectorAll(".csrd-sheet");
    expect(sheets).toHaveLength(2);
    sheets.forEach((sheet) => {
      expect(sheet.querySelectorAll(".lh-slice")).toHaveLength(4);
    });
  });
});

describe("caseStudyReportPaginateScript", () => {
  it("ships the pagination function's own source", () => {
    const script = caseStudyReportPaginateScript();
    expect(script).toContain("csrd-flow");
    expect(script).toContain('setAttribute("data-csrd-ready", "1")');
    expect(() => new Function(script)).not.toThrow();
  });
});
