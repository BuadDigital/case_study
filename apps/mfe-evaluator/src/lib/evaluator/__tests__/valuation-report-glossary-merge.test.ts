import { describe, expect, it } from "vitest";
import { mergeGlossarySections } from "../valuation-report-glossary-merge";

function parse(html: string): Document {
  return new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
}

const rows = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `<tr><td class="k">t${from + i}</td><td>d</td></tr>`).join("");

describe("mergeGlossarySections", () => {
  it("folds the second half into the first table under one heading", () => {
    const dom = parse(`
      <section class="page pg"><section class="sec" data-sec="38"><h2><span class="n">38</span>مصطلحات مهنية (1 من 2)</h2><table><tbody>${rows(1, 3)}</tbody></table></section></section>
      <section class="page pg"><section class="sec" data-sec="38ب"><h2>مصطلحات مهنية (2 من 2)</h2><table><tbody>${rows(4, 6)}</tbody></table></section></section>`);
    mergeGlossarySections(dom);

    expect(dom.querySelectorAll('[data-sec="38ب"]')).toHaveLength(0);
    expect(dom.querySelectorAll("section.page.pg")).toHaveLength(1);
    expect(dom.querySelectorAll('[data-sec="38"] tr')).toHaveLength(6);
    expect([...dom.querySelectorAll('[data-sec="38"] td.k')].map((td) => td.textContent)).toEqual(
      ["t1", "t2", "t3", "t4", "t5", "t6"],
    );
    const heading = dom.querySelector('[data-sec="38"] h2')!;
    expect(heading.textContent).toBe("38مصطلحات مهنية");
    expect(heading.querySelector("span.n")?.textContent).toBe("38");
  });

  it("only retitles the section when there is no second half", () => {
    const dom = parse(
      `<section class="page pg"><section class="sec" data-sec="38"><h2><span class="n">38</span>مصطلحات مهنية (1 من 2)</h2><table><tbody>${rows(1, 2)}</tbody></table></section></section>`,
    );
    mergeGlossarySections(dom);
    expect(dom.querySelector('[data-sec="38"] h2')!.textContent).toBe("38مصطلحات مهنية");
    expect(dom.querySelectorAll('[data-sec="38"] tr')).toHaveLength(2);
  });

  it("does nothing when the report has no glossary", () => {
    const dom = parse(`<section class="page pg"><section class="sec" data-sec="1">x</section></section>`);
    expect(() => mergeGlossarySections(dom)).not.toThrow();
  });
});
