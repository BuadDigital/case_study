import {
  downloadAttachmentBlob,
  uploadAttachment,
} from "@platform/api-client";
import { uploadAttachmentWithOfflineFallback } from "@platform/app-shared/offline/offline-write";
import {
  apiErrorMessage,
  resolveApiError,
} from "@platform/app-shared/prototype/work-orders-api-config";
import {
  freshPrototypeModulesApiConfig,
  prototypeModulesApiConfig,
} from "@platform/app-shared/prototype/prototype-modules-api-config";
import { ensureFreshAuthSession } from "@platform/app-shared/auth/ensure-fresh-session";
import type {
  InspectorPhotoAttachment,
  InspectorWorkspaceDraft,
} from "./inspector-workspace-data";
import { listServiceAmenityPhotoSlots } from "./inspector-workspace-data";
import { burnInspectorPhotoStamp } from "./inspector-photo-stamp";
import {
  buildEvidenceStampLines,
  processEvidencePhoto,
  type EvidencePhotoExif,
} from "./process-evidence-photo";
import { parseCoord } from "@platform/app-shared/media/photo-location";
import {
  blobToDataUrl,
  fileToBase64,
} from "@platform/app-shared/media/file-encoding";

const SCOPE = "field-inspection-photo";
/** Pre-process ceiling; after compress the upload is ≤ 1 MB. */
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

const previewCache = new Map<string, string>();

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

/** Hydrate preview cache for property-detail «Property photos» after loading the workspace. */
export async function prefetchInspectorWorkspacePhotos(
  draft: InspectorWorkspaceDraft,
): Promise<void> {
  const taskId = draft.taskId;
  if (!taskId) return;

  const include = (approved: boolean) =>
    approved || draft.status === "submitted";

  const jobs: (() => Promise<unknown>)[] = [];

  for (const def of listServiceAmenityPhotoSlots(draft)) {
    const slot = draft.definedPhotos[def.id];
    if (!slot || slot.none) continue;
    for (const photo of slot.photos) {
      if (!include(photo.approved) || !photo.attachmentId) continue;
      jobs.push(() =>
        prefetchInspectorPhoto(taskId, `slot:${def.id}:${photo.id}`, {
          fileName: photo.fileName,
          mimeType: photo.mimeType,
          attachmentId: photo.attachmentId,
          sizeBytes: photo.sizeBytes,
        }),
      );
    }
  }

  for (const photo of draft.freePhotos) {
    if (!include(photo.approved) || !photo.attachmentId) continue;
    jobs.push(() =>
      prefetchInspectorPhoto(taskId, `free:${photo.id}`, {
        fileName: photo.fileName,
        mimeType: photo.mimeType,
        attachmentId: photo.attachmentId,
        sizeBytes: photo.sizeBytes,
      }),
    );
  }

  for (const [key, attachment] of Object.entries(
    draft.featurePhotoAttachments,
  )) {
    if (!attachment?.attachmentId) continue;
    jobs.push(() => prefetchInspectorPhoto(taskId, `feature:${key}`, attachment));
  }

  for (const [key, attachment] of Object.entries(
    draft.componentPhotoAttachments,
  )) {
    if (!attachment?.attachmentId) continue;
    jobs.push(() => prefetchInspectorPhoto(taskId, `component:${key}`, attachment));
  }

  for (const obs of draft.observations) {
    const photo = obs.photo;
    if (!photo?.attachmentId) continue;
    jobs.push(() => prefetchInspectorPhoto(taskId, `observation:${obs.id}`, photo));
  }

  // Concurrency cap — a fifty-photo preview used to fire every download at once
  // saturating browser connections and crowding critical requests (js-request-idle-callback/scout F12).
  const CONCURRENCY = 5;
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, async () => {
      while (cursor < jobs.length) {
        const job = jobs[cursor++]!;
        await job();
      }
    }),
  );
}

export type UploadInspectorPhotoOptions = {
  /** Legacy prebuilt stamp; ignored when draft is provided. */
  stampText?: string;
  deedNumber?: string | null;
  draft?: InspectorWorkspaceDraft | null;
};

function stampFromContext(
  options: UploadInspectorPhotoOptions | undefined,
  exif: EvidencePhotoExif,
): string {
  if (options?.draft) {
    const draft = options.draft;
    return buildEvidenceStampLines({
      deedNumber: options.deedNumber ?? draft.propertyDisplayId,
      latitude: exif.latitude ?? draft.mapLatitude,
      longitude: exif.longitude ?? draft.mapLongitude,
      capturedAt: exif.capturedAt,
      fallbackDate: draft.inspectionDate,
      fallbackTime: draft.inspectionTime,
    });
  }
  return options?.stampText?.trim() ?? "";
}

