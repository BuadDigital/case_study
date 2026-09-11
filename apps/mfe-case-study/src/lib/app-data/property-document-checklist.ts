/**
 * Pure model behind the «مستندات العقار» checklist: every governed document type that applies
 * to the property, the documents already on file for each, which requirements are still
 * missing, and the unlisted documents awaiting review. No React, no fetches.
 */
import type { ValuationListItemDto } from "@platform/api-client";
import type { PropertyDetailDocumentEntry } from "@platform/app-shared/app-data/property-detail-document-types";
import {
  PROPERTY_DOCUMENT_TYPES,
  UNLISTED_DOCUMENT_KEY,
  defaultPropertyTypeKeys,
  findPropertyDocumentType,
  normalizePropertyTypeKeys,
  propertyDocumentGroupTitle,
  type PropertyDocumentGroup,
  type PropertyDocumentType,
} from "@platform/app-shared/domain/property-documents/property-document-types";

export type PropertyDocumentChecklistRow = {
  type: PropertyDocumentType;
  label: string;
  required: boolean;
  documents: PropertyDetailDocumentEntry[];
  /** Label of another type whose document satisfies this requirement (bourse deed → deed). */
  satisfiedBy: string | null;
  missing: boolean;
};

export type PropertyDocumentChecklistGroup = {
  key: PropertyDocumentGroup;
  title: string;
  rows: PropertyDocumentChecklistRow[];
  completed: number;
};

export type PropertyDocumentChecklist = {
  groups: PropertyDocumentChecklistGroup[];
  photos: PropertyDetailDocumentEntry[];
  outputs: PropertyDocumentChecklistRow[];
  unlisted: PropertyDetailDocumentEntry[];
  missingRequired: string[];
};

export type PropertyDocumentTypeOption = {
  key: string;
  label: string;
  groupTitle: string;
  pdfOnly: boolean;
};

/** Groups the checklist lists as rows; photos, outputs and unlisted render on their own. */
const CHECKLIST_GROUPS: readonly PropertyDocumentGroup[] = [
  "ownership",
  "assignment",
  "contracts",
  "engineering",
  "movables",
];

type TypeSettings = Map<string, ValuationListItemDto>;

function settingsByKey(list: readonly ValuationListItemDto[] | null | undefined): TypeSettings {
  return new Map((list ?? []).map((row) => [row.key.trim().toLowerCase(), row]));
}

function typeLabel(type: PropertyDocumentType, settings: TypeSettings): string {
  return settings.get(type.key)?.name?.trim() || type.labelAr;
}

function hasReviewInfo(entry: PropertyDetailDocumentEntry): boolean {
  return Boolean(entry.governed || entry.unlisted);
}

/**
 * One row per attachment. The same file can arrive from the per-field intake cache and from
 * the governed read; the governed row carries the stored type and review state, so it wins,
 * keeping any preview the other already hydrated.
 */
export function dedupeDocumentEntries(
  entries: readonly PropertyDetailDocumentEntry[],
): PropertyDetailDocumentEntry[] {
  const result: PropertyDetailDocumentEntry[] = [];
  const indexByAttachment = new Map<string, number>();
  for (const entry of entries) {
    const attachmentId = entry.attachmentId?.trim();
    if (!attachmentId) {
      if (!result.some((e) => e.id === entry.id)) result.push(entry);
      continue;
    }
    const index = indexByAttachment.get(attachmentId);
    if (index === undefined) {
      indexByAttachment.set(attachmentId, result.length);
      result.push(entry);
      continue;
    }
    const existing = result[index]!;
    if (hasReviewInfo(entry) && !hasReviewInfo(existing)) {
      result[index] = { ...existing, ...entry, dataUrl: entry.dataUrl ?? existing.dataUrl };
    }
  }
  return result;
}

function reviewOrder(entry: PropertyDetailDocumentEntry): number {
  const status = entry.unlisted?.reviewStatus ?? "pending";
  return status === "pending" ? 0 : status === "rejected" ? 1 : 2;
}

