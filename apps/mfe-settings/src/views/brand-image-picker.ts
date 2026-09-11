/**
 * File picker for brand assets: reads the file, measures it and runs `brandImageError`
 * before the screen ever shows it, so an unusable image never reaches a draft.
 */

import {
  BRAND_IMAGE_ACCEPT,
  brandImageError,
  type BrandUploadTargetId,
} from "./brand-identity-state";

export type PickedBrandImage =
  | { ok: true; dataUrl: string; name: string; kb: number }
  | { ok: false; error: string };

function readFile(file: File, as: "dataUrl" | "text"): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("read"));
    reader.onerror = () => reject(reader.error ?? new Error("read"));
    if (as === "dataUrl") reader.readAsDataURL(file);
    else reader.readAsText(file);
  });
}

function measure(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = dataUrl;
  });
}

async function inspect(target: BrandUploadTargetId, file: File): Promise<PickedBrandImage> {
  try {
    const dataUrl = await readFile(file, "dataUrl");
    const svgText = file.type === "image/svg+xml" ? await readFile(file, "text") : null;
    const { width, height } = await measure(dataUrl);
    const error = brandImageError(target, {
      name: file.name,
      type: file.type,
      sizeBytes: file.size,
      width,
      height,
      svgText,
    });
    return error
      ? { ok: false, error }
      : { ok: true, dataUrl, name: file.name, kb: Math.round(file.size / 1024) };
  } catch {
    return { ok: false, error: "تعذّر قراءة الملف." };
  }
}

export function pickBrandImage(
  target: BrandUploadTargetId,
  onPicked: (result: PickedBrandImage) => void,
): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = BRAND_IMAGE_ACCEPT;
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    void inspect(target, file).then(onPicked);
  };
  input.click();
}
