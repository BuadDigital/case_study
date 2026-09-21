import { describe, expect, it } from "vitest";
import { paginatePropertyPhotoPages } from "../valuation-report-photo-pages";
import {
  markPrintFlow,
  valuationReportPaginateScript,
} from "../valuation-report-print-flow";

function parse(html: string): Document {
  return new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
}

const meta = `<div class="pg-meta"><table class="rpt-meta"></table></div>`;

describe("markPrintFlow", () => {
  it("keeps the template order and starts a sheet at every template page after the first", () => {
    const dom = parse(`
      <section class="page pg">${meta}<div id="title">تقرير</div><section class="sec" data-sec="1">1</section><section class="sec" data-sec="2">2</section></section>
      <section class="page pg">${meta}<section class="sec" data-sec="6">6</section><section class="sec" data-sec="7">7</section></section>
      <section class="page pg">${meta}<section class="sec" data-sec="10">10</section></section>`);
    markPrintFlow(dom);
    const blocks = [...dom.querySelectorAll("[data-rpt-block]")];
    expect(blocks.map((b) => b.getAttribute("data-sec") ?? b.id)).toEqual([
      "title", "1", "2", "6", "7", "10",
    ]);
    expect(blocks.map((b) => Number(b.getAttribute("data-flow-order")))).toEqual([0, 1, 2, 3, 4, 5]);
    expect(blocks.map((b) => b.hasAttribute("data-newpage"))).toEqual([
      false, false, false, true, false, true,
    ]);
  });

  it("returns the page-header markup for the sheets the packer creates", () => {
    const dom = parse(
      `<section class="page pg">${meta}<section class="sec" data-sec="1">1</section></section>`,
    );
    const template = markPrintFlow(dom);
    expect(template).toContain('<template id="rpt-meta">');
    expect(template).toContain("rpt-meta");
  });

  it("does not tag the page header, page number or letterhead strips", () => {
    const dom = parse(
      `<section class="page pg">${meta}<div class="lh-slice"></div><div class="pg-num">1</div><section class="sec" data-sec="1">1</section></section>`,
    );
    markPrintFlow(dom);
    expect(dom.querySelectorAll("[data-rpt-block]")).toHaveLength(1);
  });
});

describe("paginatePropertyPhotoPages", () => {
  function photoPage(count: number): Document {
    const tiles = Array.from(
      { length: count },
      (_, i) => `<figure id="photo-${i + 1}">${i + 1}</figure>`,
    ).join("");
    return parse(
      `<section class="page pg">${meta}<section class="sec" data-sec="34"><h2><span class="n">34</span>صور العقار</h2><div>${tiles}</div></section></section>`,
    );
  }

  it("keeps six photos on one sheet", () => {
    const dom = photoPage(6);
    paginatePropertyPhotoPages(dom);
    expect(dom.querySelectorAll("section.page.pg")).toHaveLength(1);
  });

  it("spreads twelve photos over two sheets of six, each with the heading", () => {
    const dom = photoPage(12);
    paginatePropertyPhotoPages(dom);
    const pages = [...dom.querySelectorAll("section.page.pg")];
    expect(pages).toHaveLength(2);
    for (const page of pages) {
      expect(page.querySelectorAll("figure")).toHaveLength(6);
      expect(page.querySelector(".pg-meta")).not.toBeNull();
    }
    expect(pages[0]!.querySelector("h2")?.textContent).toBe("34صور العقار (1 من 2)");
    expect(pages[1]!.querySelector("h2")?.textContent).toBe("صور العقار (2 من 2)");
    expect(pages[1]!.querySelector("figure")!.id).toBe("photo-7");
  });

  it("puts a seventh photo alone on the next sheet", () => {
    const dom = photoPage(7);
    paginatePropertyPhotoPages(dom);
    const pages = [...dom.querySelectorAll("section.page.pg")];
    expect(pages.map((page) => page.querySelectorAll("figure").length)).toEqual([6, 1]);
  });
});

describe("valuationReportPaginateScript", () => {
  it("ships a self-contained packer that flags itself ready", () => {
    const script = valuationReportPaginateScript();
    expect(script).toContain("data-rpt-block");
    expect(script).toContain("data-rpt-cont-of");
    expect(script).toContain('"data-rpt-ready"');
    expect(() => new Function(script)).not.toThrow();
  });
});
