/**
 * Pure rules behind `FieldInspectionWorkBody` — save-chip routing, the error
 * summary links, and the last-write-wins draft merge. No React, no I/O.
 */
import { MOVABLES_DESCRIPTION_KEY, OCCUPANCY_DESCRIPTION_KEY } from "../../lib/app-data/inspector-workspace-data";
import type { InspectorWorkspaceDraft } from "../../lib/app-data/inspector-workspace-data";
import type { InspectorWorkspaceFieldErrors } from "../../lib/app-data/inspector-workspace-validation";

export type InspectorSaveChipSection = "location" | "access" | "photos";

/** Which step-1 save chip a draft field belongs to. */
export const SAVE_CHIP_SECTION_BY_FIELD: Record<string, InspectorSaveChipSection> = {
  mapLatitude: "location",
  mapLongitude: "location",
  inspectionDate: "location",
  inspectionTime: "location",
  streetName: "access",
  mainStreetName: "access",
  streetWidthM: "access",
  accessRouteDescription: "access",
  accessContactName: "access",
  accessContactPhone: "access",
  accessContactRole: "access",
  freePhotos: "photos",
};

export const INSPECTOR_BUILDING_AREA_INPUTS = [
  ["builtArea", "مساحة البناء (م²)"],
  ["buildingFloors", "عدد أدوار المباني"],
  ["basementTotal", "إجمالي مساحة القبو (م²)"],
  ["annexTotal", "إجمالي مساحة الملاحق (م²)"],
] as const;

export type InspectorErrorLink = {
  key: string;
  message: string;
  targetId: string;
};

/**
 * Anchor id for each validation message. A function receives the whole error
 * bag because a few targets depend on which sub-field failed.
 */
const ERROR_LINK_TARGETS: {
  key: keyof InspectorWorkspaceFieldErrors;
  targetId: string | ((errors: InspectorWorkspaceFieldErrors) => string);
}[] = [
  { key: "inspectionDate", targetId: "ins-date" },
  { key: "inspectionTime", targetId: "ins-time" },
  { key: "mapLatitude", targetId: "ins-map-section" },
  { key: "accessContactName", targetId: "ins-access-name" },
  { key: "accessContactPhone", targetId: "ins-access-phone" },
  { key: "accessContactRole", targetId: "ins-access-role" },
  { key: "accessRouteDescription", targetId: "ins-access-name" },
  {
    key: "features",
    targetId: (errors) =>
      errors.emptyFeatureKeys?.[0]
        ? `ins-feature-${errors.emptyFeatureKeys[0]}`
        : "ins-features-section",
  },
  { key: "movablesDescription", targetId: `ins-${MOVABLES_DESCRIPTION_KEY}` },
  { key: "occupancyDescription", targetId: `ins-${OCCUPANCY_DESCRIPTION_KEY}` },
  {
    key: "featurePhotos",
    targetId: (errors) =>
      errors.missingFeaturePhotoKey
        ? `ins-feature-photo-${errors.missingFeaturePhotoKey}`
        : "ins-features-section",
  },
  { key: "definedPhotos", targetId: "ins-defined-photos" },
  { key: "componentPhotos", targetId: "ins-components-section" },
  { key: "observations", targetId: "ins-observations" },
  { key: "inspectionConfirmed", targetId: "ins-confirm" },
];

/** Error-summary rows, in the fixed order the form presents its steps. */
export function inspectorErrorLinks(
  fieldErrors: InspectorWorkspaceFieldErrors,
): InspectorErrorLink[] {
  const links: InspectorErrorLink[] = [];
  for (const entry of ERROR_LINK_TARGETS) {
    const message = fieldErrors[entry.key];
    if (typeof message !== "string" || !message) continue;
    links.push({
      key: entry.key,
      message,
      targetId:
        typeof entry.targetId === "function"
          ? entry.targetId(fieldErrors)
          : entry.targetId,
    });
  }
  return links;
}

/**
 * Debounced saves can land out of order — keep whichever draft carries the
 * newer server timestamp so a slow response never rewinds the form.
 */
export function newerInspectorDraft(
  prev: InspectorWorkspaceDraft | null,
  next: InspectorWorkspaceDraft,
): InspectorWorkspaceDraft {
  if (!prev) return next;
  const prevTs = Date.parse(prev.updatedAtUtc);
  const nextTs = Date.parse(next.updatedAtUtc);
  if (Number.isFinite(prevTs) && Number.isFinite(nextTs) && prevTs > nextTs) {
    return prev;
  }
  return next;
}
