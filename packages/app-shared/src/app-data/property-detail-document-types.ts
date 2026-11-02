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
  /** Photos of the movables inside the property (2026-11-02). */
  movables?: string[];
  /** The photos the specialist picked for the report; empty = the first ones in the report's order. */
  report: string[];
  /** The section the specialist gave a picked photo; none = the suggested one. */
  reportSections?: Record<string, ReportPhotoSection>;
};

export type PropertyPhotoRole = "main" | "electricity" | "water" | "movables";
export type PropertyPhotoMark = PropertyPhotoRole | "report";

/** The report's photo sections, printed in this order: 1 exterior, 2 interior, 3 other. */
export type ReportPhotoSection = 1 | 2 | 3;

export const REPORT_PHOTO_SECTIONS: { section: ReportPhotoSection; label: string }[] = [
  { section: 1, label: "خارجية" },
  { section: 2, label: "داخلية" },
  { section: 3, label: "أخرى" },
];

export function reportPhotoSectionLabel(section: ReportPhotoSection): string {
  return REPORT_PHOTO_SECTIONS.find((item) => item.section === section)?.label ?? "";
}

export const EMPTY_PROPERTY_PHOTO_MARKS: PropertyPhotoMarks = {
  main: null,
  electricity: [],
  water: [],
  movables: [],
  report: [],
  reportSections: {},
};

/** The report prints its photos six to a page. */
export const REPORT_PHOTOS_PER_PAGE = 6;

/** The most the report can print: four pages, the settings' highest choice for buildings. */
export const REPORT_PHOTO_LIMIT = 24;

/**
 * How many photos this property's report prints, from the settings' «صفحات الصور».
 *
 * How it works: a land report takes the land pages, every other report the building pages, six
 * photos to a page. Edge cases: settings not loaded yet fall back to their seeded values (four
 * pages for both since 2026-11-02), and nothing goes above {@link REPORT_PHOTO_LIMIT}.
 */
export function reportPhotoLimit(
  pages: { photoPagesLand?: number; photoPagesBuilt?: number } | null | undefined,
  isLand: boolean,
): number {
  const count = isLand ? (pages?.photoPagesLand ?? 4) : (pages?.photoPagesBuilt ?? 4);
  return Math.min(REPORT_PHOTO_LIMIT, Math.max(1, count) * REPORT_PHOTOS_PER_PAGE);
}

export const MAIN_PHOTO_RE = /رئيس|main|primary/i;
export const EXTERIOR_PHOTO_RE = /خارج|واجهة|front|exterior|outside|\bsides?\b/i;
export const INTERIOR_PHOTO_RE = /داخل|interior|inside|floor|أرض/i;
export const ELECTRICITY_PHOTO_RE = /كهرب|elec|عداد/i;
export const WATER_PHOTO_RE = /خدمة: ماء|عداد ماء|water/i;
export const MOVABLES_PHOTO_RE = /منقولات|movable/i;
/**
 * A free photo of the kind «خدمة» (`صور خارجية · خدمة`). «مرفق» stays with its bucket: inspectors
 * file most rooms under «صور داخلية · مرفق» (61 of 81 photos on PO-073348).
 */
const SERVICE_KIND_RE = /·\s*خدمة/;
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
  movables: 7,
  other: 8,
  supporting: 9,
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
  if (marks.movables?.includes(id)) return "movables";
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
    movables: without(marks.movables ?? []),
  };
  if (mark === "main") return { ...cleared, main: marks.main === id ? null : id };
  return { ...cleared, [mark]: toggled(marks[mark] ?? []) };
}

/**
 * The marks after the specialist puts a photo in a report section, or takes it out (null).
 *
 * Edge cases: the report's limit is the caller's to refuse; taking a photo out drops its section.
 */
export function setReportPhotoSection(
  marks: PropertyPhotoMarks,
  id: string,
  section: ReportPhotoSection | null,
): PropertyPhotoMarks {
  const sections = Object.fromEntries(
    Object.entries(marks.reportSections ?? {}).filter(([key]) => key !== id),
  ) as Record<string, ReportPhotoSection>;
  if (section === null) {
    return { ...marks, report: marks.report.filter((item) => item !== id), reportSections: sections };
  }
  return {
    ...marks,
    report: marks.report.includes(id) ? marks.report : [...marks.report, id],
    reportSections: { ...sections, [id]: section },
  };
}

