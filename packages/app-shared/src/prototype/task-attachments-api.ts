import {
  deleteAttachment,
  downloadAttachmentBlob,
  listAttachments,
  uploadAttachment,
} from "@platform/api-client";
import { prototypeModulesApiConfig } from "./prototype-modules-api-config";

export type TaskAttachmentPreview = {
  fileName: string;
  mimeType: string;
  dataUrl?: string;
  attachmentId?: string;
  sizeBytes?: number;
};

const previewCache = new Map<string, TaskAttachmentPreview>();

function cacheKey(scope: string, taskId: string): string {
  return `${scope}:${taskId}`;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

async function replaceScopeAttachments(
  scope: string,
  scopeKey: string,
): Promise<void> {
  const config = prototypeModulesApiConfig();
  if (!config) return;

  const existing = await listAttachments(config, scope, scopeKey);
  if (!existing.ok) return;

  await Promise.all(
    existing.data.map((meta) => deleteAttachment(config, meta.id)),
  );
}

export function getCachedTaskAttachment(
  scope: string,
  taskId: string,
): TaskAttachmentPreview | null {
  return previewCache.get(cacheKey(scope, taskId)) ?? null;
}

export async function prefetchTaskAttachment(
  scope: string,
  taskId: string,
): Promise<TaskAttachmentPreview | null> {
  const config = prototypeModulesApiConfig();
  if (!config || !taskId) return null;

  const listed = await listAttachments(config, scope, taskId);
  if (!listed.ok || listed.data.length === 0) return null;

  const meta = listed.data[0]!;
  const blobResult = await downloadAttachmentBlob(config, meta.id);
  const preview: TaskAttachmentPreview = {
    fileName: meta.fileName,
    mimeType: meta.contentType,
    attachmentId: meta.id,
    sizeBytes: meta.sizeBytes,
  };

  if (blobResult.ok) {
    try {
      preview.dataUrl = await blobToDataUrl(blobResult.data);
    } catch {
      /* metadata only */
    }
  }

  previewCache.set(cacheKey(scope, taskId), preview);
  return preview;
}

export async function uploadTaskScopedAttachment(
  scope: string,
  taskId: string,
  file: File,
): Promise<TaskAttachmentPreview | null> {
  if (!taskId) return null;

  const config = prototypeModulesApiConfig();
  const preview: TaskAttachmentPreview = {
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
  };

  if (file.type.startsWith("image/") || file.type === "application/pdf") {
    try {
      preview.dataUrl = await readAsDataUrl(file);
    } catch {
      /* continue */
    }
  }

  if (config) {
    await replaceScopeAttachments(scope, taskId);
    const upload = await uploadAttachment(config, {
      scope,
      scopeKey: taskId,
      fileName: file.name,
      contentType: preview.mimeType,
      contentBase64: await fileToBase64(file),
    });
    if (!upload.ok) {
      return null;
    }
    preview.attachmentId = upload.data.id;
  }

  previewCache.set(cacheKey(scope, taskId), preview);
  return preview;
}

export async function clearTaskScopedAttachments(
  scope: string,
  taskId: string,
): Promise<void> {
  previewCache.delete(cacheKey(scope, taskId));
  const config = prototypeModulesApiConfig();
  if (!config || !taskId) return;
  await replaceScopeAttachments(scope, taskId);
}

export function openTaskAttachmentPreview(
  attachment: TaskAttachmentPreview,
): void {
  if (!attachment.dataUrl) return;

  const dataUrl = attachment.dataUrl;
  try {
    if (dataUrl.startsWith("data:")) {
      const comma = dataUrl.indexOf(",");
      if (comma > 0) {
        const header = dataUrl.slice(0, comma);
        const base64 = dataUrl.slice(comma + 1);
        const mimeMatch = /^data:([^;]+)/.exec(header);
        const mimeType = mimeMatch?.[1] || attachment.mimeType || "application/octet-stream";
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blobUrl = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
        const opened = window.open(blobUrl, "_blank", "noopener,noreferrer");
        if (!opened) {
          URL.revokeObjectURL(blobUrl);
          return;
        }
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
        return;
      }
    }
  } catch {
    /* fall through to data URL */
  }

  window.open(dataUrl, "_blank", "noopener,noreferrer");
}
