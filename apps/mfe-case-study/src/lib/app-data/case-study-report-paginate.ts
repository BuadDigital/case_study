/**
 * Lays the case-study report out on letterhead A4 sheets — the same page model as the valuation
 * report: each sheet carries the four letterhead strips and a white content box between them.
 *
 * The report is one long flow of blocks (title, commission table, one block per question section,
 * approval), so the sheets are built in the browser: every block is measured in the off-screen
 * `.csrd-flow`, then a clone goes onto the current sheet until the next block would not fit.
 *
 * Written in plain ES5 style on purpose: `caseStudyReportPaginateScript` ships this function's own
 * source into the standalone print page, so it must not lean on any imported helper.
 */
export function paginateCaseStudyReport(root: HTMLElement): void {
  var flow = root.querySelector(".csrd-flow");
  var host = root.querySelector(".csrd-sheets");
  if (!flow || !host) return;
  host.innerHTML = "";

  var slices = ["lh-head", "lh-foot", "lh-start", "lh-end"];

  function newSheetContent(): HTMLElement {
    var sheet = document.createElement("section");
    sheet.className = "csrd-sheet";
    for (var s = 0; s < slices.length; s++) {
      var slice = document.createElement("div");
      slice.className = "lh-slice " + slices[s];
      sheet.appendChild(slice);
    }
    var content = document.createElement("div");
    content.className = "csrd-sheet-content";
    sheet.appendChild(content);
    host!.appendChild(sheet);
    return content;
  }

  function availableHeight(content: HTMLElement): number {
    var style = window.getComputedStyle(content);
    var pad = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    return content.clientHeight - pad - 1;
  }

  var content = newSheetContent();
  var avail = availableHeight(content);
  var used = 0;

  for (var i = 0; i < flow.children.length; i++) {
    var block = flow.children[i] as HTMLElement;
    var style = window.getComputedStyle(block);
    var height =
      block.getBoundingClientRect().height +
      (parseFloat(style.marginTop) || 0) +
      (parseFloat(style.marginBottom) || 0);
    var forcesBreak = block.className.indexOf("csrd-section--break") !== -1;

    if (used > 0 && (forcesBreak || used + height > avail)) {
      content = newSheetContent();
      used = 0;
    }
    content.appendChild(block.cloneNode(true));
    used += height;
  }

  root.setAttribute("data-paginated", "1");
}

/** Inline script for the standalone print page: paginate once fonts and layout have settled. */
export function caseStudyReportPaginateScript(): string {
  return `(function(){
  var paginate = ${paginateCaseStudyReport.toString()};
  var root = document.querySelector(".csrd-root");
  if (!root) return;
  function run(){
    paginate(root);
    document.documentElement.setAttribute("data-csrd-ready", "1");
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
  window.addEventListener("load", run);
  if (document.readyState === "complete") run();
})();`;
}
