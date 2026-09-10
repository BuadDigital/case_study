import { downloadAttachmentBlobOnce } from "./attachment-blob-cache";
import { prototypeModulesApiConfig } from "./modules-api-config";

function clickDownload(href: string, fileName: string): void {
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Save a property document: from its hydrated preview when there is one, else by fetching the
 * attachment on demand (rows listed from metadata only, e.g. documents-tab uploads).
 */
export async function downloadDocumentFile(doc: {
  fileName: string;
  dataUrl?: string;
  attachmentId?: string;
}): Promise<void> {
  if (doc.dataUrl) {
    clickDownload(doc.dataUrl, doc.fileName);
    return;
  }
  const attachmentId = doc.attachmentId?.trim();
  if (!attachmentId) return;
  const config = prototypeModulesApiConfig();
  if (!config) return;
  const result = await downloadAttachmentBlobOnce(config, attachmentId);
  if (!result.ok) return;
  const url = URL.createObjectURL(result.data);
  clickDownload(url, doc.fileName);
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
