/**
 * Client-side mirror of the server's document-governance checks, so the user hears about a
 * missing reason or an unsupported file before the upload round-trip. The server
 * (`PropertyDocumentUploadRules` / `AttachmentUploadRules`) stays authoritative.
 */

export const UNLISTED_LABEL_MIN_LENGTH = 2;
export const UNLISTED_LABEL_MAX_LENGTH = 128;
export const UNLISTED_REASON_MIN_LENGTH = 10;
export const UNLISTED_REASON_MAX_LENGTH = 512;

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_PDF_BYTES = 20 * 1024 * 1024;

/** Formats the attachments service accepts by content (no HEIC — it is rejected server-side). */
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif)$/i;

export function validateUnlistedDocumentFields(
  label: string,
  reason: string,
): string | null {
  const name = label.trim();
  const why = reason.trim();
  if (name.length < UNLISTED_LABEL_MIN_LENGTH) return "اكتب اسم المستند غير المعرّف";
  if (name.length > UNLISTED_LABEL_MAX_LENGTH) return "اسم المستند أطول من المسموح";
  if (why.length < UNLISTED_REASON_MIN_LENGTH) {
    return "اذكر سبب رفع مستند غير معرّف (10 أحرف على الأقل)";
  }
  if (why.length > UNLISTED_REASON_MAX_LENGTH) return "سبب رفع المستند أطول من المسموح";
  return null;
}

function isPdf(file: { name: string; type: string }): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function isSupportedImage(file: { name: string; type: string }): boolean {
  return IMAGE_TYPES.includes(file.type.toLowerCase()) || IMAGE_EXTENSIONS.test(file.name);
}

export function validatePropertyDocumentFile(
  file: { name: string; type: string; size: number },
  pdfOnly: boolean,
): string | null {
  if (file.size <= 0) return "الملف فارغ";
  if (isPdf(file)) {
    return file.size > MAX_PDF_BYTES ? "حجم ملف PDF يتجاوز 20 ميجابايت" : null;
  }
  if (pdfOnly) return "يُسمح بملفات PDF فقط لهذا النوع من المستندات";
  if (!isSupportedImage(file)) {
    return "يُسمح بملفات PDF أو صور JPG / PNG / WebP فقط";
  }
  return file.size > MAX_IMAGE_BYTES ? "حجم الصورة يتجاوز 8 ميجابايت" : null;
}

export function propertyDocumentFileAccept(pdfOnly: boolean): string {
  return pdfOnly
    ? "application/pdf,.pdf"
    : "application/pdf,.pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
}

export function contentTypeForUpload(file: { name: string; type: string }): string {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".gif")) return "image/gif";
  if (/\.jpe?g$/.test(name)) return "image/jpeg";
  return "application/octet-stream";
}
