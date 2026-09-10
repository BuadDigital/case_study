import {
  deleteAttachment,
  reviewAttachmentDocument,
  setAttachmentDocumentType,
  uploadAttachment,
  type PrototypeModulesResult,
} from "@platform/api-client";
import { freshPrototypeModulesApiConfig } from "@platform/app-shared/app-data/modules-api-config";
import { fileToBase64 } from "@platform/app-shared/media/file-encoding";
import {
  PROPERTY_DOCUMENT_GOVERNED_SCOPE,
  UNLISTED_DOCUMENT_KEY,
  findPropertyDocumentType,
} from "@platform/app-shared/domain/property-documents/property-document-types";
import { governedDocumentsScopeKey } from "./governed-property-documents-reads";
import {
  contentTypeForUpload,
  validatePropertyDocumentFile,
  validateUnlistedDocumentFields,
} from "./property-document-upload-rules";

export type GovernedDocumentCommandResult = { ok: true } | { ok: false; error: string };

export type GovernedDocumentTypeInput = {
  documentTypeKey: string;
  customLabel?: string;
  customReason?: string;
};

function failure(result: PrototypeModulesResult<unknown>, fallback: string): GovernedDocumentCommandResult {
  if (result.ok) return { ok: true };
  if (result.message) return { ok: false, error: result.message };
  if (result.kind === "forbidden") return { ok: false, error: "لا تملك صلاحية هذا الإجراء" };
  if (result.kind === "network") {
    return { ok: false, error: "تعذّر الاتصال بالخادم — حاول مجدداً" };
  }
  return { ok: false, error: fallback };
}

/** Type + optional name/reason checks shared by upload and re-typing. */
function checkTypeInput(input: GovernedDocumentTypeInput): string | null {
  const type = findPropertyDocumentType(input.documentTypeKey);
  if (!type) return "اختر نوع المستند من القائمة";
  if (!type.uploadableFromTab) return `«${type.labelAr}» يُرفع من شاشة الجهة المختصة`;
  if (type.key === UNLISTED_DOCUMENT_KEY) {
    return validateUnlistedDocumentFields(input.customLabel ?? "", input.customReason ?? "");
  }
  return null;
}

function unlistedFields(input: GovernedDocumentTypeInput) {
  return input.documentTypeKey === UNLISTED_DOCUMENT_KEY
    ? {
        customDocumentLabel: input.customLabel?.trim() ?? "",
        customDocumentReason: input.customReason?.trim() ?? "",
      }
    : { customDocumentLabel: null, customDocumentReason: null };
}

export async function uploadGovernedPropertyDocument(
  input: GovernedDocumentTypeInput & {
    poNumber: string;
    propertyId: string;
    file: File;
  },
): Promise<GovernedDocumentCommandResult> {
  if (!input.poNumber.trim() || !input.propertyId.trim()) {
    return { ok: false, error: "بيانات العقار ناقصة." };
  }
  const typeError = checkTypeInput(input);
  if (typeError) return { ok: false, error: typeError };
  const type = findPropertyDocumentType(input.documentTypeKey)!;
  const fileError = validatePropertyDocumentFile(input.file, type.pdfOnly);
  if (fileError) return { ok: false, error: fileError };

  const config = await freshPrototypeModulesApiConfig();
  if (!config) return { ok: false, error: "انتهت الجلسة — سجّل الدخول مجدداً" };

  const result = await uploadAttachment(config, {
    scope: PROPERTY_DOCUMENT_GOVERNED_SCOPE,
    scopeKey: governedDocumentsScopeKey(input.poNumber, input.propertyId),
    fileName: input.file.name,
    contentType: contentTypeForUpload(input.file),
    contentBase64: await fileToBase64(input.file),
    documentTypeKey: type.key,
    ...unlistedFields(input),
  });
  return failure(result, "تعذّر رفع المستند — حاول مجدداً");
}

export async function reclassifyGovernedPropertyDocument(
  attachmentId: string,
  input: GovernedDocumentTypeInput,
): Promise<GovernedDocumentCommandResult> {
  const typeError = checkTypeInput(input);
  if (typeError) return { ok: false, error: typeError };
  const config = await freshPrototypeModulesApiConfig();
  if (!config) return { ok: false, error: "انتهت الجلسة — سجّل الدخول مجدداً" };

  const result = await setAttachmentDocumentType(config, attachmentId, {
    documentTypeKey: input.documentTypeKey,
    ...unlistedFields(input),
  });
  return failure(result, "تعذّر تصنيف المستند — حاول مجدداً");
}

export async function reviewUnlistedPropertyDocument(
  attachmentId: string,
  decision: "approved" | "rejected",
  note?: string,
): Promise<GovernedDocumentCommandResult> {
  if (decision === "rejected" && !note?.trim()) {
    return { ok: false, error: "اكتب سبب رفض المستند" };
  }
  const config = await freshPrototypeModulesApiConfig();
  if (!config) return { ok: false, error: "انتهت الجلسة — سجّل الدخول مجدداً" };

  const result = await reviewAttachmentDocument(config, attachmentId, {
    decision,
    note: note?.trim() || null,
  });
  return failure(result, "تعذّر حفظ قرار المراجعة — حاول مجدداً");
}

export async function deleteGovernedPropertyDocument(
  attachmentId: string,
): Promise<GovernedDocumentCommandResult> {
  const config = await freshPrototypeModulesApiConfig();
  if (!config) return { ok: false, error: "انتهت الجلسة — سجّل الدخول مجدداً" };
  const result = await deleteAttachment(config, attachmentId);
  return failure(result, "تعذّر حذف المستند — حاول مجدداً");
}
