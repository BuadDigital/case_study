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
const COPY_PREVIEW_LENGTH = 34;

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

/**
 * Whether a document has a file that can be downloaded.
 *
 * How it works: a stored file (`attachmentId`) is fetched from the server on download; otherwise the bytes
 * must already be in `dataUrl` (the generated final valuation report).
 *
 * Edge cases and how they were fixed: the panel used to accept `dataUrl` only. Files hydrated from the server
 * carry their id but a `dataUrl` only when this browser had built a preview, so the deed of a transaction showed
 * «غير متوفر» on every other device. A PDF's `dataUrl` is also just a picture of its first page — downloading it
 * gave an image, not the deed — which is why the id wins whenever there is one.
 */
export function documentHasFile(
  doc: Pick<PropertyDetailDocumentEntry, "attachmentId" | "dataUrl"> | null | undefined,
): boolean {
  return Boolean(doc?.attachmentId?.trim() || doc?.dataUrl);
}

/** A row can be downloaded once the model marked it ready (a file, or the issued case-study report). */
export function attachmentReady(item: Pick<InfathUploadAttachment, "status">): boolean {
  return item.status === "ready";
}

/**
 * The badge text of an attachment row.
 *
 * How it works: ready → «جاهز»; a file the transaction does not have at all → its own note (e.g. «لا يوجد رفع
 * مساحي»); a file needed only in some cases → «عند الحاجة»; otherwise «غير متوفر».
 *
 * Edge cases: a transaction with no survey task used to read «عند الحاجة», which left the specialist unsure
 * whether a survey file was still owed; it now says plainly that there is no survey.
 */
export function attachmentStatusLabel(
  item: Pick<InfathUploadAttachment, "status" | "conditional" | "statusNote">,
): string {
  if (item.status === "ready") return "جاهز";
  if (item.status === "not-needed") return item.statusNote?.trim() || "غير مطلوب";
  return item.conditional ? "عند الحاجة" : "غير متوفر";
}

export function readyAttachments<T extends Pick<InfathUploadAttachment, "status">>(
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

type InfathFieldAction = "download" | "copy" | null;

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

/**
 * How long the copy button shows its check after a copy (Omar, 2026-10-20: a check
 * that never went away read as a stuck state). The row's tint stays as the
 * «already moved to Infath» marker; only the button's check is transient.
 */
export const COPIED_FLASH_MS = 2000;

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

type CourtVisitLike = {
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

