import { processEvidencePhoto } from "./process-evidence-photo";

const MAX_IMAGE_INPUT_BYTES = 20 * 1024 * 1024;
const MAX_PROCESSED_IMAGE_BYTES = 1024 * 1024;

/** EXIF location/time sent with an evidence photo upload. */
export type EvidencePhotoMetadata = {
  latitude: number | null;
  longitude: number | null;
  capturedAtUtc: string | null;
};

export type PreparedEvidencePhoto =
  | { ok: true; file: File; photoMetadata: EvidencePhotoMetadata }
  | { ok: false; error: string };

/**
 * Evidence photo before upload: refuse over 20 MB, run the EXIF → JPEG → compress pipeline,
 * and refuse when it is still over 1 MB. Shared by the keys envelope and the keys-proof deed doc.
 */
export async function prepareEvidencePhotoUpload(
  file: File,
): Promise<PreparedEvidencePhoto> {
  if (file.size > MAX_IMAGE_INPUT_BYTES) {
    return {
      ok: false,
      error: "الحجم الأقصى للصورة قبل المعالجة 20 ميجابايت.",
    };
  }
  let processed: Awaited<ReturnType<typeof processEvidencePhoto>>;
  try {
    processed = await processEvidencePhoto(file);
  } catch {
    return {
      ok: false,
      error: "تعذّر معالجة الصورة قبل الرفع. حاول بصيغة JPG.",
    };
  }
  if (processed.file.size > MAX_PROCESSED_IMAGE_BYTES) {
    return {
      ok: false,
      error: "تعذّر ضغط الصورة إلى أقل من 1 ميجابايت.",
    };
  }
  return {
    ok: true,
    file: processed.file,
    photoMetadata: {
      latitude: processed.exif.latitude ?? null,
      longitude: processed.exif.longitude ?? null,
      capturedAtUtc: processed.exif.capturedAt ?? null,
    },
  };
}
