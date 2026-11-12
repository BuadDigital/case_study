import type { PropertyDetailDocumentEntry } from "./property-detail-documents";
import { escapeHtml as esc } from "@platform/app-shared/lib/html-escape";

/**
 * One captioned figure per photo, numbered in order — the body of the photos printout.
 *
 * How it works: each photo with a data URL becomes a `<figure>` that never breaks across pages, captioned
 * «n. name · source». Edge cases: a photo without a data URL is the caller's to drop (it is printed as given).
 */
function propertyPhotosFiguresHtml(photos: PropertyDetailDocumentEntry[]): string {
  return photos
    .map(
      (p, i) => `
      <figure style="break-inside:avoid;margin:0 0 18px;page-break-inside:avoid">
        <img src="${p.dataUrl}" alt="${esc(p.name)}" style="max-width:100%;max-height:240mm;display:block;margin:0 auto;border:1px solid #ddd" />
        <figcaption style="margin-top:8px;font-size:12px;color:#444;text-align:center">
          ${i + 1}. ${esc(p.name)} · ${esc(p.source)}
        </figcaption>
      </figure>`,
    )
    .join("");
}

/**
 * A print page of property photos for the server PDF renderer (Enfaz's «صور الأصل … (PDF مجمّع)»).
 *
 * How it works: one captioned figure per photo, under a title, with `fontsHtml` (the page's font links,
 * inlined by the caller) and no toolbar or print script.
 *
 * Edge cases: photos without a data URL are dropped. Added 2026-11-04. The browser print window that
 * «تنزيل الصور PDF» opened from the photos tab was removed 2026-11-12 (Omar) — this is the one printout left.
 */
export function buildPropertyPhotosPrintHtml(
  photos: PropertyDetailDocumentEntry[],
  title: string,
  fontsHtml = "",
): string {
  const withData = photos.filter((p) => p.dataUrl?.startsWith("data:"));
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head>
    <meta charset="utf-8"/>
    <title>${esc(title)}</title>
    ${fontsHtml}
    <style>
      @page{size:A4;margin:14mm}
      body{font-family:"IBM Plex Sans Arabic",Tahoma,Arial,sans-serif;margin:0;color:#102B4E;direction:rtl}
      h1{font-size:18px;margin:0 0 18px}
    </style>
  </head><body>
    <h1>${esc(title)} — ${withData.length} صورة</h1>
    ${propertyPhotosFiguresHtml(withData)}
  </body></html>`;
}
