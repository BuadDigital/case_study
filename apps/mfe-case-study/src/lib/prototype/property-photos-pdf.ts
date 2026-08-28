import type { PropertyDetailDocumentEntry } from "./property-detail-documents";
import { escapeHtml as esc } from "@platform/app-shared/lib/html-escape";

/**
 * Opens a print-ready window of property photos (user can Save as PDF).
 * Matches Case Study.html «تنزيل الصور PDF» intent without a PDF dependency.
 */
export function openPropertyPhotosPdfPrint(
  photos: PropertyDetailDocumentEntry[],
  title: string,
): boolean {
  const withData = photos.filter((p) => p.dataUrl?.startsWith("data:"));
  if (withData.length === 0 || typeof window === "undefined") return false;

  // «noopener» ضمن الخصائص يجعل window.open يعيد null — نفتح بمقبض ثم نقطع opener.
  const win = window.open("", "_blank", "width=960,height=720");
  if (!win) return false;
  win.opener = null;

  const figures = withData
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

  win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head>
    <meta charset="utf-8"/>
    <title>${esc(title)}</title>
    <style>
      body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#102B4E}
      h1{font-size:18px;margin:0 0 18px}
      @media print{button{display:none!important} body{padding:0}}
    </style>
  </head><body>
    <button type="button" onclick="window.print()" style="margin-bottom:16px;padding:8px 14px;cursor:pointer">طباعة / حفظ PDF</button>
    <h1>${esc(title)} — ${withData.length} صورة</h1>
    ${figures}
    <script>window.addEventListener('load',function(){setTimeout(function(){window.print()},350)});<\/script>
  </body></html>`);
  win.document.close();
  return true;
}
