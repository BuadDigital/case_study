/**
 * Pure rules and constants behind `InspectorWorkspaceWizard` and its step
 * siblings. No React, no writes — every export is a function of the draft plus
 * the property, so the wizard keeps JSX and event wiring only.
 */
import { cn, type GoogleMapContextPin } from "@platform/ui-kit";
import {
  activeMapDiffersFromInspectorOriginal,
  hasInspectorOriginalMapPin,
  type InspectorMapActor,
  type InspectorWorkspaceDraft,
} from "../../lib/app-data/inspector-workspace-data";
import { approximatePropertyGeo } from "../../lib/app-data/po-intake-data";

/** Amenity chips from the design file (extras entered elsewhere are preserved). */
export const DESIGN_AMENITIES = [
  "مدارس",
  "مستشفيات",
  "مساجد",
  "أسواق تجارية",
  "طرق رئيسية",
  "حدائق",
] as const;

/** Feature keys rendered as pills in the components card, not as fields. */
export const COMPONENT_BOOL_KEYS = [
  "carEntrance",
  "hasBasement",
  "hasElevator",
  "hasPool",
  "kitchen",
] as const;

/** Facade types when the catalog query has no options yet. */
export const FALLBACK_FACADE_OPTIONS = [
  "دهان",
  "حجر",
  "رخام",
  "زجاج",
  "طوب",
  "بدون تشطيب",
  "أخرى",
];

/** Pill styling for the yes/no component toggles. */
export function inspectorBoolPillClass(on: boolean, disabled = false) {
  return cn(
    "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-[7px] font-inherit text-xs font-semibold",
    disabled ? "cursor-default" : "cursor-pointer",
    on ? "border-ink bg-ink text-white" : "border-border-md bg-surface text-text-2",
  );
}

/** Draft coords when both are numeric, else the approximate property location. */
export function inspectorWizardMapGeo(
  draft: InspectorWorkspaceDraft,
  property: { city: string; district?: string; deedNumber: string },
): { lat: number; lng: number } | null {
  const lat = Number(draft.mapLatitude);
  const lng = Number(draft.mapLongitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return approximatePropertyGeo(property);
}

/** After the specialist pins — the inspector's original pin, for comparison only. */
export function inspectorReferenceMapPins(
  draft: InspectorWorkspaceDraft,
  mapActor: InspectorMapActor,
  mapPinned: boolean,
): GoogleMapContextPin[] {
  if (
    mapActor !== "specialist" ||
    !mapPinned ||
    !hasInspectorOriginalMapPin(draft) ||
    !activeMapDiffersFromInspectorOriginal(draft)
  ) {
    return [];
  }
  const lat = Number(draft.inspectorMapLatitude);
  const lng = Number(draft.inspectorMapLongitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  return [{ lat, lng, title: "موقع المعاين الأصلي", label: "مع" }];
}

/** "lat, lng" for the coords input — empty until both sides are filled. */
export function inspectorWizardCoordsValue(
  draft: InspectorWorkspaceDraft,
): string {
  return draft.mapLatitude.trim() && draft.mapLongitude.trim()
    ? `${draft.mapLatitude.trim()}, ${draft.mapLongitude.trim()}`
    : "";
}
