/**
 * Upload of a «مستند ذو قيمة» from any party screen (specialist, appraiser, inspector,
 * engineering office): the file and the name its uploader gives it, keyed «PO:propertyId» like
 * the documents tab so the case specialist reviews it there. After upload only the specialist,
 * the appraiser and the CDO can see it — the server enforces that.
 */
import { uploadAttachment } from "@platform/api-client";
import { freshPrototypeModulesApiConfig } from "../../app-data/modules-api-config";
import { fileToBase64 } from "../../media/file-encoding";
import { VALUED_DOCUMENT_KEY, VALUED_DOCUMENT_SCOPE } from "./property-document-types";

export const VALUED_DOCUMENT_NAME_MAX_LENGTH = 128;

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_PDF_BYTES = 20 * 1024 * 1024;
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif)$/i;

export const VALUED_DOCUMENT_FILE_ACCEPT =
  "application/pdf,.pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

export type ValuedDocumentUploadResult = { ok: true } | { ok: false; error: string };

export function validateValuedDocumentUpload(
  name: string,
  file: { name: string; type: string; size: number } | null,
): string | null {
  const label = name.trim();
  if (label.length < 2) return "اكتب اسم المستند ذي القيمة";
  if (label.length > VALUED_DOCUMENT_NAME_MAX_LENGTH) return "اسم المستند أطول من المسموح";
  if (!file) return "اختر ملف المستند";
  if (file.size <= 0) return "الملف فارغ";
  const pdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (pdf) return file.size > MAX_PDF_BYTES ? "حجم ملف PDF يتجاوز 20 ميجابايت" : null;
  if (!file.type.startsWith("image/") && !IMAGE_EXTENSIONS.test(file.name)) {
    return "يُسمح بملفات PDF أو صور JPG / PNG / WebP فقط";
  }
  return file.size > MAX_IMAGE_BYTES ? "حجم الصورة يتجاوز 8 ميجابايت" : null;
}

export async function uploadValuedDocument(input: {
  poNumber: string;
  propertyId: string;
  name: string;
  file: File;
}): Promise<ValuedDocumentUploadResult> {
  if (!input.poNumber.trim() || !input.propertyId.trim()) {
    return { ok: false, error: "بيانات العقار ناقصة." };
  }
  const problem = validateValuedDocumentUpload(input.name, input.file);
  if (problem) return { ok: false, error: problem };

  const config = await freshPrototypeModulesApiConfig();
  if (!config) return { ok: false, error: "انتهت الجلسة — سجّل الدخول مجدداً" };

  const result = await uploadAttachment(config, {
    scope: VALUED_DOCUMENT_SCOPE,
    scopeKey: `${input.poNumber.trim()}:${input.propertyId.trim()}`,
    fileName: input.file.name,
    contentType: input.file.type || "application/octet-stream",
    contentBase64: await fileToBase64(input.file),
    documentTypeKey: VALUED_DOCUMENT_KEY,
    customDocumentLabel: input.name.trim(),
  });
  if (result.ok) return { ok: true };
  if (result.message) return { ok: false, error: result.message };
  if (result.kind === "forbidden") return { ok: false, error: "لا تملك صلاحية رفع مستند ذي قيمة" };
  if (result.kind === "network") return { ok: false, error: "تعذّر الاتصال بالخادم — حاول مجدداً" };
  return { ok: false, error: "تعذّر رفع المستند — حاول مجدداً" };
}
