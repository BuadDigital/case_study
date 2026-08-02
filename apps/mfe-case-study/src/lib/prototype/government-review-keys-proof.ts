import {
  deleteAttachment,
  downloadAttachmentBlob,
  uploadAttachment,
} from "@platform/api-client";
import { uploadAttachmentWithOfflineFallback } from "@platform/app-shared/offline/offline-write";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";
import type { GovernmentReviewKeysProofFile } from "./government-review-work-data";
import { processEvidencePhoto } from "./process-evidence-photo";

export const GOVERNMENT_REVIEW_KEYS_PROOF_ACCEPT =
  "image/*,.heic,.heif,application/pdf";

export const GOVERNMENT_REVIEW_KEYS_PROOF_MAX_BYTES = 8 * 1024 * 1024;
/** Pre-process ceiling for camera/HEIC originals before compression (هـ). */
const MAX_IMAGE_INPUT_BYTES = 20 * 1024 * 1024;
const MAX_PROCESSED_IMAGE_BYTES = 1024 * 1024;

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

function isPdf(file: File): boolean {
  return (
    file.type.toLowerCase() === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

function isImageLike(file: File): boolean {
  return (
    file.type.startsWith("image/") ||
    /\.(heic|heif|jpe?g|png|webp|gif)$/i.test(file.name)
  );
}

export function createGovernmentReviewKeysProofId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `keys-proof-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function isGovernmentReviewKeysProofMime(mimeType: string): boolean {
  const m = mimeType.toLowerCase();
  return m.startsWith("image/") || m === "application/pdf" || m === "";
}

export function governmentReviewKeysProofScopeKey(
  taskId: string,
  proofId: string,
): string {
  return `${taskId.trim()}:${proofId.trim()}`;
}

/**
 * Upload keys-proof to `/api/attachments` and keep a local preview dataUrl.
 * Images: EXIF → HEIC→JPEG → compress ≤1MB (هـ). PDFs: pass-through, no compression.
 */
export async function fileToGovernmentReviewKeysProof(
  file: File,
  taskId: string,
): Promise<GovernmentReviewKeysProofFile> {
  const looksSupported = isPdf(file) || isImageLike(file);
  if (!looksSupported) {
    throw new Error("نوع الملف غير مدعوم — ارفع صورة أو PDF");
  }

  let uploadFile = file;
  let photoMetadata:
    | {
        latitude: number | null;
        longitude: number | null;
        capturedAtUtc: string | null;
      }
    | undefined;

  if (isPdf(file)) {
    if (file.size > GOVERNMENT_REVIEW_KEYS_PROOF_MAX_BYTES) {
      throw new Error("حجم الملف يتجاوز 8 ميجابايت");
    }
  } else {
    if (file.size > MAX_IMAGE_INPUT_BYTES) {
      throw new Error("الحجم الأقصى للصورة قبل المعالجة 20 ميجابايت");
    }
    try {
      const processed = await processEvidencePhoto(file);
      uploadFile = processed.file;
      photoMetadata = {
        latitude: processed.exif.latitude ?? null,
        longitude: processed.exif.longitude ?? null,
        capturedAtUtc: processed.exif.capturedAt ?? null,
      };
    } catch (err) {
      console.warn("Keys-proof image processing failed", err);
      throw new Error("تعذّر معالجة الصورة قبل الرفع. حاول بصيغة JPG.");
    }
    if (uploadFile.size > MAX_PROCESSED_IMAGE_BYTES) {
      throw new Error("تعذّر ضغط الصورة إلى أقل من 1 ميجابايت.");
    }
  }

  const id = createGovernmentReviewKeysProofId();
  const mimeType = uploadFile.type || "application/octet-stream";
  const dataUrl = await readAsDataUrl(uploadFile);
  const config = prototypeModulesApiConfig();
  const bytes = await uploadFile.arrayBuffer();
  const scopeKey = governmentReviewKeysProofScopeKey(taskId, id);

  const uploaded = await uploadAttachmentWithOfflineFallback({
    scope: GOVERNMENT_REVIEW_KEYS_PROOF_SCOPE,
    scopeKey,
    fileName: uploadFile.name,
    contentType: mimeType,
    bytes,
    onlineUpload: async () => {
      if (!config || !taskId.trim()) {
        throw new Error(
          "تعذّر رفع إثبات المفتاح — تحقق من الاتصال وحاول مجدداً",
        );
      }
      const upload = await uploadAttachment(config, {
        scope: GOVERNMENT_REVIEW_KEYS_PROOF_SCOPE,
        scopeKey,
        fileName: uploadFile.name,
        contentType: mimeType,
        contentBase64: await fileToBase64(uploadFile),
        photoMetadata,
      });
      if (!upload.ok) {
        throw new Error(
          "تعذّر رفع إثبات المفتاح — تحقق من الاتصال وحاول مجدداً",
        );
      }
      return upload.data.id;
    },
  });

  return {
    id,
    fileName: uploadFile.name,
    mimeType,
    dataUrl,
    attachmentId: uploaded.attachmentId,
    sizeBytes: uploadFile.size,
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
