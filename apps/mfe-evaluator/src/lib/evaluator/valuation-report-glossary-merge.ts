/**
 * The template — and the fill — split the glossary into «مصطلحات مهنية (1/2)» and «(2/2)» so each
 * half fits its own sheet. It is one glossary: fold the second table into the first under a single
 * heading and let the rows flow on to the next sheet when they no longer fit.
 */
export function mergeGlossarySections(dom: Document): void {
  const first = dom.querySelector<HTMLElement>('[data-sec="38"]');
  if (!first) return;

  const heading = first.querySelector("h2");
  if (heading) {
    const number = heading.querySelector("span.n");
    heading.replaceChildren();
    if (number) heading.append(number, "مصطلحات مهنية");
    else heading.textContent = "مصطلحات مهنية";
  }

  const second = dom.querySelector<HTMLElement>('[data-sec="38ب"]');
  if (!second) return;

  const target = first.querySelector("table > tbody") ?? first.querySelector("table");
  const rows = [...second.querySelectorAll("table tr")];
  if (target) target.append(...rows);

  const page = second.closest("section.page.pg");
  second.remove();
  if (page && !page.querySelector("[data-sec]")) page.remove();
}
