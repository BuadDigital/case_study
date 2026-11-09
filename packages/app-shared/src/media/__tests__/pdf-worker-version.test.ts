import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * `loadPdfJs` points pdf.js at the app's static `/pdf.worker.min.mjs`. pdf.js refuses a worker
 * whose version differs from the library («The API version … does not match the Worker
 * version …»), so every PDF preview silently failed after the 2026-09-16 pdfjs-dist bump left
 * the copy at 6.1.200 — report sections «صك الملكية» / «التقرير المساحي» printed a PDF note
 * instead of the page. Re-copy `pdfjs-dist/build/pdf.worker.min.mjs` whenever pdfjs-dist moves.
 */
describe("pdf.js worker copy", () => {
  it("matches the installed pdfjs-dist", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const publicWorker = path.resolve(here, "../../../../../apps/shell/public/pdf.worker.min.mjs");
    const packageWorker = createRequire(import.meta.url).resolve(
      "pdfjs-dist/build/pdf.worker.min.mjs",
    );
    const version = (file: string) =>
      /apiVersion:\w+\}=\w+,\w+="([^"]+)"/.exec(readFileSync(file, "utf8"))?.[1] ?? "";

    expect(version(packageWorker)).not.toBe("");
    expect(version(publicWorker)).toBe(version(packageWorker));
  });
});
