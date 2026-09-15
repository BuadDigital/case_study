import { downloadAttachmentBlobOnce } from "./attachment-blob-cache";
import { prototypeModulesApiConfig } from "./modules-api-config";

export type DocumentFileRef = {
  fileName: string;
  dataUrl?: string;
  attachmentId?: string;
};

function clickDownload(href: string, fileName: string): void {
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** Decode a data: URL into a Blob so PDFs preview inline instead of downloading. */
export function blobFromDataUrl(dataUrl: string): Blob | null {
  if (!dataUrl.startsWith("data:")) return null;
  const comma = dataUrl.indexOf(",");
  if (comma <= 0) return null;
  const header = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1);
  const mime = /^data:([^;]+)/.exec(header)?.[1] || "application/octet-stream";
  try {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch {
    return null;
  }
}

export function objectUrlFromDataUrl(dataUrl: string): string | null {
  const blob = blobFromDataUrl(dataUrl);
  if (!blob) return null;
  try {
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

function assignPreview(href: string, target?: Window | null): boolean {
  if (target && !target.closed) {
    try {
      target.opener = null;
      target.location.href = href;
      return true;
    } catch {
      try {
        target.close();
      } catch {
        /* already gone */
      }
    }
  }
  return Boolean(window.open(href, "_blank", "noopener,noreferrer"));
}

function closeTarget(target?: Window | null): void {
  if (!target || target.closed) return;
  try {
    target.close();
  } catch {
    /* ignore */
  }
}

/**
 * Save a property document: from its hydrated preview when there is one, else by fetching the
 * attachment on demand (rows listed from metadata only, e.g. documents-tab uploads).
 */
export async function downloadDocumentFile(doc: DocumentFileRef): Promise<void> {
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

/**
 * Open the document in a new tab. Pass a window opened synchronously in the click
 * handler so the popup blocker does not fire after the attachment fetch.
 */
export async function previewDocumentFile(
  doc: DocumentFileRef,
  target?: Window | null,
): Promise<void> {
  const revokeLater = (url: string) => {
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  if (doc.dataUrl) {
    const blobUrl = objectUrlFromDataUrl(doc.dataUrl);
    const href = blobUrl ?? doc.dataUrl;
    if (!assignPreview(href, target)) {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      closeTarget(target);
      return;
    }
    if (blobUrl) revokeLater(blobUrl);
    return;
  }

  const attachmentId = doc.attachmentId?.trim();
  if (!attachmentId) {
    closeTarget(target);
    return;
  }
  const config = prototypeModulesApiConfig();
  if (!config) {
    closeTarget(target);
    return;
  }
  const result = await downloadAttachmentBlobOnce(config, attachmentId);
  if (!result.ok) {
    closeTarget(target);
    return;
  }
  const url = URL.createObjectURL(result.data);
  if (!assignPreview(url, target)) {
    URL.revokeObjectURL(url);
    closeTarget(target);
    return;
  }
  revokeLater(url);
}
