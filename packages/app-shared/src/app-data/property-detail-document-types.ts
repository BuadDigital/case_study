import type { InspectorPhotoAttachment } from "./inspector-workspace-data";

/** One row in the property-detail documents / media lists. */
export type PropertyDetailDocumentEntry = {
  id: string;
  name: string;
  fileName: string;
  source: string;
  kind: "pdf" | "file" | "image";
  dataUrl?: string;
  attachmentId?: string;
  /** Engineering survey field — used to resolve blob via attachments API. */
  engineeringField?: "surveyReport" | "siteLetter";
  engineeringTaskId?: string;
  /**
   * Field-inspection source — lets a caller hydrate this one photo through
   * `prefetchInspectorPhoto` without the whole-workspace prefetch.
   */
  inspectionPhoto?: {
    taskId: string;
    photoRef: string;
    attachment: InspectorPhotoAttachment;
  };
  /** Governed registry key (`property-document-types.ts`) the row belongs to. */
  documentTypeKey?: string;
  /** The form names this file but the attachments service holds no copy of it. */
  fileMissing?: boolean;
  /** Uploaded from the documents tab itself (scope `property-document`) — deletable there. */
  governed?: boolean;
  /** Documents outside the defined list: the uploader's name + reason. */
  unlisted?: {
    customLabel: string;
    customReason: string;
  };
  /** «مستند ذو قيمة»: the uploader's name and the case specialist's decision. */
  valued?: {
    customLabel: string;
    status: "pending" | "approved" | "rejected";
    reviewNote: string;
  };
};

export type PropertyDetailDocumentSection = {
  id: string;
  title: string;
  documents: PropertyDetailDocumentEntry[];
};

/** The case specialist's marks on the inspector's photos, by attachment id. */
export type PropertyPhotoMarks = {
  main: string | null;
  electricity: string[];
  water: string[];
  /** The photos the report prints; empty = the first ones in the automatic order. */
  report: string[];
};

export type PropertyPhotoRole = "main" | "electricity" | "water";
export type PropertyPhotoMark = PropertyPhotoRole | "report";

export const EMPTY_PROPERTY_PHOTO_MARKS: PropertyPhotoMarks = {
  main: null,
  electricity: [],
  water: [],
  report: [],
};

/** The report's photo section has twelve slots. */
export const REPORT_PHOTO_LIMIT = 12;

export const MAIN_PHOTO_RE = /رئيس|main|primary/i;
export const EXTERIOR_PHOTO_RE = /خارج|واجهة|front|exterior|outside|\bsides?\b/i;
export const INTERIOR_PHOTO_RE = /داخل|interior|inside|floor|أرض/i;
export const ELECTRICITY_PHOTO_RE = /كهرب|elec|عداد/i;
export const WATER_PHOTO_RE = /خدمة: ماء|عداد ماء|water/i;
const FACADE_NAME_RE = /واجهة/;
const SERVICE_NAME_RE = /^(خدمة|مرفق)(:|$)/;
const DOCUMENTARY_NAME_RE = /^صورة توثيقية/;

/** Automatic order of the property's photos, most representative first. */
const PHOTO_RANK = {
  marked: 0,
  named: 1,
  facade: 2,
  exterior: 3,
  interior: 4,
  electricity: 5,
  water: 6,
  other: 7,
  supporting: 8,
} as const;

/** The id a mark is stored under: a photo's file, whatever slot it was taken in. */
export function photoMarkId(entry: PropertyDetailDocumentEntry): string {
  return (
    entry.inspectionPhoto?.attachment.attachmentId?.trim() ||
    entry.attachmentId?.trim() ||
    ""
  );
}

export function propertyPhotoRole(
  entry: PropertyDetailDocumentEntry,
  marks: PropertyPhotoMarks | null | undefined,
): PropertyPhotoRole | null {
  const id = photoMarkId(entry);
  if (!id || !marks) return null;
  if (marks.main === id) return "main";
  if (marks.electricity.includes(id)) return "electricity";
  if (marks.water.includes(id)) return "water";
  return null;
}

