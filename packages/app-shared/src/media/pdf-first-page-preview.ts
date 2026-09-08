/**
 * Renders page 1 of a PDF to a JPEG data URL for attachment thumbnails.
 */

import { loadPdfJs } from "@platform/app-shared/media/load-pdfjs";


export async function pdfBlobToFirstPageDataUrl(
  blob: Blob,
  scale = 1.25,
): Promise<string | undefined> {
  if (typeof document === "undefined") return undefined;

  try {
    const [pdfjs, buffer] = await Promise.all([loadPdfJs(), blob.arrayBuffer()]);
    const data = new Uint8Array(buffer);
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
