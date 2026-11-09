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
  /**
   * `report` is the specialist's board order (2026-11-03): the report prints it as it stands.
   * Absent on picks saved before the board, which still print sorted by section.
   */
  reportOrdered?: boolean;
  /**
   * Every inspector photo's class (Omar 2026-11-08), by attachment id — the Enfaz photo files are built
   * from it; none = the suggested class. Separate from the report's picks.
   */
  photoClasses?: Record<string, PropertyPhotoClass>;
};

/**
 * What an inspector photo is (Omar 2026-11-08): exterior (the meters included), interior (the
 * movables included), the property's surroundings (related, not of it — kept inside the system,
 * never sent to Enfaz), or a document (made a property document, out of the photo files).
 */
export type PropertyPhotoClass = "exterior" | "interior" | "surroundings" | "document";

export const PROPERTY_PHOTO_CLASSES: readonly { key: PropertyPhotoClass; label: string }[] = [
  { key: "exterior", label: "خارجية" },
  { key: "interior", label: "داخلية" },
  { key: "surroundings", label: "محيط العقار" },
  { key: "document", label: "مستند" },
];

export type PropertyPhotoRole = "main" | "electricity" | "water" | "movables";
export type PropertyPhotoMark = PropertyPhotoRole | "report";

/** The report's photo sections, printed in this order: 1 exterior, 2 interior, 3 other. */
export type ReportPhotoSection = 1 | 2 | 3;

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

/**
 * The class a photo's name and marks suggest before anyone classifies it.
 *
 * How it works: movables (marked or named) → interior; the main photo and the meters (marked, or a
 * service shot such as «خدمة: كهرباء») → exterior — Omar 2026-11-08: the exterior file carries the
 * meters, the interior one the movables; otherwise the inspection category (`suggestedReportSection`):
 * inside → interior, anything else → exterior.
 * Edge cases: nothing is suggested as surroundings or a document — those are always someone's choice.
 */
export function suggestedPhotoClass(
  entry: PropertyDetailDocumentEntry,
  marks: PropertyPhotoMarks | null | undefined,
): PropertyPhotoClass {
  const role = propertyPhotoRole(entry, marks);
  const text = `${entry.name} ${entry.fileName}`;
  if (role === "movables" || MOVABLES_PHOTO_RE.test(text)) return "interior";
  if (role === "main" || role === "electricity" || role === "water") return "exterior";
  return suggestedReportSection(entry) === 2 ? "interior" : "exterior";
}

/** A photo's class: the stored one, else the suggested one. */
export function photoClassOf(
  entry: PropertyDetailDocumentEntry,
  marks: PropertyPhotoMarks | null | undefined,
): PropertyPhotoClass {
  return marks?.photoClasses?.[photoMarkId(entry)] ?? suggestedPhotoClass(entry, marks);
}

/** The marks with one photo's class set (the stored map keeps only explicit choices). */
export function withPhotoClass(
  marks: PropertyPhotoMarks,
  entry: PropertyDetailDocumentEntry,
  value: PropertyPhotoClass,
): PropertyPhotoMarks {
  const id = photoMarkId(entry);
  if (!id) return marks;
  return { ...marks, photoClasses: { ...(marks.photoClasses ?? {}), [id]: value } };
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
  // Movables print in their own section, so a photo turned into movables leaves the report board.
  if (mark === "movables" && !(marks.movables ?? []).includes(id)) {
    return withMovablesBoard(marks, [...(marks.movables ?? []), id]);
  }
  return { ...cleared, [mark]: toggled(marks[mark] ?? []) };
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
 * The photos the report prints: the specialist's board, slot 1 the main photo (2026-11-03 ruling:
 * the specialist always chooses; nothing enters the report by itself).
 *
 * How it works: a board saved since 2026-11-03 prints in its own order. Picks saved before it
 * (2026-11-02) print sorted by section, the marked main photo first, as they printed then.
 * Edge cases: only the inspector's photos still on the property count, so a photo that was retaken
 * drops out; no choice prints no photo.
 */
