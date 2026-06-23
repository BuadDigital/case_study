import type { GovernmentReviewKeysProofFile } from "./government-review-work-data";

export const GOVERNMENT_REVIEW_KEYS_PROOF_ACCEPT =
  "image/*,application/pdf";

export const GOVERNMENT_REVIEW_KEYS_PROOF_MAX_BYTES = 8 * 1024 * 1024;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
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

export async function fileToGovernmentReviewKeysProof(
  file: File,
): Promise<GovernmentReviewKeysProofFile> {
  if (!isGovernmentReviewKeysProofMime(file.type)) {
    throw new Error("نوع الملف غير مدعوم — ارفع صورة أو PDF");
  }
  if (file.size > GOVERNMENT_REVIEW_KEYS_PROOF_MAX_BYTES) {
    throw new Error("حجم الملف يتجاوز 8 ميجابايت");
  }
  return {
    id: createGovernmentReviewKeysProofId(),
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    dataUrl: await readAsDataUrl(file),
  };
}
