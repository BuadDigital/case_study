/**
 * محمّل pdfjs-dist الوحيد — كان مكرراً بمُهيّئي worker مختلفين في
 * mfe-case-study وmfe-engineering-office فتنشطر الحزمة غير الرخيصة (~350KB)
 * إلى نسختين لا تتشاركان التخزين المؤقت.
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
