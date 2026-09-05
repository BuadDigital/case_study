/**
 * Pure rules and constants behind `InspectorWorkspaceWizard` and its step
 * siblings. No React, no writes — every export is a function of the draft plus
 * the property, so the wizard keeps JSX and event wiring only.
 */
import { cn, type GoogleMapContextPin } from "@platform/ui-kit";
import {
  activeMapDiffersFromInspectorOriginal,
  hasInspectorOriginalMapPin,
  inspectorFeatureRequiresPhoto,
  isServiceAmenityPhotoSlotComplete,
  listServiceAmenityPhotoSlots,
  type InspectorDefinedPhotoSlot,
  type InspectorFeatureField,
  type InspectorMapActor,
  type InspectorSlotPhoto,
  type InspectorWorkspaceDraft,
  type ServiceAmenityPhotoSlotDef,
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

/** One yes/no pill of the components card plus its proof-photo state. */
export type ComponentBoolPhotoSlot = {
  key: string;
  label: string;
  on: boolean;
  /** «نعم» on a `photoOnYes` field — the card must render a photo picker. */
  needsPhoto: boolean;
  /** The rule (`listInspectorPhotoValidationIssues`) is satisfied only by an uploaded attachment. */
  hasPhoto: boolean;
};

/**
 * Which component pills render, and which of them need a picker so the
 * «يجب إرفاق صورة توثيقية» rule can be satisfied from the wizard itself.
 * Keys absent from `fields` (retired/hidden) render nothing; land has no card.
 */
export function listComponentBoolPhotoSlots(
  draft: Pick<InspectorWorkspaceDraft, "featureValues" | "featurePhotoAttachments">,
  fields: readonly InspectorFeatureField[],
  isLand = false,
): ComponentBoolPhotoSlot[] {
  if (isLand) return [];
  const out: ComponentBoolPhotoSlot[] = [];
  for (const key of COMPONENT_BOOL_KEYS) {
    const field = fields.find((f) => f.key === key);
    if (!field) continue;
    const value = draft.featureValues[key] ?? "";
    out.push({
      key,
      label: field.label,
      on: value === "نعم",
      needsPhoto: inspectorFeatureRequiresPhoto(field, value),
      hasPhoto: Boolean(draft.featurePhotoAttachments[key]?.attachmentId),
    });
  }
  return out;
}

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

/* ---------- Defined (service/amenity) photo slots ---------- */

/** Cache key of a slot photo's data URL (`inspector-photo-upload`). */
export function slotPhotoRef(slotId: string, photoId: number): string {
  return `slot:${slotId}:${photoId}`;
}

/** Cache key of a free (uncategorised) photo's data URL. */
export function freePhotoRef(photoId: number): string {
  return `free:${photoId}`;
}

export function emptyDefinedPhotoSlot(): InspectorDefinedPhotoSlot {
  return { none: false, photos: [] };
}

/** One selected service/amenity with its slot state joined in — what a tile renders. */
export type DefinedPhotoSlotCell = ServiceAmenityPhotoSlotDef & {
  slot: InspectorDefinedPhotoSlot;
  /** Approved photo present, or marked «غير متوفر». */
  done: boolean;
  first: InspectorSlotPhoto | undefined;
  /** Cache key of the first photo — `undefined` while the slot is empty. */
  photoRef: string | undefined;
};

/** One cell per selected service then amenity, in selection order. */
export function listDefinedPhotoSlotCells(
  draft: Pick<InspectorWorkspaceDraft, "services" | "amenities" | "definedPhotos">,
): DefinedPhotoSlotCell[] {
  return listServiceAmenityPhotoSlots(draft).map((def) => {
    const slot = draft.definedPhotos[def.id] ?? emptyDefinedPhotoSlot();
    const first = slot.photos[0];
    return {
      ...def,
      slot,
      done: isServiceAmenityPhotoSlotComplete(slot),
      first,
      photoRef: first ? slotPhotoRef(def.id, first.id) : undefined,
    };
  });
}

export const DEFINED_PHOTOS_EMPTY_TEXT =
  "اختر خدمة أو مرفقاً من «الخدمات والمرافق المحيطة» أولاً — تظهر هنا خانة صورة لكل اختيار.";

export function definedPhotosIntroText(
  layout: "desktop" | "mobile",
  canPickFromTransaction: boolean,
): string {
  if (layout === "desktop") {
    return canPickFromTransaction
      ? "لكل خدمة/مرفق اخترته أعلاه تظهر خانة صورة واحدة. يمكن رفع ملف أو اختيار صورة من مرفقات المعاملة (مثل إثبات الكهرباء والماء)."
      : "لكل خدمة/مرفق اخترته في القسم أعلاه: ارفع صورة توثيقية (كاميرا أو ملف). بدون اختيار لا تظهر خانات.";
  }
  return canPickFromTransaction
    ? "وثّق كل خدمة/مرفق. ارفع صورة أو اختر من مرفقات المعاملة."
    : "وثّق كل خدمة/مرفق اخترته. اضغط الخانة للتصوير أو اختيار ملف.";
}

export function transactionPickerLabel(done: boolean): string {
  return done ? "تغيير من المعاملة" : "من صور المعاملة";
}

/* Slot updates — pure so the upload loop can fold them over a working draft. */

export function definedSlotWithPhoto(
  slot: InspectorDefinedPhotoSlot,
  photo: InspectorSlotPhoto,
): InspectorDefinedPhotoSlot {
  return { none: false, photos: [...slot.photos, photo] };
}

export function definedSlotWithoutPhoto(
  slot: InspectorDefinedPhotoSlot,
  photoId: number,
): InspectorDefinedPhotoSlot {
  return { ...slot, photos: slot.photos.filter((photo) => photo.id !== photoId) };
}

export function definedSlotWithApproved(
  slot: InspectorDefinedPhotoSlot,
  photoId: number,
): InspectorDefinedPhotoSlot {
  return {
    ...slot,
    photos: slot.photos.map((photo) =>
      photo.id === photoId ? { ...photo, approved: true } : photo,
    ),
  };
}

/** «غير متوفر» either way drops the photos; the flag decides which empty state. */
export function definedSlotNone(none: boolean): InspectorDefinedPhotoSlot {
  return none ? { none: true, photos: [] } : { none: false, photos: [] };
}

/** A transaction pick replaces the slot with that single photo. */
export function definedSlotReplacedBy(photo: InspectorSlotPhoto): InspectorDefinedPhotoSlot {
  return { none: false, photos: [photo] };
}

export function setDefinedPhotoSlot(
  definedPhotos: InspectorWorkspaceDraft["definedPhotos"],
  slotId: string,
  slot: InspectorDefinedPhotoSlot,
): InspectorWorkspaceDraft["definedPhotos"] {
  return { ...definedPhotos, [slotId]: slot };
}

export function findDefinedSlotPhoto(
  definedPhotos: InspectorWorkspaceDraft["definedPhotos"],
  slotId: string,
  photoId: number,
): InspectorSlotPhoto | undefined {
  return definedPhotos[slotId]?.photos.find((photo) => photo.id === photoId);
}