async function uploadInspectorPhotoOnline(
  taskId: string,
  photoRef: string,
  uploadFile: File,
  photoMetadata: {
    latitude: number | null;
    longitude: number | null;
    capturedAtUtc: string | null;
    propertyLatitude: number | null;
    propertyLongitude: number | null;
  },
) {
  let config = await freshPrototypeModulesApiConfig();
  if (!config) {
    throw new Error(apiErrorMessage("auth", "يجب تسجيل الدخول لرفع الصور."));
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const upload = await uploadAttachment(config, {
      scope: SCOPE,
      scopeKey: `${taskId}:${photoRef}`,
      fileName: uploadFile.name,
      contentType: "image/jpeg",
      contentBase64: await fileToBase64(uploadFile),
      photoMetadata,
    });
    if (upload.ok) return upload.data;

    if (upload.kind === "auth" && attempt === 0) {
      const renewed = await ensureFreshAuthSession({ force: true });
      if (!renewed?.token) break;
      config = { token: renewed.token, baseUrl: config.baseUrl };
      continue;
    }

    throw new Error(
      resolveApiError(
        upload.kind,
        upload.errors,
        "تعذّر رفع الصورة — تحقق من الاتصال وحاول مجدداً.",
        upload.message,
      ),
    );
  }

  throw new Error(apiErrorMessage("auth", "يجب تسجيل الدخول لرفع الصور."));
}

export async function uploadInspectorPhotoFromFile(
  taskId: string,
  photoRef: string,
  file: File,
  options?: UploadInspectorPhotoOptions,
): Promise<
  | { ok: true; attachment: InspectorPhotoAttachment }
  | { ok: false; error: string }
> {
  if (!taskId) {
    return { ok: false, error: "تعذّر حفظ الصورة." };
  }
  const looksLikeImage =
    file.type.startsWith("image/") ||
    /\.(heic|heif|jpe?g|png|webp|gif)$/i.test(file.name);
  if (!looksLikeImage) {
    return { ok: false, error: "يُقبل ملفات الصور فقط (JPG، HEIC، PNG، …)." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "الحجم الأقصى للصورة قبل المعالجة 20 ميجابايت." };
  }

  let uploadFile = file;
  let exif: EvidencePhotoExif = {};
  try {
    const processed = await processEvidencePhoto(file);
    uploadFile = processed.file;
    exif = processed.exif;
    const stamp = stampFromContext(options, exif);
    if (stamp) {
      uploadFile = await burnInspectorPhotoStamp(uploadFile, stamp);
    }
  } catch (err) {
    console.warn("Evidence photo processing failed", err);
    return {
      ok: false,
      error: "تعذّر معالجة الصورة قبل الرفع. حاول بصيغة JPG.",
    };
  }

  if (uploadFile.size > 1024 * 1024) {
    return { ok: false, error: "تعذّر ضغط الصورة إلى أقل من 1 ميجابايت." };
  }

  const attachment: InspectorPhotoAttachment = {
    fileName: uploadFile.name,
    mimeType: "image/jpeg",
    sizeBytes: uploadFile.size,
  };

  try {
    const dataUrl = await blobToDataUrl(uploadFile);
    setInspectorPhotoDataUrl(taskId, photoRef, dataUrl);
  } catch {
    /* preview optional */
  }

  const bytes = await uploadFile.arrayBuffer();
  const photoMetadata = {
    latitude: exif.latitude ?? null,
    longitude: exif.longitude ?? null,
    capturedAtUtc: exif.capturedAt ?? null,
    propertyLatitude: parseCoord(options?.draft?.mapLatitude),
    propertyLongitude: parseCoord(options?.draft?.mapLongitude),
  };
  try {
    const uploaded = await uploadAttachmentWithOfflineFallback({
      scope: SCOPE,
      scopeKey: `${taskId}:${photoRef}`,
      fileName: uploadFile.name,
      contentType: attachment.mimeType,
      bytes,
      onlineUpload: async () => {
        const data = await uploadInspectorPhotoOnline(
          taskId,
          photoRef,
          uploadFile,
          photoMetadata,
        );
        attachment.locationFlag = data.photoMetadata?.flag ?? null;
        attachment.distanceM = data.photoMetadata?.distanceM ?? null;
        return data.id;
      },
    });
    attachment.attachmentId = uploaded.attachmentId;
    if (uploaded.attachmentId.startsWith("local:") && !attachment.locationFlag) {
      const { evaluatePhotoLocation } = await import(
        "@platform/app-shared/media/photo-location"
      );
      const evaluated = evaluatePhotoLocation({
        photoLatitude: photoMetadata.latitude,
        photoLongitude: photoMetadata.longitude,
        propertyLatitude: photoMetadata.propertyLatitude,
        propertyLongitude: photoMetadata.propertyLongitude,
      });
      attachment.locationFlag = evaluated.flag;
      attachment.distanceM = evaluated.distanceM;
    }
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "تعذّر رفع الصورة — تحقق من الاتصال وحاول مجدداً.",
    };
  }

  return { ok: true, attachment };
}

export function openInspectorPhotoPreview(dataUrl: string): void {
  window.open(dataUrl, "_blank", "noopener,noreferrer");
}
