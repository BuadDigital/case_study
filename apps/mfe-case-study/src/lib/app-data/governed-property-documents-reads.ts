import {
  listAttachmentsForProperty,
  type FileAttachmentMetaDto,
} from "@platform/api-client";
import { prototypeModulesApiConfig } from "@platform/app-shared/app-data/modules-api-config";
import type { PropertyDetailDocumentEntry } from "@platform/app-shared/app-data/property-detail-document-types";
import {
  PROPERTY_DOCUMENT_GOVERNED_SCOPE,
  UNLISTED_DOCUMENT_KEY,
  VALUED_DOCUMENT_KEY,
  VALUED_DOCUMENT_SCOPE,
  resolvePropertyDocumentType,
} from "@platform/app-shared/domain/property-documents/property-document-types";

/** Source label of rows uploaded from the documents tab itself. */
const GOVERNED_DOCUMENTS_SOURCE = "مستندات العقار";

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
  const isValued = type?.key === VALUED_DOCUMENT_KEY;
  const customLabel = meta.customDocumentLabel?.trim() ?? "";
  return {
    id: `governed-${meta.id}`,
    name:
      isUnlisted || isValued
        ? customLabel || type.labelAr
        : (type?.labelAr ?? "مستند"),
    fileName: meta.fileName,
    source:
      meta.scope === PROPERTY_DOCUMENT_GOVERNED_SCOPE
        ? GOVERNED_DOCUMENTS_SOURCE
        : meta.scope === VALUED_DOCUMENT_SCOPE
          ? "مرفوع من أطراف الدراسة"
          : "البيانات الأولية",
    kind: kindOf(meta),
    attachmentId: meta.id,
    documentTypeKey: type?.key,
    // A row the tab reclassified keeps its intake scope but now carries a listed type; it
    // must win over the per-field «unlisted» copy, so it counts as governed from here on.
    governed:
      meta.scope === PROPERTY_DOCUMENT_GOVERNED_SCOPE ||
      (meta.scope === OTHER_DOCUMENTS_SCOPE && !isUnlisted && !isValued),
    unlisted: isUnlisted
      ? {
          customLabel,
          customReason: meta.customDocumentReason?.trim() ?? "",
        }
      : undefined,
    valued: isValued
      ? {
          customLabel,
          status: meta.valueDocStatus ?? "pending",
          reviewNote: meta.valueDocReviewNote?.trim() ?? "",
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
          meta.scope === OTHER_DOCUMENTS_SCOPE ||
          meta.scope === VALUED_DOCUMENT_SCOPE),
    )
    .map(governedEntryFromMeta);
}

/** The scopes that keep the transaction's outputs, one file per version (Omar 2026-11-18). */
const OUTPUT_SCOPES: Readonly<Record<string, string>> = {
  "case-study-report": "تقرير دراسة الحالة",
  "evaluator-report": "تقرير التقييم",
  "evaluator-deposit-certificate": "شهادة الإيداع",
};

/** A kept output file: its version, and whether a newer version of the same output exists. */
export type OutputVersionEntry = PropertyDetailDocumentEntry & { version: number; superseded: boolean };

/**
 * The deed's kept outputs — the case-study report as delivered, the final valuation report and the deposit
 * certificate — every version, newest first per output; older ones are marked superseded.
 *
 * How it works: keeps the rows of the three output scopes whose key starts with the deed id and ends
 * with «:v{n}», names them «{output} — النسخة n», and marks every version below the newest of its output.
 * Edge cases: a key without «:v{n}» counts as version 1; other scopes are ignored. Pure.
 */
export function outputVersionEntries(
  propertyId: string,
  metas: readonly FileAttachmentMetaDto[],
): OutputVersionEntry[] {
  const rows = metas
    .filter((m) => m.scope in OUTPUT_SCOPES && m.scopeKey.startsWith(`${propertyId}:`))
    .map((m) => ({ meta: m, version: Number(/:v(\d+)$/.exec(m.scopeKey)?.[1] ?? "1") }));
  const newest = new Map<string, number>();
  for (const r of rows) newest.set(r.meta.scope, Math.max(newest.get(r.meta.scope) ?? 0, r.version));
  return rows
    .sort((a, b) =>
      a.meta.scope === b.meta.scope ? b.version - a.version : a.meta.scope.localeCompare(b.meta.scope),
    )
    .map(({ meta, version }) => ({
      ...governedEntryFromMeta(meta),
      name: `${OUTPUT_SCOPES[meta.scope]} — النسخة ${version}`,
      source: "مخرجات المعاملة",
      version,
      superseded: version < (newest.get(meta.scope) ?? version),
    }));
}

/** The deed's kept outputs, every version (see `outputVersionEntries`). */
export async function fetchPropertyOutputVersions(propertyId: string): Promise<OutputVersionEntry[]> {
  const config = prototypeModulesApiConfig();
  if (!config || !propertyId.trim()) return [];
  const listed = await listAttachmentsForProperty(config, propertyId);
  if (!listed.ok) throw new Error("تعذّر تحميل مخرجات المعاملة");
  return outputVersionEntries(propertyId, listed.data);
}
