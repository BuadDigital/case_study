/**
 * Print copy: keep the template's own pages (the v3 design) but stop a page from spilling out of
 * its sheet. A page whose sections are taller than the sheet used to be clipped — or, for the
 * photos, printed over the letterhead footer — so the print page now lays the template's
 * sections out on sheets itself: every template page still starts a sheet, and a sheet only
 * gains a further one when its content does not fit.
 *
 * The template is parsed in a detached document (no layout), so the packing happens in the print
 * page: `markPrintFlow` tags the blocks, `valuationReportPaginateScript` ships the packer.
 * Without scripts the untouched template pages remain.
 */

const SKIP_CHILD = ".pg-meta, .pg-num, .lh-slice";

/**
 * Tags every top-level block of every template page in reading order and marks the first block of
 * each page as the start of a sheet. Returns the page-header markup the packer copies onto each
 * sheet it creates.
 */
export function markPrintFlow(dom: Document): string {
  const pages = [...dom.querySelectorAll("section.page.pg")];
  let order = 0;
  pages.forEach((page, pageIndex) => {
    let first = true;
    for (const block of [...page.children]) {
      if (block.matches(SKIP_CHILD)) continue;
      block.setAttribute("data-rpt-block", "1");
      block.setAttribute("data-flow-order", String(order++));
      if (first && pageIndex > 0) block.setAttribute("data-newpage", "1");
      first = false;
    }
  });

  const meta = pages[0]?.querySelector(".pg-meta");
  return meta ? `<template id="rpt-meta">${meta.outerHTML}</template>` : "";
}

/**
 * Runs in the print page. Plain ES5 on purpose — `valuationReportPaginateScript` ships this
 * function's own source, so it may not lean on imports.
 */
export function paginateValuationReport(): void {
  var meta = document.getElementById("rpt-meta") as HTMLTemplateElement | null;

  // A second run (after the fonts settled) starts from whole blocks again.
  var continuations = Array.prototype.slice.call(
    document.querySelectorAll("[data-rpt-cont-of]"),
  ) as HTMLElement[];
  continuations.forEach(function (cont) {
    var owner = document.querySelector(
      '[data-rpt-id="' + cont.getAttribute("data-rpt-cont-of") + '"]',
    );
    var from = cont.querySelector("table");
    var to = owner ? owner.querySelector("table") : null;
    if (from && to) {
      var target = to.tBodies[0] || to;
      Array.prototype.slice.call(from.rows).forEach(function (row: HTMLTableRowElement) {
        target.appendChild(row);
      });
    }
    if (cont.parentNode) cont.parentNode.removeChild(cont);
  });

  var blocks = Array.prototype.slice.call(
    document.querySelectorAll("[data-rpt-block]"),
  ) as HTMLElement[];
  if (blocks.length === 0) return;

  var sources = Array.prototype.slice.call(
    document.querySelectorAll("section.page.pg:not([data-rpt-sheet])"),
  ) as HTMLElement[];
  var oldSheets = Array.prototype.slice.call(
    document.querySelectorAll("section.page.pg[data-rpt-sheet]"),
  ) as HTMLElement[];

  var order = blocks.map(function (block, index) {
    return { block: block, order: Number(block.getAttribute("data-flow-order")), index: index };
  });
  order.sort(function (a, b) {
    return a.order - b.order || a.index - b.index;
  });

  var anchor = sources[0] || oldSheets[0];
  var parent = anchor ? (anchor.parentNode as HTMLElement) : document.body;
  var before = anchor || null;
  var slices = ["lh-head", "lh-foot", "lh-start", "lh-end"];
  var created: HTMLElement[] = [];

  function newSheet(): HTMLElement {
    var sheet = document.createElement("section");
    sheet.className = "page pg";
    sheet.setAttribute("data-rpt-sheet", "1");
    for (var s = 0; s < slices.length; s++) {
      var slice = document.createElement("div");
      slice.className = "lh-slice " + slices[s];
      sheet.appendChild(slice);
    }
    if (meta && meta.content.firstElementChild) {
      sheet.appendChild(meta.content.firstElementChild.cloneNode(true));
    }
    parent.insertBefore(sheet, before);
    created.push(sheet);
    return sheet;
  }

  function fits(sheet: HTMLElement, block: HTMLElement): boolean {
    var style = window.getComputedStyle(sheet);
    var limit =
      sheet.getBoundingClientRect().top +
      sheet.clientHeight -
      (parseFloat(style.paddingBottom) || 0);
    return block.getBoundingClientRect().bottom <= limit + 0.5;
  }

  // A block taller than a whole sheet gives its table rows to a continuation block.
  function splitOversize(sheet: HTMLElement, block: HTMLElement): HTMLElement | null {
    var table = block.querySelector("table");
    if (!table) return null;
    var moved: HTMLTableRowElement[] = [];
    while (table.rows.length > 1 && !fits(sheet, block)) {
      var row = table.rows[table.rows.length - 1]!;
      moved.unshift(row);
      row.parentNode!.removeChild(row);
    }
    if (moved.length === 0) return null;

    var id = block.getAttribute("data-rpt-id");
    if (!id) {
      id = "b" + block.getAttribute("data-flow-order");
      block.setAttribute("data-rpt-id", id);
    }
    var cont = block.cloneNode(true) as HTMLElement;
    cont.removeAttribute("data-rpt-id");
    cont.removeAttribute("data-newpage");
    cont.setAttribute("data-rpt-cont-of", id);
    var headings = cont.querySelectorAll("h2, h3");
    for (var h = 0; h < headings.length; h++) {
      var heading = headings[h]!;
      if (heading.parentNode) heading.parentNode.removeChild(heading);
    }
    var contTable = cont.querySelector("table")!;
    while (contTable.rows.length > 0) contTable.deleteRow(0);
    var contBody = contTable.tBodies[0] || contTable;
    for (var m = 0; m < moved.length; m++) contBody.appendChild(moved[m]!);
    return cont;
  }

  var sheet = newSheet();
  var count = 0;
  for (var i = 0; i < order.length; i++) {
    var block: HTMLElement | null = order[i]!.block;
    if (count > 0 && block.getAttribute("data-newpage") === "1") {
      sheet = newSheet();
      count = 0;
    }
    sheet.appendChild(block);
    if (count > 0 && !fits(sheet, block)) {
      sheet = newSheet();
      sheet.appendChild(block);
      count = 0;
    }
    count++;
    while (block && !fits(sheet, block)) {
      var cont = splitOversize(sheet, block);
      if (!cont) break;
      sheet = newSheet();
      sheet.appendChild(cont);
      count = 1;
      block = cont;
    }
  }

  oldSheets.concat(sources).forEach(function (page) {
    if (page.parentNode) page.parentNode.removeChild(page);
  });
  var sheets = document.querySelectorAll("section.page.pg[data-rpt-sheet]");
  for (var n = 0; n < sheets.length; n++) {
    var number = document.createElement("div");
    number.className = "pg-num";
    number.textContent = "صفحة " + (n + 1) + " من " + sheets.length;
    sheets[n]!.appendChild(number);
  }
  document.documentElement.setAttribute("data-rpt-ready", "1");
}

/** Inline script for the print page: pack once now, and again when the fonts have settled. */
export function valuationReportPaginateScript(): string {
  return `(function(){
  var paginate = ${paginateValuationReport.toString()};
  function run(){ try { paginate(); } catch (e) { document.documentElement.setAttribute("data-rpt-ready", "1"); } }
  run();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
})();`;
}
