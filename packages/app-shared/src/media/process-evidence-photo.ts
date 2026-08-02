import exifr from "exifr";

export type EvidencePhotoExif = {
  latitude?: number | null;
  longitude?: number | null;
  capturedAt?: string | null;
};

export type ProcessedEvidencePhoto = {
  file: File;
  exif: EvidencePhotoExif;
};

const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.8;
const MAX_BYTES = 1024 * 1024;

function isHeic(file: File): boolean {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    type === "image/heic" ||
    type === "image/heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
}

/** EXIF must be read from the original bytes before any transform (هـ). */
export async function extractEvidenceExif(file: File): Promise<EvidencePhotoExif> {
  try {
    const tags = await exifr.parse(file, {
      gps: true,
      pick: ["DateTimeOriginal", "CreateDate", "ModifyDate"],
    });
    if (!tags) return {};

    const lat =
      typeof tags.latitude === "number" && Number.isFinite(tags.latitude)
        ? tags.latitude
        : null;
    const lng =
      typeof tags.longitude === "number" && Number.isFinite(tags.longitude)
        ? tags.longitude
        : null;
    const rawDate =
      tags.DateTimeOriginal ?? tags.CreateDate ?? tags.ModifyDate ?? null;
    const capturedAt =
      rawDate instanceof Date && !Number.isNaN(rawDate.getTime())
        ? rawDate.toISOString()
        : null;

    return { latitude: lat, longitude: lng, capturedAt };
  } catch {
    return {};
  }
}

async function convertHeicToJpeg(file: File): Promise<File> {
  if (typeof window === "undefined") return file;
  const heic2any = (await import("heic2any")).default;
  const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  const blob = Array.isArray(result) ? result[0]! : result;
  const name = file.name.replace(/\.(heic|heif)$/i, ".jpg");
  return new File([blob], name.endsWith(".jpg") ? name : `${name}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("تعذّر تحميل الصورة للضغط"));
    img.src = src;
  });
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
  });
  if (!blob) throw new Error("تعذّر ضغط الصورة.");
  return blob;
}

/** Resize longest edge to 1600px, JPEG 80%, then drop quality until ≤ 1 MB. */
export async function compressEvidenceImage(file: File): Promise<File> {
  if (typeof document === "undefined") return file;

  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  if (srcW <= 0 || srcH <= 0) return file;

  const scale = Math.min(1, MAX_EDGE_PX / Math.max(srcW, srcH));
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, width, height);

  let quality = JPEG_QUALITY;
  let blob = await canvasToJpegBlob(canvas, quality);
  while (blob.size > MAX_BYTES && quality > 0.45) {
    quality -= 0.08;
    blob = await canvasToJpegBlob(canvas, quality);
  }

  const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

/**
 * Spec order: EXIF → HEIC→JPEG → compress 1600/80%/1MB.
 * Stamp is applied by the caller after this returns.
 */
export async function processEvidencePhoto(
  file: File,
): Promise<ProcessedEvidencePhoto> {
  const exif = await extractEvidenceExif(file);
  let working = file;
  if (isHeic(working)) {
    working = await convertHeicToJpeg(working);
  }
  working = await compressEvidenceImage(working);
  return { file: working, exif };
}

export function buildEvidenceStampLines(input: {
  deedNumber?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  capturedAt?: string | null;
  fallbackDate?: string | null;
  fallbackTime?: string | null;
}): string {
  const deed = input.deedNumber?.trim() || "";
  const lat =
    typeof input.latitude === "number"
      ? input.latitude.toFixed(6)
      : String(input.latitude ?? "").trim();
  const lng =
    typeof input.longitude === "number"
      ? input.longitude.toFixed(6)
      : String(input.longitude ?? "").trim();

  let when = "";
  if (input.capturedAt) {
    const d = new Date(input.capturedAt);
    if (!Number.isNaN(d.getTime())) {
      when = d.toLocaleString("ar-SA", { hour12: false });
    }
  }
  if (!when) {
    when = [input.fallbackDate, input.fallbackTime].filter(Boolean).join(" ");
  }

  const lines = [
    deed ? `صك ${deed}` : "",
    lat && lng ? `${lat}, ${lng}` : "",
    when,
  ].filter(Boolean);
  return lines.join("\n");
}
