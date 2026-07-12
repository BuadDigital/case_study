/**
 * Renders page 1 of a PDF to a JPEG data URL for attachment thumbnails.
 */

let workerReady = false;

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  if (!workerReady && typeof window !== "undefined") {
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    workerReady = true;
  }
  return pdfjs;
}

export async function pdfBlobToFirstPageDataUrl(
  blob: Blob,
  scale = 1.25,
): Promise<string | undefined> {
  if (typeof document === "undefined") return undefined;

  try {
    const pdfjs = await loadPdfJs();
    const data = new Uint8Array(await blob.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const canvasContext = canvas.getContext("2d");
    if (!canvasContext) {
      await pdf.cleanup();
      return undefined;
    }

    await page.render({
      canvas,
      canvasContext,
      viewport,
    }).promise;

    const preview = canvas.toDataURL("image/jpeg", 0.82);
    page.cleanup();
    await pdf.cleanup();
    return preview;
  } catch {
    return undefined;
  }
}

export async function pdfFileToFirstPageDataUrl(
  file: File,
): Promise<string | undefined> {
  return pdfBlobToFirstPageDataUrl(file);
}