export function buildPropertyDocumentChecklist(input: {
  entries: readonly PropertyDetailDocumentEntry[];
  attachmentsList?: readonly ValuationListItemDto[] | null;
  propertyType?: string | null;
}): PropertyDocumentChecklist {
  const settings = settingsByKey(input.attachmentsList);
  const propertyType = input.propertyType?.trim() ?? "";
  const byType = new Map<string, PropertyDetailDocumentEntry[]>();
  const photos: PropertyDetailDocumentEntry[] = [];
  const unlisted: PropertyDetailDocumentEntry[] = [];

  for (const entry of dedupeDocumentEntries(input.entries)) {
    const type = findPropertyDocumentType(entry.documentTypeKey);
    if (!type) continue;
    if (type.key === UNLISTED_DOCUMENT_KEY) unlisted.push(entry);
    else if (type.group === "photos") photos.push(entry);
    else byType.set(type.key, [...(byType.get(type.key) ?? []), entry]);
  }

  // Requirement key → label of the first type on file that counts as it.
  const satisfiers = new Map<string, string>();
  for (const [key, docs] of byType) {
    const type = findPropertyDocumentType(key);
    if (docs.length > 0 && type?.countsAs && !satisfiers.has(type.countsAs)) {
      satisfiers.set(type.countsAs, typeLabel(type, settings));
    }
  }

  const buildRow = (type: PropertyDocumentType) => {
    const setting = settings.get(type.key);
    const propertyKeys = setting
      ? normalizePropertyTypeKeys(setting.propertyTypeKeys ?? [])
      : [...defaultPropertyTypeKeys(type)];
    const applies =
      !propertyType || propertyKeys.length === 0 || propertyKeys.includes(propertyType);
    const enabled = setting ? setting.isEnabled : true;
    const required =
      applies && enabled && (setting ? setting.isRequired : type.defaultRequired);
    const documents = byType.get(type.key) ?? [];
    const satisfiedBy = documents.length === 0 ? (satisfiers.get(type.key) ?? null) : null;
    const row: PropertyDocumentChecklistRow = {
      type,
      label: typeLabel(type, settings),
      required,
      documents,
      satisfiedBy,
      missing: required && documents.length === 0 && !satisfiedBy,
    };
    return { row, visible: documents.length > 0 || (applies && enabled) };
  };

  const groups = CHECKLIST_GROUPS.map((group) => {
    const rows = PROPERTY_DOCUMENT_TYPES.filter((type) => type.group === group)
      .map(buildRow)
      .filter((built) => built.visible)
      .map((built) => built.row);
    return {
      key: group,
      title: propertyDocumentGroupTitle(group),
      rows,
      completed: rows.filter((row) => row.documents.length > 0 || row.satisfiedBy).length,
    };
  }).filter((group) => group.rows.length > 0);

  const outputs = PROPERTY_DOCUMENT_TYPES.filter((type) => type.group === "outputs").map(
    (type) => buildRow(type).row,
  );

  return {
    groups,
    photos,
    outputs,
    unlisted: [...unlisted].sort((a, b) => reviewOrder(a) - reviewOrder(b)),
    missingRequired: groups.flatMap((group) =>
      group.rows.filter((row) => row.missing).map((row) => row.label),
    ),
  };
}

/** Types a user may pick when uploading from the tab — enabled ones, unlisted last. */
export function propertyDocumentUploadOptions(
  attachmentsList?: readonly ValuationListItemDto[] | null,
): PropertyDocumentTypeOption[] {
  const settings = settingsByKey(attachmentsList);
  const listed = PROPERTY_DOCUMENT_TYPES.filter(
    (type) =>
      type.uploadableFromTab &&
      type.key !== UNLISTED_DOCUMENT_KEY &&
      (settings.get(type.key)?.isEnabled ?? true),
  ).map((type) => ({
    key: type.key,
    label: typeLabel(type, settings),
    groupTitle: propertyDocumentGroupTitle(type.group),
    pdfOnly: type.pdfOnly,
  }));
  return [
    ...listed,
    {
      key: UNLISTED_DOCUMENT_KEY,
      label: "مستند غير معرّف (للحالات النادرة)",
      groupTitle: propertyDocumentGroupTitle("unlisted"),
      pdfOnly: false,
    },
  ];
}
