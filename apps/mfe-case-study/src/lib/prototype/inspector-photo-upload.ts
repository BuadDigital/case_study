import {
  downloadAttachmentBlob,
  uploadAttachment,
} from "@platform/api-client";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";
import type { InspectorPhotoAttachment } from "./inspector-workspace-data";
import { burnInspectorPhotoStamp } from "./inspector-photo-stamp";

const SCOPE = "field-inspection-photo";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const previewCache = new Map<string, string>();

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

export function inspectorPhotoCacheKey(
  taskId: string,
  photoRef: string,
): string {
  return `${taskId}:${photoRef}`;
}

export function getInspectorPhotoDataUrl(
  taskId: string,
  photoRef: string,
): string | undefined {
  return previewCache.get(inspectorPhotoCacheKey(taskId, photoRef));
}

export function setInspectorPhotoDataUrl(
  taskId: string,
  photoRef: string,
  dataUrl: string,
): void {
  previewCache.set(inspectorPhotoCacheKey(taskId, photoRef), dataUrl);
}

export function clearInspectorPhotoDataUrl(
  taskId: string,
  photoRef: string,
): void {
  previewCache.delete(inspectorPhotoCacheKey(taskId, photoRef));
}

export async function prefetchInspectorPhoto(
  taskId: string,
  photoRef: string,
  attachment: InspectorPhotoAttachment,
): Promise<string | undefined> {
  const key = inspectorPhotoCacheKey(taskId, photoRef);
  const cached = previewCache.get(key);
  if (cached) return cached;

  const config = prototypeModulesApiConfig();
  if (!config || !attachment.attachmentId) return undefined;

  const blobResult = await downloadAttachmentBlob(config, attachment.attachmentId);
  if (!blobResult.ok) return undefined;

  try {
    const dataUrl = await blobToDataUrl(blobResult.data);
    previewCache.set(key, dataUrl);
    return dataUrl;
  } catch {
    return undefined;
  }
}

export async function uploadInspectorPhotoFromFile(
  taskId: string,
  photoRef: string,
  file: File,
  options?: { stampText?: string },
): Promise<
  | { ok: true; attachment: InspectorPhotoAttachment }
  | { ok: false; error: string }
> {
  if (!taskId) {
    return { ok: false, error: "تعذّر حفظ الصورة." };
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "يُقبل ملفات الصور فقط (JPG، PNG، …)." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "الحجم الأقصى للصورة 8 ميجابايت." };
  }

  const stamp = options?.stampText?.trim() ?? "";
  let uploadFile = file;
  try {
    if (stamp) {
      uploadFile = await burnInspectorPhotoStamp(file, stamp);
    }
  } catch (err) {
    console.warn("Inspector photo stamp failed; uploading original image", err);
  }

  const attachment: InspectorPhotoAttachment = {
    fileName: uploadFile.name,
    mimeType: uploadFile.type || "image/jpeg",
    sizeBytes: uploadFile.size,
  };

  try {
    const dataUrl = await readAsDataUrl(uploadFile);
    setInspectorPhotoDataUrl(taskId, photoRef, dataUrl);
  } catch {
    /* preview optional */
  }

  const config = prototypeModulesApiConfig();
  if (config) {
    const upload = await uploadAttachment(config, {
      scope: SCOPE,
      scopeKey: `${taskId}:${photoRef}`,
      fileName: uploadFile.name,
      contentType: attachment.mimeType,
      contentBase64: await fileToBase64(uploadFile),
    });
    if (!upload.ok) {
      return { ok: false, error: "تعذّر رفع الصورة — تحقق من الاتصال وحاول مجدداً." };
    }
    attachment.attachmentId = upload.data.id;
  }

  return { ok: true, attachment };
}

export function openInspectorPhotoPreview(dataUrl: string): void {
  window.open(dataUrl, "_blank", "noopener,noreferrer");
}