/**
 * The report section a photo's inspection category suggests: what the inspector photographed
 * outside goes to 1, inside to 2, and services (meters, utilities), the service and amenity slots
 * and supporting shots to 3. Kitchens, bathrooms and yards the specialist moves to 3 by hand.
 *
 * How it works: reads the name the photos tab gives the photo (`صور خارجية · واجهة`, `خدمة: ماء`).
 * Edge cases: a photo with no category is matched by its name, else goes to 3.
 */
export function suggestedReportSection(entry: PropertyDetailDocumentEntry): ReportPhotoSection {
  const text = `${entry.name} ${entry.fileName}`;
  if (SERVICE_NAME_RE.test(entry.name) || SERVICE_KIND_RE.test(entry.name)) return 3;
  if (DOCUMENTARY_NAME_RE.test(entry.name)) return 3;
  if (FACADE_NAME_RE.test(entry.name) || EXTERIOR_PHOTO_RE.test(text)) return 1;
  if (INTERIOR_PHOTO_RE.test(text)) return 2;
  return 3;
}

/**
 * The section a photo prints in: the main photo opens the exterior photos, the meters go to
 * «أخرى», any other photo takes the specialist's section, else the suggested one.
 */
export function reportPhotoSection(
  entry: PropertyDetailDocumentEntry,
  marks: PropertyPhotoMarks | null | undefined,
): ReportPhotoSection {
  const role = propertyPhotoRole(entry, marks);
  if (role === "main") return 1;
  if (role === "electricity" || role === "water") return 3;
  return marks?.reportSections?.[photoMarkId(entry)] ?? suggestedReportSection(entry);
}

/**
 * The property's photos in the report's order: exterior, interior, other, each section in the
 * automatic order, so the main photo comes first.
 */
export function orderReportPhotos(
  photos: PropertyDetailDocumentEntry[],
  marks: PropertyPhotoMarks | null | undefined,
): PropertyDetailDocumentEntry[] {
  return orderPropertyPhotos(photos, marks)
    .map((photo, index) => ({ photo, index, section: reportPhotoSection(photo, marks) }))
    .sort((a, b) => a.section - b.section || a.index - b.index)
    .map(({ photo }) => photo);
}

/**
 * Whether the report takes this photo without it being picked: the main photo (marked, else the
 * automatic pick) and the marked meters (2026-11-02 ruling).
 */
export function isAutomaticReportPhoto(
  photos: PropertyDetailDocumentEntry[],
  entry: PropertyDetailDocumentEntry,
  marks: PropertyPhotoMarks | null | undefined,
): boolean {
  const role = propertyPhotoRole(entry, marks);
  if (role === "electricity" || role === "water") return true;
  return entry.id === pickInspectorPrimaryPhoto(photos, marks)?.id;
}

/**
 * The ids the report prints once the specialist picked photos: the picked ones with the main
 * photo and the marked meters, in the report's order. Empty while nothing is picked, so the report
 * takes the first ones of {@link orderReportPhotos}.
 *
 * Edge cases: only the inspector's photos still on the property count, so a picked photo that was
 * retaken drops out, and picks that are all gone count as no pick.
 */
export function reportPhotoIds(
  photos: PropertyDetailDocumentEntry[],
  marks: PropertyPhotoMarks | null | undefined,
): string[] {
  if (!marks?.report.length) return [];
  const inspector = photos.filter(isInspectorGlancePhoto);
  if (!inspector.some((photo) => marks.report.includes(photoMarkId(photo)))) return [];
  return orderReportPhotos(inspector, marks)
    .filter(
      (photo) =>
        marks.report.includes(photoMarkId(photo)) || isAutomaticReportPhoto(inspector, photo, marks),
    )
    .map(photoMarkId)
    .filter(Boolean);
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
