/**
 * Photos the case staff add to a sent inspection from the work page's «صور التقرير» (Omar
 * 2026-11-12: «إتاحة إضافة الصور في المعاملة للأخصائي دارس الحالة»). They are free photos of the
 * inspection marked `uploadedBy: "specialist"`, so the report boards choose them like the inspector's.
 * Pure: no React, no I/O.
 */
import {
  INSPECTOR_FREE_PHOTO_CATEGORY_OTHER,
  inspectorFreePhotoUploader,
  type InspectorFreePhoto,
  type InspectorWorkspaceDraft,
} from "@platform/app-shared/app-data/inspector-workspace-data";
import type { InspectorPhotoAttachment } from "@platform/app-shared/app-data/inspector-workspace-data";

/** Why photos cannot be added to this inspection now, or null when they can. */
export function staffPhotoAddRefusal(
  draft: Pick<InspectorWorkspaceDraft, "status"> | null | undefined,
): string | null {
  if (!draft) return "لا توجد معاينة لهذا الصك بعد — تُضاف الصور بعد إرسال المعاين معاينته.";
  // A draft or a returned inspection is on the inspector's device: his next save would drop the photo.
  if (draft.status !== "submitted") {
    return "المعاينة لدى المعاين الآن — تُضاف الصور بعد إرساله لها.";
  }
  return null;
}

/**
 * The free photo an uploaded file becomes.
 *
 * How it works: marked as the staff's, with who added it and when; its category is «أخرى» so the
 * inspection's own rules ask nothing more of it (no outside / inside bucket, no kind to choose).
 * Edge cases: a blank name is left out — the photo then reads «من الأخصائي» alone.
 */
export function staffAddedPhoto(input: {
  id: number;
  attachment: InspectorPhotoAttachment;
  addedByName: string | null | undefined;
  nowIso: string;
}): InspectorFreePhoto {
  const name = input.addedByName?.trim();
  return {
    id: input.id,
    category: INSPECTOR_FREE_PHOTO_CATEGORY_OTHER,
    approved: true,
    uploadedBy: "specialist",
    ...(name ? { uploadedByName: name } : {}),
    uploadedAtUtc: input.nowIso,
    ...input.attachment,
  };
}

/**
 * The inspection's free photos without one the staff added.
 *
 * Edge cases: the inspector's photos are never removed here — an id that is his (or unknown) leaves
 * the list as it is.
 */
export function withoutStaffPhoto(photos: readonly InspectorFreePhoto[], id: number): InspectorFreePhoto[] {
  return photos.filter(
    (photo) => !(photo.id === id && inspectorFreePhotoUploader(photo) === "specialist"),
  );
}
