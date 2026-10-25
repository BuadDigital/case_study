/** `accept` for pickers that take a PDF or any image (HEIC included). */
export const PDF_OR_IMAGE_ACCEPT =
  "application/pdf,image/*,.pdf,.png,.jpg,.jpeg,.webp,.heic,.heif";

/** A PDF or an image, by MIME type or — when the browser gives none — by extension. */
export function isPdfOrImageFile(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  if (type === "application/pdf" || type.startsWith("image/")) return true;
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".pdf") ||
    name.endsWith(".png") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".webp") ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
}
