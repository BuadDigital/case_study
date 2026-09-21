/**
 * Print copy only: the template keeps every property photo in one «صور العقار» section, so a
 * property with more than six photos overflowed its sheet onto the letterhead footer. Photos are
 * laid out six to a sheet (two columns by three rows), each further sheet repeating the heading.
 */
export const PHOTOS_PER_PRINT_PAGE = 6;

export function paginatePropertyPhotoPages(
  dom: Document,
  perPage: number = PHOTOS_PER_PRINT_PAGE,
): void {
  const section = dom.querySelector<HTMLElement>('[data-sec="34"]');
  const firstPage = section?.closest<HTMLElement>("section.page.pg");
  const grid = section?.querySelector<HTMLElement>(":scope > div");
  const heading = section?.querySelector("h2");
  if (!section || !firstPage || !grid || !heading) return;

  const tiles = [...grid.children] as HTMLElement[];
  if (tiles.length <= perPage) return;

  const meta = firstPage.querySelector(".pg-meta");
  const pageNumber = firstPage.querySelector(".pg-num");
  const total = Math.ceil(tiles.length / perPage);

  // The design titles the sheets «صور العقار (1 من 2)», «صور العقار (2 من 2)»; only the first
  // carries the section number.
  const number = heading.querySelector("span.n");
  heading.replaceChildren();
  if (number) heading.append(number);
  heading.append(`صور العقار (1 من ${total})`);

  let previous: HTMLElement = firstPage;
  for (let start = perPage; start < tiles.length; start += perPage) {
    const page = firstPage.cloneNode(false) as HTMLElement;
    const sheetSection = section.cloneNode(false) as HTMLElement;
    const sheetGrid = grid.cloneNode(false) as HTMLElement;
    sheetGrid.append(...tiles.slice(start, start + perPage));
    const sheetHeading = dom.createElement("h2");
    sheetHeading.textContent = `صور العقار (${start / perPage + 1} من ${total})`;
    sheetSection.append(sheetHeading, sheetGrid);
    page.append(...[meta, sheetSection, pageNumber].flatMap((node) =>
      node ? [node.cloneNode(true)] : [],
    ));
    previous.after(page);
    previous = page;
  }
}