function photoRank(
  entry: PropertyDetailDocumentEntry,
  marks: PropertyPhotoMarks | null | undefined,
): number {
  const role = propertyPhotoRole(entry, marks);
  if (role === "main") return PHOTO_RANK.marked;
  if (role) return PHOTO_RANK[role];

  const text = `${entry.name} ${entry.fileName}`;
  if (SERVICE_NAME_RE.test(entry.name)) {
    if (ELECTRICITY_PHOTO_RE.test(text)) return PHOTO_RANK.electricity;
    if (WATER_PHOTO_RE.test(text)) return PHOTO_RANK.water;
    return PHOTO_RANK.supporting;
  }
  if (FACADE_NAME_RE.test(entry.name)) return PHOTO_RANK.facade;
  if (DOCUMENTARY_NAME_RE.test(entry.name)) return PHOTO_RANK.supporting;
  if (MAIN_PHOTO_RE.test(text)) return PHOTO_RANK.named;
  if (EXTERIOR_PHOTO_RE.test(text)) return PHOTO_RANK.exterior;
  if (INTERIOR_PHOTO_RE.test(text)) return PHOTO_RANK.interior;
  if (ELECTRICITY_PHOTO_RE.test(text)) return PHOTO_RANK.electricity;
  if (WATER_PHOTO_RE.test(text)) return PHOTO_RANK.water;
  return PHOTO_RANK.other;
}

/**
 * The property's photos in their automatic order: main, facade, exterior, interior, electricity,
 * water, the rest. The tab, its PDF and the report all read this order.
 *
 * How it works: each photo gets a rank from the specialist's mark, else from its name; photos of
 * one rank keep the order they were taken in.
 * Edge cases: a mark on a photo no longer in the list (retaken after a returned inspection) matches
 * nothing, so the automatic order takes over.
 */
export function orderPropertyPhotos(
  photos: PropertyDetailDocumentEntry[],
  marks?: PropertyPhotoMarks | null,
): PropertyDetailDocumentEntry[] {
  return [...photos].sort((a, b) => photoRank(a, marks) - photoRank(b, marks));
}

/**
 * The property's main photo: the one the specialist marked, else the first in the automatic order.
 *
 * Edge cases: a meter or a service photo is taken only when no other photo exists, so an unmarked
 * property never opens on the electricity meter (seen in production, 2026-11-01).
 */
export function pickPrimaryPropertyDetailPhoto(
  photos: PropertyDetailDocumentEntry[],
  marks?: PropertyPhotoMarks | null,
): PropertyDetailDocumentEntry | null {
  const ordered = orderPropertyPhotos(photos, marks);
  const rank = (photo: PropertyDetailDocumentEntry) => photoRank(photo, marks);
  return (
    ordered.find((photo) => rank(photo) <= PHOTO_RANK.interior) ??
    ordered.find((photo) => rank(photo) === PHOTO_RANK.other) ??
    ordered[0] ??
    null
  );
}

/**
 * The marks after one press of a photo's icon: pressing a held mark clears it.
 *
 * How it works: a photo holds one role, so taking a role drops its old one; the main photo is
 * single, so a new main replaces the old. Being in the report is separate from the role.
 * Edge cases: the report's limit is the caller's to refuse, with its own message.
 */
export function togglePropertyPhotoMark(
  marks: PropertyPhotoMarks,
  id: string,
  mark: PropertyPhotoMark,
): PropertyPhotoMarks {
  const without = (ids: string[]) => ids.filter((item) => item !== id);
  const toggled = (ids: string[]) => (ids.includes(id) ? without(ids) : [...ids, id]);
  if (mark === "report") return { ...marks, report: toggled(marks.report) };

  const cleared = {
    ...marks,
    main: marks.main === id ? null : marks.main,
    electricity: without(marks.electricity),
    water: without(marks.water),
  };
  if (mark === "main") return { ...cleared, main: marks.main === id ? null : id };
  return { ...cleared, [mark]: toggled(marks[mark]) };
}

/** The ids the report prints, in the automatic order; only photos still on the property count. */
export function reportPhotoIds(
  photos: PropertyDetailDocumentEntry[],
  marks: PropertyPhotoMarks | null | undefined,
): string[] {
  if (!marks?.report.length) return [];
  return orderPropertyPhotos(photos, marks)
    .map(photoMarkId)
    .filter((id) => marks.report.includes(id));
}

/**
 * Basic-tab «صورة العقار الرئيسية» is inspector-only — never intake/deed/bourse
 * images. Prefer an explicit inspectionPhoto handle, else source «المعاين…».
 */
export function isInspectorGlancePhoto(
  entry: PropertyDetailDocumentEntry,
): boolean {
  if (entry.inspectionPhoto) return true;
  if (entry.documentTypeKey === "inspection-photo") return true;
  return /المعاين/.test(entry.source);
}

export function pickInspectorPrimaryPhoto(
  photos: PropertyDetailDocumentEntry[],
  marks?: PropertyPhotoMarks | null,
): PropertyDetailDocumentEntry | null {
  return pickPrimaryPropertyDetailPhoto(photos.filter(isInspectorGlancePhoto), marks);
}
