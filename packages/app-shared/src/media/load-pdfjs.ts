/**
 * Sole pdfjs-dist loader — previously duplicated with different worker setup in
 * mfe-case-study and mfe-engineering-office, splitting the costly package (~350KB)
 * into two copies that did not share cache.
 */

let workerReady = false;

export async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  if (!workerReady && typeof window !== "undefined") {
    // Prefer app static copy; fall back to package worker URL if missing/blocked.
    const candidates = [
      "/pdf.worker.min.mjs",
      // Bundler-resolved absolute URL when webpack/turbopack can emit the asset
      (() => {
        try {
          return new URL(
            "pdfjs-dist/build/pdf.worker.min.mjs",
            import.meta.url,
          ).toString();
        } catch {
          return "";
        }
      })(),
    ].filter(Boolean);
    pdfjs.GlobalWorkerOptions.workerSrc =
      candidates[0] ?? "/pdf.worker.min.mjs";
    workerReady = true;
  }
  return pdfjs;
}
