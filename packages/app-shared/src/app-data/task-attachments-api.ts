import {
  deleteAttachment,
  listAttachments,
  uploadAttachment,
} from "@platform/api-client";
import { downloadAttachmentBlobOnce } from "./attachment-blob-cache";
import { prototypeModulesApiConfig } from "./modules-api-config";
import {
  blobToDataUrl,
  fileToBase64,
} from "@platform/app-shared/media/file-encoding";
import {
  currentOfflineUserId,
  isBrowserOffline,
  uploadAttachmentWithOfflineFallback,
} from "../offline/offline-write";
import { getOfflineBlob } from "@platform/offline-client";

export type TaskAttachmentPreview = {
  fileName: string;
  mimeType: string;
  dataUrl?: string;
  attachmentId?: string;
  sizeBytes?: number;
};

const previewCache = new Map<string, TaskAttachmentPreview>();
/** Callers re-run while a scope is still listing — share the promise, not the request. */
const inFlightPrefetch = new Map<string, Promise<TaskAttachmentPreview | null>>();

function cacheKey(scope: string, taskId: string): string {
  return `${scope}:${taskId}`;
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

export function prefetchTaskAttachment(
  scope: string,
  taskId: string,
): Promise<TaskAttachmentPreview | null> {
  const config = prototypeModulesApiConfig();
  if (!config || !taskId) return Promise.resolve(null);

  const key = cacheKey(scope, taskId);
  const pending = inFlightPrefetch.get(key);
  if (pending) return pending;

  const run = (async () => {
    const listed = await listAttachments(config, scope, taskId);
    if (!listed.ok || listed.data.length === 0) return null;

    const meta = listed.data[0]!;
    return hydrateAttachmentPreview({
      fileName: meta.fileName,
      mimeType: meta.contentType,
      attachmentId: meta.id,
      sizeBytes: meta.sizeBytes,
    }, scope, taskId);
  })();
  inFlightPrefetch.set(key, run);
  void run.finally(() => {
    if (inFlightPrefetch.get(key) === run) inFlightPrefetch.delete(key);
  });
  return run;
}

/** Resolve preview bytes from attachmentId (or reuse in-memory cache). */
export async function ensureTaskAttachmentPreview(
  attachment: TaskAttachmentPreview,
  scope?: string,
  taskId?: string,
): Promise<TaskAttachmentPreview | null> {
  if (attachment.dataUrl) return attachment;

  if (scope && taskId) {
    const cached = getCachedTaskAttachment(scope, taskId);
    if (cached?.dataUrl) return cached;
  }

  if (attachment.attachmentId) {
    return hydrateAttachmentPreview(attachment, scope, taskId);
  }

  if (scope && taskId) {
    return prefetchTaskAttachment(scope, taskId);
  }

  return null;
}

async function hydrateAttachmentPreview(
  base: TaskAttachmentPreview,
  scope?: string,
  taskId?: string,
): Promise<TaskAttachmentPreview | null> {
  const config = prototypeModulesApiConfig();
  if (!config || !base.attachmentId) return null;

  const preview: TaskAttachmentPreview = {
    fileName: base.fileName,
    mimeType: base.mimeType,
    attachmentId: base.attachmentId,
    sizeBytes: base.sizeBytes,
  };

  const blobResult = await downloadAttachmentBlobOnce(config, base.attachmentId);
  if (blobResult.ok) {
    try {
      preview.dataUrl = await blobToDataUrl(blobResult.data);
    } catch {
      /* metadata only */
    }
  } else {
    const userId = currentOfflineUserId();
    if (userId && base.attachmentId) {
      const cached = await getOfflineBlob(userId, base.attachmentId);
      if (cached?.bytes) {
        try {
          preview.dataUrl = await blobToDataUrl(
            new Blob([cached.bytes], { type: cached.contentType }),
          );
        } catch {
          /* metadata only */
        }
      }
    }
  }

  if (scope && taskId) {
    previewCache.set(cacheKey(scope, taskId), preview);
  }
  return preview;
}

export async function uploadTaskScopedAttachment(
  scope: string,
  taskId: string,
  file: File,
): Promise<TaskAttachmentPreview | null> {
  if (!taskId) return null;

  const preview: TaskAttachmentPreview = {
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
  };

  const wantsPreview =
    file.type.startsWith("image/") || file.type === "application/pdf";

  if (wantsPreview) {
    try {
      preview.dataUrl = await blobToDataUrl(file);
    } catch {
      /* continue */
    }
  }

  const bytes = await file.arrayBuffer();
  const config = prototypeModulesApiConfig();
  if (config && !isBrowserOffline()) {
    await replaceScopeAttachments(scope, taskId);
  }

  try {
    const uploaded = await uploadAttachmentWithOfflineFallback({
      scope,
      scopeKey: taskId,
      fileName: file.name,
      contentType: preview.mimeType,
      bytes,
      onlineUpload: async () => {
        if (!config) {
          throw new TypeError("Failed to fetch");
        }
        const upload = await uploadAttachment(config, {
          scope,
          scopeKey: taskId,
          fileName: file.name,
          contentType: preview.mimeType,
          contentBase64: await fileToBase64(file),
        });
        if (!upload.ok) {
          throw new TypeError("Failed to fetch");
        }
        return upload.data.id;
      },
    });
    preview.attachmentId = uploaded.attachmentId;
  } catch {
    return null;
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
  void openTaskAttachmentPreviewAsync(attachment);
}

export async function openTaskAttachmentPreviewAsync(
  attachment: TaskAttachmentPreview,
  scope?: string,
  taskId?: string,
): Promise<void> {
  const resolved = await ensureTaskAttachmentPreview(attachment, scope, taskId);
  const dataUrl = resolved?.dataUrl;
  if (!dataUrl) return;

  try {
    if (dataUrl.startsWith("data:")) {
      const comma = dataUrl.indexOf(",");
      if (comma > 0) {
        const header = dataUrl.slice(0, comma);
        const base64 = dataUrl.slice(comma + 1);
        const mimeMatch = /^data:([^;]+)/.exec(header);
        const mimeType =
          mimeMatch?.[1] ||
          resolved?.mimeType ||
          attachment.mimeType ||
          "application/octet-stream";
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

export async function downloadTaskAttachmentAsync(
  attachment: TaskAttachmentPreview,
  scope?: string,
  taskId?: string,
): Promise<void> {
  const resolved = await ensureTaskAttachmentPreview(attachment, scope, taskId);
  if (!resolved?.dataUrl) return;
  const link = document.createElement("a");
  link.href = resolved.dataUrl;
  link.download = resolved.fileName || attachment.fileName || "download";
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