export function reportPhotoIds(
  photos: PropertyDetailDocumentEntry[],
  marks: PropertyPhotoMarks | null | undefined,
): string[] {
  if (!marks?.report.length) return [];
  const inspector = photos.filter(isInspectorGlancePhoto);
  const live = new Set(inspector.map(photoMarkId).filter(Boolean));
  const picked = marks.report.filter((id) => live.has(id));
  if (picked.length === 0) return [];
  if (marks.reportOrdered) return picked;
  const main = marks.main && live.has(marks.main) ? marks.main : null;
  return orderReportPhotos(inspector, marks)
    .map(photoMarkId)
    .filter((id) => id && (picked.includes(id) || id === main));
}

/** What goes onto a board slot: a photo from the inspector's groups, or another slot's photo. */
export type ReportBoardSource = { photoId: string } | { slot: number };

/**
 * The board after one drop (or tap) on slot `target`.
 *
 * How it works: a slot onto a filled slot swaps the two, onto an empty one moves it to the end; a
 * photo already on the board acts as its slot; a new photo onto a filled slot replaces that photo,
 * onto an empty one fills the next free slot. Edge cases: a full board takes no new photo. Returns
 * the reason instead of a board when the drop is refused.
 */
export function placeOnReportBoard(
  board: readonly string[],
  source: ReportBoardSource,
  target: number,
  limit: number,
): string[] | { refused: string } {
  const next = [...board];
  const from = "slot" in source ? source.slot : next.indexOf(source.photoId);
  if (from >= 0 && from < next.length) {
    if (from === target) return next;
    if (target >= next.length) {
      const [moved] = next.splice(from, 1);
      return [...next, moved!];
    }
    [next[from], next[target]] = [next[target]!, next[from]!];
    return next;
  }
  if (!("photoId" in source)) return next;
  if (target < next.length) {
    next[target] = source.photoId;
    return next;
  }
  if (next.length >= limit) return { refused: `التقرير يطبع ${limit} صورة كحد أقصى` };
  return [...next, source.photoId];
}

/**
 * The marks holding `board` as the specialist's report photos, slot 1 as the property's main photo
 * (the map card, the basic tab and the report's first photo all read `main`).
 *
 * Edge cases: a photo holds one role, so the new main photo leaves the meters' marks kept from
 * before, and a board photo leaves the movables; sections are no longer chosen, so they drop.
 */
export function withReportBoard(marks: PropertyPhotoMarks, board: readonly string[]): PropertyPhotoMarks {
  const main = board[0] ?? null;
  return {
    ...marks,
    main,
    electricity: marks.electricity.filter((id) => id !== main),
    water: marks.water.filter((id) => id !== main),
    movables: (marks.movables ?? []).filter((id) => !board.includes(id)),
    report: [...board],
    reportSections: {},
    reportOrdered: true,
  };
}

/** The movables section prints one page (2026-11-03). */
export const REPORT_MOVABLES_PHOTO_LIMIT = REPORT_PHOTOS_PER_PAGE;

/**
 * The movables board: the photos the specialist chose for «صور المنقولات», in their order.
 * Edge cases: only photos still on the property count.
 */
export function movablesBoardIds(
  photos: PropertyDetailDocumentEntry[],
  marks: PropertyPhotoMarks | null | undefined,
): string[] {
  const live = new Set(photos.filter(isInspectorGlancePhoto).map(photoMarkId).filter(Boolean));
  return (marks?.movables ?? []).filter((id) => live.has(id)).slice(0, REPORT_MOVABLES_PHOTO_LIMIT);
}

/**
 * The marks holding `board` as the movables photos: they leave the report board (slot 1 passes to
 * the next photo) and drop any other role, since a photo holds one role.
 */
export function withMovablesBoard(marks: PropertyPhotoMarks, board: readonly string[]): PropertyPhotoMarks {
  const next: PropertyPhotoMarks = {
    ...marks,
    main: marks.main && board.includes(marks.main) ? null : marks.main,
    electricity: marks.electricity.filter((id) => !board.includes(id)),
    water: marks.water.filter((id) => !board.includes(id)),
    movables: [...board],
  };
  if (!board.some((id) => marks.report.includes(id))) return next;
  const report = marks.report.filter((id) => !board.includes(id));
  return marks.reportOrdered ? withReportBoard(next, report) : { ...next, report };
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
