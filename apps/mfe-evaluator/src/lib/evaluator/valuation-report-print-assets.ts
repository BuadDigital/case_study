/**
 * Print assets of the valuation report. The inliner that makes a print page self-contained lives in
 * app-shared (the case-study report PDF uses it too); this file keeps the report's own typeface.
 */

export {
  bytesToBase64,
  inlinePrintHtmlAssets,
  makeDataUrlFetcher,
} from "@platform/app-shared/media/inline-print-assets";

/**
 * Report typeface for print copies — the shell renders with Tajawal (next/font), so the
 * print tab and the server-rendered PDF embed the same face instead of falling back to
 * whatever the OS or the render container has installed. Paths are relative to <base href>.
 */
export const PRINT_FONT_FACE_CSS = [
  ["Tajawal-Regular", 400],
  ["Tajawal-Medium", 500],
  ["Tajawal-Bold", 700],
]
  .map(([file, weight]) => {
    const arabic =
      "U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC";
    const latin =
      "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
    return (
      `@font-face{font-family:"Tajawal";font-style:normal;font-weight:${weight};font-display:swap;` +
      `src:url("ejadah/fonts/${file}.woff2") format("woff2");unicode-range:${arabic}}` +
      `@font-face{font-family:"Tajawal";font-style:normal;font-weight:${weight};font-display:swap;` +
      `src:url("ejadah/fonts/${file}-latin.woff2") format("woff2");unicode-range:${latin}}`
    );
  })
  .join("\n");
