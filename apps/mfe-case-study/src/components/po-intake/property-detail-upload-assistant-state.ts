/**
 * Pure rules behind `PropertyDetailEnfathUpload`: attachment icon / status
 * mapping, which action a copy field offers, copy-key naming, the collapse
 * sets, document lookup by name, and the ops-context inputs.
 * No React, no clipboard, no storage.
 */
import type {
  InfathUploadAttachment,
  InfathUploadField,
  InfathUploadSection,
} from "../../lib/app-data/infath-upload-types";
import type {
  PropertyDetailDocumentEntry,
  PropertyDetailDocumentSection,
} from "../../lib/app-data/property-detail-documents";

export type InfazIconName =
  | "copy"
  | "check"
  | "download"
  | "chevron"
  | "paperclip"
  | "expand"
  | "collapse"
  | "file"
  | "appraisal"
  | "map"
  | "photo"
  | "plan"
  | "deed"
  | "key";

export type CopyKey = string;

export const INFATH_EMPTY_VALUE = "— غير مُدخل —";

/** Max characters of the copied text echoed in the toast. */
export const COPY_PREVIEW_LENGTH = 34;

/* ------------------------------------------------------------------ */
/* Attachments                                                         */
/* ------------------------------------------------------------------ */

export function attachmentIcon(item: Pick<InfathUploadAttachment, "id">): InfazIconName {
  switch (item.id) {
    case "case-study":
      return "file";
    case "appraisal":
      return "appraisal";
    case "survey":
      return "map";
    case "interior-photos":
    case "exterior-photos":
      return "photo";
    case "plan":
      return "plan";
    case "deed":
      return "deed";
    case "keys-proof":
      return "key";
    default:
      return "file";
  }
}

/** An attachment can be downloaded once its document carries bytes. */
export function attachmentReady(item: Pick<InfathUploadAttachment, "document">): boolean {
  return Boolean(item.document?.dataUrl);
}

export function attachmentStatusLabel(ready: boolean, conditional?: boolean): string {
  return ready ? "جاهز" : conditional ? "عند الحاجة" : "غير متوفر";
}

export function readyAttachments<T extends Pick<InfathUploadAttachment, "document">>(
  attachments: readonly T[],
): T[] {
  return attachments.filter((a) => attachmentReady(a));
}

/**
 * The document behind a file-type field: the upload attachments first, then
 * every listed document section, matched by stored or display name.
 */
export function findInfathDocumentByName(
  attachments: readonly Pick<InfathUploadAttachment, "document">[],
  documentSections: readonly PropertyDetailDocumentSection[],
  fileName: string,
): PropertyDetailDocumentEntry | undefined {
  const matches = (d: PropertyDetailDocumentEntry) =>
    d.fileName === fileName || d.name === fileName;
  return (
    attachments
      .map((a) => a.document)
      .find((d): d is PropertyDetailDocumentEntry => Boolean(d && matches(d))) ??
    documentSections.flatMap((s) => s.documents).find(matches)
  );
}

/* ------------------------------------------------------------------ */
/* Fields                                                              */
/* ------------------------------------------------------------------ */

export function infathFieldHasValue(value: string | null | undefined): boolean {
  return Boolean(value?.trim()) && value !== "—";
}

export type InfathFieldAction = "download" | "copy" | null;

/**
 * Which button a field row offers: file fields download, free-text fields
 * copy, and select / auto / reference fields offer nothing.
 */
export function infathFieldAction(
  field: Pick<InfathUploadField, "type" | "value">,
): InfathFieldAction {
  if (!infathFieldHasValue(field.value)) return null;
  if (field.type === "file") return "download";
  if (field.type === "sel" || field.type === "auto" || field.type === "ref") return null;
  return "copy";
}

export function fieldCopyKey(sectionId: string, fieldId: string): CopyKey {
  return `f:${sectionId}:${fieldId}`;
}

export function areaCopyKey(sectionId: string, fieldId: string): CopyKey {
  return `a:${sectionId}:${fieldId}`;
}

export function copyToastPreview(text: string): string {
  return text.length > COPY_PREVIEW_LENGTH
    ? `${text.slice(0, COPY_PREVIEW_LENGTH)}…`
    : text;
}

/* ------------------------------------------------------------------ */
/* Section collapse / copied sets                                      */
/* ------------------------------------------------------------------ */

/**
 * Sections collapsed after «expand all» (conditional ones stay folded) or
 * «collapse all» (every unconditional section folds; conditional ones open).
 */
export function collapsedSectionIds(
  sections: readonly Pick<InfathUploadSection, "id" | "conditional">[],
  collapse: boolean,
): Set<string> {
  return new Set(
    sections
      .filter((section) => (collapse ? !section.conditional : Boolean(section.conditional)))
      .map((section) => section.id),
  );
}

/** Initial collapse state — conditional sections start folded. */
export function initialCollapsedSectionIds(
  sections: readonly Pick<InfathUploadSection, "id" | "conditional">[],
): Set<string> {
  return collapsedSectionIds(sections, false);
}

export function toggledSet(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Adds a key; returns the same set instance when it is already present. */
export function withCopiedKey<S extends Set<CopyKey>>(set: S, key: CopyKey): S | Set<CopyKey> {
  if (set.has(key)) return set;
  const next = new Set(set);
  next.add(key);
  return next;
}

/* ------------------------------------------------------------------ */
/* Ops context inputs                                                  */
/* ------------------------------------------------------------------ */

export type CourtVisitLike = {
  status?: string | null;
  updatedAt?: string | null;
  courtVisitResult?: { kind?: string | null } | null;
  assigneeName?: string | null;
};

export function courtVisitOpsFields(visit: CourtVisitLike | null | undefined): {
  courtVisitCompletedAt: string | null;
  courtVisitResultKind: string | null;
  courtVisitAssigneeName: string | null;
} {
  return {
    courtVisitCompletedAt:
      visit?.status === "completed" ? (visit.updatedAt ?? null) : null,
    courtVisitResultKind: visit?.courtVisitResult?.kind ?? null,
    courtVisitAssigneeName: visit?.assigneeName ?? null,
  };
}

/** The appraisal submission's field value by label, or `undefined` when absent. */
export function appraisalFieldValue(
  fields: readonly { label: string; value: string }[] | null | undefined,
  label: string,
): string | undefined {
  return fields?.find((f) => f.label === label)?.value;
}

export const DEPOSIT_CODE_FIELD_LABEL = "رمز إيداع التقرير";
export const DEPOSIT_CERTIFICATE_FIELD_LABEL = "شهادة الإيداع";
