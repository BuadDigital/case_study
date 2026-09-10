import {
  listAttachmentsForProperty,
  type FileAttachmentMetaDto,
} from "@platform/api-client";
import { prototypeModulesApiConfig } from "@platform/app-shared/app-data/modules-api-config";
import type { PropertyDetailDocumentEntry } from "@platform/app-shared/app-data/property-detail-document-types";
import {
  PROPERTY_DOCUMENT_GOVERNED_SCOPE,
  UNLISTED_DOCUMENT_KEY,
  resolvePropertyDocumentType,
} from "@platform/app-shared/domain/property-documents/property-document-types";

/** Source label of rows uploaded from the documents tab itself. */
export const GOVERNED_DOCUMENTS_SOURCE = "مستندات العقار";

/** The intake «other documents» field — unlisted documents that can be re-typed from the tab. */
const OTHER_DOCUMENTS_SCOPE = "property-other";

export function governedDocumentsScopeKey(poNumber: string, propertyId: string): string {
  return `${poNumber.trim()}:${propertyId.trim()}`;
}

function kindOf(meta: FileAttachmentMetaDto): PropertyDetailDocumentEntry["kind"] {
  if (meta.contentType.startsWith("image/")) return "image";
  if (meta.contentType === "application/pdf" || /\.pdf$/i.test(meta.fileName)) return "pdf";
  return "file";
}

/** One governed attachment row as a documents-tab entry, with its type and review state. */
export function governedEntryFromMeta(
  meta: FileAttachmentMetaDto,
): PropertyDetailDocumentEntry {
  const type = resolvePropertyDocumentType(meta.documentTypeKey, meta.scope, meta.scopeKey);
  const isUnlisted = type?.key === UNLISTED_DOCUMENT_KEY;
  const customLabel = meta.customDocumentLabel?.trim() ?? "";
  return {
    id: `governed-${meta.id}`,
    name: isUnlisted ? customLabel || type.labelAr : (type?.labelAr ?? "مستند"),
    fileName: meta.fileName,
    source:
      meta.scope === PROPERTY_DOCUMENT_GOVERNED_SCOPE
        ? GOVERNED_DOCUMENTS_SOURCE
        : "البيانات الأولية",
    kind: kindOf(meta),
    attachmentId: meta.id,
    documentTypeKey: type?.key,
    governed: meta.scope === PROPERTY_DOCUMENT_GOVERNED_SCOPE,
    unlisted: isUnlisted
      ? {
          customLabel,
          customReason: meta.customDocumentReason?.trim() ?? "",
          reviewStatus: meta.reviewStatus ?? "pending",
          reviewNote: meta.reviewNote ?? null,
        }
      : undefined,
  };
}

/**
 * Documents-tab uploads and «other documents» rows of one property. Other per-field intake
 * documents keep their own path (`assignment-doc-attachments`).
 */
export async function fetchGovernedPropertyDocuments(
  poNumber: string,
  propertyId: string,
): Promise<PropertyDetailDocumentEntry[]> {
  const config = prototypeModulesApiConfig();
  if (!config || !poNumber.trim() || !propertyId.trim()) return [];

  const scopeKey = governedDocumentsScopeKey(poNumber, propertyId);
  const listed = await listAttachmentsForProperty(config, scopeKey);
  if (!listed.ok) throw new Error("تعذّر تحميل مستندات العقار");

  return listed.data
    .filter(
      (meta) =>
        meta.scopeKey === scopeKey &&
        (meta.scope === PROPERTY_DOCUMENT_GOVERNED_SCOPE ||
          meta.scope === OTHER_DOCUMENTS_SCOPE),
    )
    .map(governedEntryFromMeta);
}
