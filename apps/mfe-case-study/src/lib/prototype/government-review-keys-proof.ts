import {
  deleteAttachment,
  downloadAttachmentBlob,
  uploadAttachment,
} from "@platform/api-client";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";
import type { GovernmentReviewKeysProofFile } from "./government-review-work-data";

export const GOVERNMENT_REVIEW_KEYS_PROOF_ACCEPT =
  "image/*,application/pdf";

export const GOVERNMENT_REVIEW_KEYS_PROOF_MAX_BYTES = 8 * 1024 * 1024;

export const GOVERNMENT_REVIEW_KEYS_PROOF_SCOPE = "government-keys-proof";

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
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

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function createGovernmentReviewKeysProofId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `keys-proof-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function isGovernmentReviewKeysProofMime(mimeType: string): boolean {
  const m = mimeType.toLowerCase();
  return m.startsWith("image/") || m === "application/pdf";
}

export function governmentReviewKeysProofScopeKey(
  taskId: string,
  proofId: string,
): string {
  return `${taskId.trim()}:${proofId.trim()}`;
}

/**
 * Upload keys-proof to `/api/attachments` and keep a local preview dataUrl.
 * Payload persistence should store metadata + attachmentId only (no dataUrl).
 */
export async function fileToGovernmentReviewKeysProof(
  file: File,
  taskId: string,
): Promise<GovernmentReviewKeysProofFile> {
  if (!isGovernmentReviewKeysProofMime(file.type)) {
    throw new Error("نوع الملف غير مدعوم — ارفع صورة أو PDF");
  }
  if (file.size > GOVERNMENT_REVIEW_KEYS_PROOF_MAX_BYTES) {
    throw new Error("حجم الملف يتجاوز 8 ميجابايت");
  }

  const id = createGovernmentReviewKeysProofId();
  const mimeType = file.type || "application/octet-stream";
  const dataUrl = await readAsDataUrl(file);
  const config = prototypeModulesApiConfig();

  if (!config || !taskId.trim()) {
    // Offline / demo fallback — keep legacy embedded dataUrl.
    return { id, fileName: file.name, mimeType, dataUrl };
  }

  const upload = await uploadAttachment(config, {
    scope: GOVERNMENT_REVIEW_KEYS_PROOF_SCOPE,
    scopeKey: governmentReviewKeysProofScopeKey(taskId, id),
    fileName: file.name,
    contentType: mimeType,
    contentBase64: await fileToBase64(file),
  });

  if (!upload.ok) {
    throw new Error("تعذّر رفع إثبات المفتاح — تحقق من الاتصال وحاول مجدداً");
  }

  return {
    id,
    fileName: file.name,
    mimeType,
    dataUrl,
    attachmentId: upload.data.id,
    sizeBytes: file.size,
  };
}

/** Persistable shape — strip preview bytes when a server attachment id exists. */
export function toDurableGovernmentReviewKeysProof(
  file: GovernmentReviewKeysProofFile,
): GovernmentReviewKeysProofFile {
  if (file.attachmentId) {
    return {
      id: file.id,
      fileName: file.fileName,
      mimeType: file.mimeType,
      attachmentId: file.attachmentId,
      sizeBytes: file.sizeBytes,
    };
  }
  return file;
}

export async function hydrateGovernmentReviewKeysProofPreview(
  file: GovernmentReviewKeysProofFile,
): Promise<GovernmentReviewKeysProofFile> {
  if (file.dataUrl || !file.attachmentId) return file;
  const config = prototypeModulesApiConfig();
  if (!config) return file;
  const blob = await downloadAttachmentBlob(config, file.attachmentId);
  if (!blob.ok) return file;
  try {
    return { ...file, dataUrl: await blobToDataUrl(blob.data) };
  } catch {
    return file;
  }
}

export async function deleteGovernmentReviewKeysProofAttachment(
  file: GovernmentReviewKeysProofFile,
): Promise<void> {
  if (!file.attachmentId) return;
  const config = prototypeModulesApiConfig();
  if (!config) return;
  await deleteAttachment(config, file.attachmentId);
}
