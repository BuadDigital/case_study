/** Inspector workspace draft — replaces legacy FieldInspectionSubmission. */

export type InspectorWorkspaceStatus = "draft" | "submitted" | "reopened";

export type InspectorBoundaryKey = "north" | "south" | "east" | "west";

export type InspectorBoundaryMatch = {
  matches: boolean;
  mismatchNote: string;
  /** «نوع الواجهة» — facade finish on this side; options come from the report dictionary. */
  facade: string;
};

import { jeddahDefaultCoords } from "@platform/app-shared/domain/jeddah-default-coords";

export type InspectorPhotoAttachment = {
  fileName: string;
  mimeType: string;
  attachmentId?: string;
  sizeBytes?: number;
  /** match | outside_property | location_unavailable — specialist review only */
  locationFlag?: string | null;
  distanceM?: number | null;
};

export type InspectorObservation = {
  id: string;
  category: string;
  text: string;
  photo: InspectorPhotoAttachment | null;
};

export type InspectorSlotPhoto = {
  id: number;
  approved: boolean;
  fileName: string;
  mimeType: string;
  attachmentId?: string;
  sizeBytes?: number;
  locationFlag?: string | null;
  distanceM?: number | null;
};

export type InspectorDefinedPhotoSlot = {
  none: boolean;
  photos: InspectorSlotPhoto[];
};

export type InspectorFreePhotoUploader = "inspector" | "specialist";

export type InspectorFreePhoto = {
  id: number;
  category: string | null;
  approved: boolean;
  fileName: string;
  mimeType: string;
  /** Who added this general property photo — defaults to inspector for legacy rows. */
  uploadedBy?: InspectorFreePhotoUploader;
  attachmentId?: string;
  sizeBytes?: number;
  locationFlag?: string | null;
  distanceM?: number | null;
};

export function inspectorFreePhotoUploader(
  photo: InspectorFreePhoto,
): InspectorFreePhotoUploader {
  return photo.uploadedBy ?? "inspector";
}

export function canDeleteInspectorFreePhoto(
  photo: InspectorFreePhoto,
  actor: InspectorFreePhotoUploader,
): boolean {
  return inspectorFreePhotoUploader(photo) === actor;
}

export function inspectorFreePhotoUploaderLabel(
  uploader: InspectorFreePhotoUploader,
): string {
  return uploader === "specialist" ? "الأخصائي" : "المعاين";
}

export type InspectorFeatureField = {
  key: string;
  label: string;
  options: readonly string[];
  photoOnYes: boolean;
  shared?: boolean;
};

export const MOVABLES_FEATURE_KEY = "movables";
export const MOVABLES_DESCRIPTION_KEY = "movablesDescription";
export const MOVABLES_DESCRIPTION_LABEL = "وصف المنقولات";

export const OCCUPANCY_STATE_KEY = "occupancyState";
export const OCCUPANCY_DESCRIPTION_KEY = "occupancyDescription";
export const OCCUPANCY_DESCRIPTION_LABEL = "سبب الإشغال";

/** Who facilitated site access — contact fields (same as بيانات الاتصال). */
export const ACCESS_ROUTE_DESCRIPTION_LABEL = "تأكيد موقع العقار";
export const ACCESS_ROUTE_DESCRIPTION_HINT =
  "تم الوصول الى العقار بمعرفة:";
export const ACCESS_CONTACT_NAME_LABEL = "الاسم";
export const ACCESS_CONTACT_PHONE_LABEL = "رقم الجوال";
export const ACCESS_CONTACT_ROLE_LABEL = "الصلة";
export const ACCESS_CONTACT_NEW_BUTTON_LABEL = "+ جهة اتصال جديدة";
export const ACCESS_CONTACT_ADD_BUTTON_LABEL = "إضافة لجهات الاتصال";
export const ACCESS_ROUTE_DESCRIPTION_REQUIRED =
  "أكمل بيانات من سهّل الوصول (الاسم، رقم الجوال، الصلة)";

export const SITE_LOCATION_ACK_BUTTON_LABEL = "إقرار صحة الموقع";
export const SITE_LOCATION_ACK_PENDING_MESSAGE =
  "سيتم إضافة خطاب إقرار ضابط الاتصال بصحة موقع العقار قريباً.";

/** Compose Infath / payload free-text from the three contact fields. */
export function composeAccessRouteDescription(input: {
  name: string;
  phone: string;
  role: string;
}): string {
  const name = input.name.trim();
  const phone = input.phone.trim();
  const role = input.role.trim();
  const parts: string[] = [];
  if (role) parts.push(role);
  if (name) parts.push(name);
  if (phone) parts.push(`رقم الجوال ${phone}`);
  return parts.join("، ");
}

export function isMovablesPresent(featureValues: Record<string, string>): boolean {
  return (featureValues[MOVABLES_FEATURE_KEY] ?? "").trim() === "نعم";
}

export function isOccupied(featureValues: Record<string, string>): boolean {
  return (featureValues[OCCUPANCY_STATE_KEY] ?? "").trim() === "مشغول";
}

export function normalizeInspectorLandText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function textLooksLikeVacantLand(
  value: string | null | undefined,
): boolean {
  const normalized = normalizeInspectorLandText(value ?? "");
  if (!normalized || normalized.includes("ملحق")) return false;
  return normalized.includes("ارض") || /\bland\b/.test(normalized);
}

export function patchInspectorFeatureValues(
  featureValues: Record<string, string>,
  key: string,
  next: string,
): Record<string, string> {
  const values = { ...featureValues, [key]: next };
  if (key === MOVABLES_FEATURE_KEY && next.trim() !== "نعم") {
    values[MOVABLES_DESCRIPTION_KEY] = "";
  }
  if (key === OCCUPANCY_STATE_KEY && next.trim() !== "مشغول") {
    values[OCCUPANCY_DESCRIPTION_KEY] = "";
  }
  if (key === "assetSubject" && textLooksLikeVacantLand(next)) {
    for (const hidden of LAND_HIDDEN_INSPECTOR_FEATURE_KEYS) {
      values[hidden] = "";
    }
  }
  return values;
}

/**
 * Feature fields with photo-proof column (desktop table «photo» / mobile capture).
 *
 * - Yes/no rows (`photoOnYes` + options include «yes»): proof only when value is «yes»
 *   — matches Case Study.html `PHOTO_ON_YES`.
 * - Closed-list rows with `photoOnYes`: proof whenever a value is chosen
 *   — matches desktop HTML table column for origin / facade / usage / build state.
 */
export const INSPECTOR_FEATURE_FIELDS: InspectorFeatureField[] = [
  {
    key: "assetSubject",
    label: "الأصل محل التقييم",
    options: ["فيلا", "أرض", "شقة", "عمارة", "محل تجاري", "مستودع"],
    photoOnYes: true,
  },
  {
    key: "facade",
    label: "الواجهة",
    options: [
      "شمالية",
      "جنوبية",
      "شرقية",
      "غربية",
      "شمالية غربية",
      "شمالية شرقية",
      "جنوبية غربية",
      "جنوبية شرقية",
    ],
    photoOnYes: true,
  },
  {
    key: "propertyUsage",
    label: "استخدام العقار",
    options: ["سكني", "تجاري", "زراعي", "صناعي"],
    photoOnYes: true,
    shared: true,
  },
  {
    key: "zoneStatus",
    label: "حالة منطقة العقار",
    options: ["غير موقوفة", "موقوفة"],
    photoOnYes: false,
  },
  {
    key: "buildState",
    label: "حالة البناء",
    options: ["جيد", "متوسط", "رديء"],
    photoOnYes: true,
    shared: true,
  },
  {
    key: "occupancyState",
    label: "حالة الإشغال",
    options: ["شاغر", "مشغول"],
    photoOnYes: false,
  },
  {
    key: "districtState",
    label: "حالة الحي",
    options: ["جديد", "متوسط", "قديم"],
    photoOnYes: false,
  },
  {
    key: "movables",
    label: "يوجد منقولات",
    options: ["نعم", "لا"],
    photoOnYes: true,
  },
  {
    key: "carEntrance",
    label: "مدخل السيارة",
    options: ["نعم", "لا"],
    photoOnYes: true,
  },
  {
    key: "hasBasement",
    label: "يوجد قبو",
    options: ["نعم", "لا"],
    photoOnYes: true,
  },
  {
    key: "hasElevator",
    label: "يوجد مصعد",
    options: ["نعم", "لا"],
    photoOnYes: true,
  },
  {
    key: "hasPool",
    label: "يوجد مسبح",
    options: ["نعم", "لا"],
    photoOnYes: true,
  },
  {
    key: "hasFence",
    label: "يوجد سور",
    options: ["نعم", "لا"],
    photoOnYes: true,
  },
  {
    key: "hasCentralAc",
    label: "تكييف مركزي",
    options: ["نعم", "لا"],
    photoOnYes: true,
  },
  {
    key: "hasTanks",
    label: "خزانات",
    options: ["نعم", "لا"],
    photoOnYes: true,
  },
  {
    key: "hasLandscaping",
    label: "تشجير",
    options: ["نعم", "لا"],
    photoOnYes: true,
  },
  {
    key: "kitchen",
    label: "مطبخ",
    options: ["نعم", "لا"],
    photoOnYes: true,
  },
];

/** Building-only inspector rows — hidden on vacant land. */
export const LAND_HIDDEN_INSPECTOR_FEATURE_KEYS = [
  "facade",
  "buildState",
  "occupancyState",
  "carEntrance",
  "hasBasement",
  "hasElevator",
  "hasPool",
  "hasCentralAc",
  "hasTanks",
  "hasLandscaping",
  "kitchen",
] as const;

const LAND_HIDDEN_FEATURE_KEY_SET = new Set<string>(
  LAND_HIDDEN_INSPECTOR_FEATURE_KEYS,
);

const SHOP_SUBJECT_RE = /محل\s*تجار|\bshop\b/i;

/** Vacant land: PO type/classification, inspector origin, or vacant-land checkbox. */
export function isLandInspectionContext(input: {
  classification?: string | null;
  propertyType?: string | null;
  assetSubject?: string | null;
  vacantLand?: boolean;
}): boolean {
  if (input.vacantLand) return true;
  return [input.assetSubject, input.classification, input.propertyType].some(
    (value) => textLooksLikeVacantLand(value),
  );
}

/** Drop leftover building-only values/photos so they cannot fail validation. */
export function sanitizeInspectorDraftForLand(
  draft: InspectorWorkspaceDraft,
  options?: { classification?: string | null; propertyType?: string | null },
): InspectorWorkspaceDraft {
  if (
    !isLandInspectionContext({
      vacantLand: draft.vacantLand,
      assetSubject: draft.featureValues.assetSubject,
      classification: options?.classification,
      propertyType: options?.propertyType,
    })
  ) {
    return draft;
  }

  const featureValues = { ...draft.featureValues };
  const featurePhotoAttachments = { ...draft.featurePhotoAttachments };
  let changed = false;
  for (const key of LAND_HIDDEN_INSPECTOR_FEATURE_KEYS) {
    if (featureValues[key]) {
      featureValues[key] = "";
      changed = true;
    }
    if (featurePhotoAttachments[key]) {
      delete featurePhotoAttachments[key];
      changed = true;
    }
  }
  if (featureValues[OCCUPANCY_DESCRIPTION_KEY]) {
    featureValues[OCCUPANCY_DESCRIPTION_KEY] = "";
    changed = true;
  }
  if (!changed) return draft;
  return { ...draft, featureValues, featurePhotoAttachments };
}

/** Residential / villa component rows — hidden for commercial shops. */
export const SHOP_HIDDEN_INSPECTOR_COMPONENT_KEYS = [
  "roomCount",
  "hallCount",
  "unitCount",
  "wellCount",
  "towerCount",
  "jacuzziCount",
  "diningCount",
  "majlisCount",
  "maidRoomCount",
  "guardRoomCount",
  "playgroundCount",
  "hasAnnex",
] as const;

const SHOP_HIDDEN_COMPONENT_KEY_SET = new Set<string>(
  SHOP_HIDDEN_INSPECTOR_COMPONENT_KEYS,
);

/** Commercial shop: PO type/classification or subject-asset shop. Land wins. */
export function isCommercialShopInspectionContext(input: {
  classification?: string | null;
  propertyType?: string | null;
  assetSubject?: string | null;
  vacantLand?: boolean;
}): boolean {
  if (isLandInspectionContext(input)) return false;
  return [input.assetSubject, input.classification, input.propertyType].some(
    (value) => Boolean(value && SHOP_SUBJECT_RE.test(value)),
  );
}

export function isShopHiddenInspectorComponentKey(key: string): boolean {
  return SHOP_HIDDEN_COMPONENT_KEY_SET.has(key);
}

export function isLandHiddenInspectorFeatureKey(key: string): boolean {
  return LAND_HIDDEN_FEATURE_KEY_SET.has(key);
}

/**
 * Feature keys retired from the inspector screen (Field Inspection Workspace
 * design). Kept on the draft model because the valuation report and the Infath
 * upload still read them for previously-captured inspections.
 */
export const RETIRED_INSPECTOR_FEATURE_KEYS = new Set<string>([
  "hasFence",
  "hasCentralAc",
  "hasTanks",
  "hasLandscaping",
  "zoneStatus",
]);

/** Retired for the field inspector — shown again in case-study specialist appraisal. */
export const CASE_STUDY_SPECIALIST_FEATURE_KEYS = ["zoneStatus"] as const;

export type InspectorFeatureFieldVisibilityOptions = {
  includeRetiredKeys?: readonly string[];
};

export function visibleInspectorFeatureFields(
  isLand: boolean,
  options?: InspectorFeatureFieldVisibilityOptions,
): InspectorFeatureField[] {
  const includeRetired = new Set(options?.includeRetiredKeys ?? []);
  return INSPECTOR_FEATURE_FIELDS.filter(
    (field) =>
      (includeRetired.has(field.key) ||
        !RETIRED_INSPECTOR_FEATURE_KEYS.has(field.key)) &&
      (!isLand || !isLandHiddenInspectorFeatureKey(field.key)),
  );
}


export const INSPECTOR_SERVICE_OPTIONS = [
  "كهرباء",
  "ماء",
  "صرف صحي",
  "هاتف / اتصالات",
  "سفلتة",
  "إنارة",
] as const;

/** Specialist must attach proof from transaction photos when these services are selected. */
export const SPECIALIST_PROOF_SERVICES = ["كهرباء", "ماء"] as const;

export type SpecialistProofService = (typeof SPECIALIST_PROOF_SERVICES)[number];

export function isSpecialistProofService(
  label: string,
): label is SpecialistProofService {
  return (SPECIALIST_PROOF_SERVICES as readonly string[]).includes(label);
}

export const INSPECTOR_AMENITY_OPTIONS = [
  "مدارس",
  "مستشفيات",
  "مساجد",
  "أسواق تجارية",
  "طرق رئيسية",
  "حدائق",
  "مرفق أمني",
  "مقر حكومي",
] as const;

export const INSPECTOR_OBSERVATION_CATEGORIES = [
  "عيب ظاهر",
  "ميزة",
  "حالة البناء",
  "المحيط والجوار",
  "الخدمات",
  "الحدود",
  "أخرى",
] as const;

/** Slot stored in `definedPhotos` keyed by `service:…` / `amenity:…`. */
export type ServiceAmenityPhotoKind = "service" | "amenity";

export type ServiceAmenityPhotoSlotDef = {
  id: string;
  kind: ServiceAmenityPhotoKind;
  label: string;
};

export function serviceAmenityPhotoSlotId(
  kind: ServiceAmenityPhotoKind,
  label: string,
): string {
  return `${kind}:${label}`;
}

/** Visible slots = currently selected services + amenities (mirror of chips). */
export function listServiceAmenityPhotoSlots(draft: {
  services: string[];
  amenities: string[];
}): ServiceAmenityPhotoSlotDef[] {
  const out: ServiceAmenityPhotoSlotDef[] = [];
  for (const label of draft.services) {
    const trimmed = label.trim();
    if (!trimmed) continue;
    out.push({
      id: serviceAmenityPhotoSlotId("service", trimmed),
      kind: "service",
      label: trimmed,
    });
  }
  for (const label of draft.amenities) {
    const trimmed = label.trim();
    if (!trimmed) continue;
    out.push({
      id: serviceAmenityPhotoSlotId("amenity", trimmed),
      kind: "amenity",
      label: trimmed,
    });
  }
  return out;
}

/** Electricity / water proof slots — case-study specialist picks from transaction photos. */
export function listSpecialistProofServicePhotoSlots(draft: {
  services: string[];
}): ServiceAmenityPhotoSlotDef[] {
  const out: ServiceAmenityPhotoSlotDef[] = [];
  for (const label of SPECIALIST_PROOF_SERVICES) {
    if (!draft.services.includes(label)) continue;
    out.push({
      id: serviceAmenityPhotoSlotId("service", label),
      kind: "service",
      label,
    });
  }
  return out;
}

export function isServiceAmenityPhotoSlotComplete(
  slot: InspectorDefinedPhotoSlot | undefined,
): boolean {
  if (!slot) return false;
  if (slot.none) return true;
  return slot.photos.some((photo) => photo.approved && photo.fileName.trim());
}

export type InspectorFreePhotoCategory = {
  key: string;
  label: string;
  icon: string;
};

/** Categories for residual free-photo tagging. */
export const INSPECTOR_FREE_PHOTO_CATEGORIES: InspectorFreePhotoCategory[] = [
  { key: "service", label: "خدمة", icon: "ti-plug" },
  { key: "amenity", label: "مرفق", icon: "ti-map-pin" },
  { key: "other", label: "أخرى", icon: "ti-photo" },
];

export type InspectorComponentPhotoKey = "showroom" | "well";

export type InspectorComponentPhotoAttachments = Record<
  InspectorComponentPhotoKey,
  InspectorPhotoAttachment | null
>;

function emptyComponentPhotoAttachments(): InspectorComponentPhotoAttachments {
  return { showroom: null, well: null };
}

export type InspectorWorkspaceDraft = {
  taskId: string;
  propertyId: string;
  poNumber: string;
  propertyDisplayId: string;
  inspectionDate: string;
  inspectionTime: string;
  mapLatitude: string;
  mapLongitude: string;
  /**
   * First (and latest) field pin set by the inspector.
   * Specialist edits change mapLatitude/Longitude only so this can be restored.
   */
  inspectorMapLatitude: string;
  inspectorMapLongitude: string;
  featureValues: Record<string, string>;
  featurePhotoAttachments: Record<string, InspectorPhotoAttachment | null>;
  componentPhotoAttachments: InspectorComponentPhotoAttachments;
  streetName: string;
  mainStreetName: string;
  streetWidthM: string;
  /** Composed Infath free-text from access contact fields. */
  accessRouteDescription: string;
  accessContactName: string;
  accessContactPhone: string;
  accessContactRole: string;
  roomCount: string;
  hallCount: string;
  unitCount: string;
  bathroomCount: string;
  showroomCount: string;
  wellCount: string;
  towerCount: string;
  builtArea: string;
  buildingFloors: string;
  basementTotal: string;
  annexTotal: string;
  annexUpperCount: string;
  annexGroundCount: string;
  buildingsTotal: string;
  propertyAgeYears: string;
  buildLicenseNumber: string;
  /** Building-permit date — free text (Hijri or Gregorian). */
  buildLicenseDate: string;
  /** checklist — is the site vacant land */
  vacantLand: boolean;
  /** Derived from reviewer delivery — updated on submit */
  keyAvailable: boolean;
  /** Client acknowledgment signature */
  clientDeclarationSigned: boolean;
  /** Client mobile collected before acknowledgment — do not re-lock after delete */
  declarationPhoneSatisfied: boolean;
  hasAnnex: "" | "نعم" | "لا";
  jacuzziCount: string;
  diningCount: string;
  majlisCount: string;
  maidRoomCount: string;
  guardRoomCount: string;
  parkingCount: string;
  playgroundCount: string;
  storeCount: string;
  electricityMeterCount: string;
  electricityMeterNumbers: string;
  waterMeterCount: string;
  waterMeterNumbers: string;
  hasViolations: "" | "نعم" | "لا";
  violationsCount: string;
  violationsDescription: string;
  boundaryMatches: Record<InspectorBoundaryKey, InspectorBoundaryMatch>;
  services: string[];
  amenities: string[];
  propertyDescription: string;
  districtProsCons: string;
  assetNotes: string;
  /**
   * Photo slots for services/amenities: keys `service:electricity`, `amenity:mosques`.
   * Slot appears only when the chip is selected.
   */
  definedPhotos: Record<string, InspectorDefinedPhotoSlot>;
  freePhotos: InspectorFreePhoto[];
  observations: InspectorObservation[];
  inspectionConfirmed: boolean;
  status: InspectorWorkspaceStatus;
  returnNote?: string;
  submittedAtUtc: string | null;
  /** Specialist acceptance stamp — gates package into Infath. */
  acceptedAtUtc?: string | null;
  acceptedByName?: string | null;
  updatedAtUtc: string;
};

export function patchAccessContact(
  draft: Pick<
    InspectorWorkspaceDraft,
    | "accessContactName"
    | "accessContactPhone"
    | "accessContactRole"
    | "accessRouteDescription"
  >,
  patch: Partial<{
    accessContactName: string;
    accessContactPhone: string;
    accessContactRole: string;
  }>,
): Pick<
  InspectorWorkspaceDraft,
  | "accessContactName"
  | "accessContactPhone"
  | "accessContactRole"
  | "accessRouteDescription"
> {
  const next = {
    accessContactName: patch.accessContactName ?? draft.accessContactName,
    accessContactPhone: patch.accessContactPhone ?? draft.accessContactPhone,
    accessContactRole: patch.accessContactRole ?? draft.accessContactRole,
  };
  return {
    ...next,
    accessRouteDescription: composeAccessRouteDescription({
      name: next.accessContactName,
      phone: next.accessContactPhone,
      role: next.accessContactRole,
    }),
  };
}

function emptyDefinedPhotos(): Record<string, InspectorDefinedPhotoSlot> {
  return {};
}

function emptyBoundaryMatches(): Record<
  InspectorBoundaryKey,
  InspectorBoundaryMatch
> {
  return {
    north: { matches: true, mismatchNote: "", facade: "" },
    south: { matches: true, mismatchNote: "", facade: "" },
    east: { matches: true, mismatchNote: "", facade: "" },
    west: { matches: true, mismatchNote: "", facade: "" },
  };
}

/** Local calendar date + clock when the inspector first opens the assignment. */
export function inspectionStampFromNow(now = new Date()): {
  inspectionDate: string;
  inspectionTime: string;
} {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return {
    inspectionDate: `${y}-${m}-${d}`,
    inspectionTime: `${hh}:${mm}`,
  };
}

export function createInspectorWorkspaceDraft(input: {
  taskId: string;
  propertyId: string;
  poNumber: string;
  propertyDisplayId?: string;
}): InspectorWorkspaceDraft {
  const stamp = inspectionStampFromNow();
  const { latitude, longitude } = jeddahDefaultCoords();
  return {
    taskId: input.taskId,
    propertyId: input.propertyId,
    poNumber: input.poNumber,
    propertyDisplayId: input.propertyDisplayId?.trim() ?? "",
    inspectionDate: stamp.inspectionDate,
    inspectionTime: stamp.inspectionTime,
    mapLatitude: latitude,
    mapLongitude: longitude,
    inspectorMapLatitude: "",
    inspectorMapLongitude: "",
    featureValues: {},
    featurePhotoAttachments: {},
    componentPhotoAttachments: emptyComponentPhotoAttachments(),
    streetName: "",
    mainStreetName: "",
    streetWidthM: "",
    accessRouteDescription: "",
    accessContactName: "",
    accessContactPhone: "",
    accessContactRole: "",
    roomCount: "",
    hallCount: "",
    unitCount: "",
    bathroomCount: "",
    showroomCount: "",
    wellCount: "",
    towerCount: "",
    builtArea: "",
    buildingFloors: "",
    basementTotal: "",
    annexTotal: "",
    annexUpperCount: "",
    annexGroundCount: "",
    buildingsTotal: "",
    propertyAgeYears: "",
    buildLicenseNumber: "",
    buildLicenseDate: "",
    vacantLand: false,
    keyAvailable: false,
    clientDeclarationSigned: false,
    declarationPhoneSatisfied: false,
    hasAnnex: "",
    jacuzziCount: "",
    diningCount: "",
    majlisCount: "",
    maidRoomCount: "",
    guardRoomCount: "",
    parkingCount: "",
    playgroundCount: "",
    storeCount: "",
    electricityMeterCount: "",
    electricityMeterNumbers: "",
    waterMeterCount: "",
    waterMeterNumbers: "",
    hasViolations: "",
    violationsCount: "",
    violationsDescription: "",
    boundaryMatches: emptyBoundaryMatches(),
    services: [],
    amenities: [],
    propertyDescription: "",
    districtProsCons: "",
    assetNotes: "",
    definedPhotos: emptyDefinedPhotos(),
    freePhotos: [],
    observations: [],
    inspectionConfirmed: false,
    status: "draft",
    submittedAtUtc: null,
    updatedAtUtc: new Date().toISOString(),
  };
}

export function isInspectorWorkspaceLocked(
  status: InspectorWorkspaceStatus,
): boolean {
  return status === "submitted";
}

/** True when a specialist stamped acceptance on the submitted package. */
export function isInspectorWorkspaceAccepted(
  draft: Pick<InspectorWorkspaceDraft, "acceptedAtUtc"> | null | undefined,
): boolean {
  const stamp = draft?.acceptedAtUtc;
  return typeof stamp === "string" && stamp.trim().length > 0;
}

export function inspectorWorkspaceStatusLabel(
  status: InspectorWorkspaceStatus,
  options?: { accepted?: boolean },
): string {
  if (status === "submitted" && options?.accepted) return "معتمد";
  if (status === "submitted") return "مُرسَل — بانتظار الاعتماد";
  if (status === "reopened") return "معادة للتصحيح";
  return "قيد العمل";
}

export function nextInspectorPhotoId(draft: InspectorWorkspaceDraft): number {
  let max = 0;
  for (const slot of Object.values(draft.definedPhotos)) {
    for (const photo of slot.photos) max = Math.max(max, photo.id);
  }
  for (const photo of draft.freePhotos) max = Math.max(max, photo.id);
  return max + 1;
}

/** @deprecated Prefer buildEvidenceStampLines after EXIF extract. Kept for call sites. */
export function inspectorPhotoStampText(
  draft: InspectorWorkspaceDraft,
  deedNumber?: string | null,
): string {
  const deed = deedNumber?.trim() || draft.propertyDisplayId.trim();
  const when = [draft.inspectionDate, draft.inspectionTime]
    .filter(Boolean)
    .join(" ");
  const coords =
    draft.mapLatitude.trim() && draft.mapLongitude.trim()
      ? `${draft.mapLatitude.trim()}, ${draft.mapLongitude.trim()}`
      : "";
  return [deed ? `صك ${deed}` : "", coords, when].filter(Boolean).join("\n");
}

export type InspectorMapActor = "inspector" | "specialist";

export function hasInspectorOriginalMapPin(
  draft: Pick<
    InspectorWorkspaceDraft,
    "inspectorMapLatitude" | "inspectorMapLongitude"
  >,
): boolean {
  return Boolean(
    draft.inspectorMapLatitude.trim() && draft.inspectorMapLongitude.trim(),
  );
}

export function activeMapDiffersFromInspectorOriginal(
  draft: InspectorWorkspaceDraft,
): boolean {
  if (!hasInspectorOriginalMapPin(draft)) return false;
  return (
    draft.mapLatitude.trim() !== draft.inspectorMapLatitude.trim() ||
    draft.mapLongitude.trim() !== draft.inspectorMapLongitude.trim()
  );
}

/**
 * Apply a new active map pin. Inspector updates also refresh the preserved original.
 * Specialist updates leave the original intact for restore.
 */
export function mapPinPatchForActor(
  draft: InspectorWorkspaceDraft,
  nextLat: string,
  nextLng: string,
  actor: InspectorMapActor,
): Partial<
  Pick<
    InspectorWorkspaceDraft,
    | "mapLatitude"
    | "mapLongitude"
    | "inspectorMapLatitude"
    | "inspectorMapLongitude"
  >
> {
  const lat = nextLat.trim();
  const lng = nextLng.trim();
  const patch: Partial<
    Pick<
      InspectorWorkspaceDraft,
      | "mapLatitude"
      | "mapLongitude"
      | "inspectorMapLatitude"
      | "inspectorMapLongitude"
    >
  > = {
    mapLatitude: lat,
    mapLongitude: lng,
  };
  if (actor === "inspector" && lat && lng) {
    patch.inspectorMapLatitude = lat;
    patch.inspectorMapLongitude = lng;
  }
  return patch;
}

export function restoreInspectorOriginalMapPin(
  draft: InspectorWorkspaceDraft,
): Partial<Pick<InspectorWorkspaceDraft, "mapLatitude" | "mapLongitude">> | null {
  if (!hasInspectorOriginalMapPin(draft)) return null;
  return {
    mapLatitude: draft.inspectorMapLatitude.trim(),
    mapLongitude: draft.inspectorMapLongitude.trim(),
  };
}

/** Ensure submit snapshot keeps an inspector original when the active pin exists. */
export function ensureInspectorOriginalMapOnSubmit(
  draft: InspectorWorkspaceDraft,
): InspectorWorkspaceDraft {
  if (hasInspectorOriginalMapPin(draft)) return draft;
  const lat = draft.mapLatitude.trim();
  const lng = draft.mapLongitude.trim();
  if (!lat || !lng) return draft;
  return {
    ...draft,
    inspectorMapLatitude: lat,
    inspectorMapLongitude: lng,
  };
}

export function computeInspectorPhotoCoverage(
  draft: InspectorWorkspaceDraft,
  slotDefs?: ServiceAmenityPhotoSlotDef[],
): {
  requiredTotal: number;
  requiredDone: number;
  pendingApproval: number;
} {
  const slots = slotDefs ?? listServiceAmenityPhotoSlots(draft);
  const requiredTotal = slots.length;
  const requiredDone = slots.filter((def) =>
    isServiceAmenityPhotoSlotComplete(draft.definedPhotos[def.id]),
  ).length;

  let pendingApproval = 0;
  for (const def of slots) {
    const slot = draft.definedPhotos[def.id];
    if (!slot) continue;
    pendingApproval += slot.photos.filter((photo) => !photo.approved).length;
  }

  return { requiredTotal, requiredDone, pendingApproval };
}

export function inspectorPhotoCoverageLabel(draft: InspectorWorkspaceDraft): string {
  const { requiredTotal, requiredDone, pendingApproval } =
    computeInspectorPhotoCoverage(draft);

  if (requiredTotal === 0) {
    return "اختر خدمات/مرافق أولاً";
  }

  let label = `${requiredDone}/${requiredTotal} موثّق`;
  if (pendingApproval > 0) {
    label += ` · ${pendingApproval} بانتظار الاعتماد`;
  }
  return label;
}

export function parseInspectorCount(value: string): number {
  const n = Number.parseInt(value.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Parses a non-negative area in m² from inspector text input. */
export function parseInspectorAreaSqm(value: string): number {
  const trimmed = value.trim().replace(/,/g, "");
  if (!trimmed) return 0;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** buildingsTotal = builtArea + basementTotal + annexTotal */
export function computeBuildingsTotalSqm(
  builtArea: string,
  basementTotal: string,
  annexTotal: string,
): string {
  const hasInput = [builtArea, basementTotal, annexTotal].some(
    (v) => v.trim().length > 0,
  );
  if (!hasInput) return "";
  const sum =
    parseInspectorAreaSqm(builtArea) +
    parseInspectorAreaSqm(basementTotal) +
    parseInspectorAreaSqm(annexTotal);
  if (!Number.isFinite(sum)) return "";
  if (Number.isInteger(sum)) return String(sum);
  return String(Math.round(sum * 100) / 100);
}

export function inspectorFeatureRequiresPhoto(
  field: InspectorFeatureField,
  value: string,
): boolean {
  if (!field.photoOnYes) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (field.options.includes("نعم")) return trimmed === "نعم";
  return true;
}

export function listInspectorPhotoValidationIssues(
  draft: InspectorWorkspaceDraft,
  options?: {
    isLand?: boolean;
    isShop?: boolean;
    classification?: string | null;
    propertyType?: string | null;
    /** Case-study specialist: only كهرباء/ماء proof from transaction photos. */
    specialistProofServicesOnly?: boolean;
  },
): string[] {
  const issues: string[] = [];
  const isLand =
    Boolean(options?.isLand) ||
    isLandInspectionContext({
      vacantLand: draft.vacantLand,
      assetSubject: draft.featureValues.assetSubject,
      classification: options?.classification,
      propertyType: options?.propertyType,
    });
  const isShop =
    Boolean(options?.isShop) ||
    isCommercialShopInspectionContext({
      vacantLand: draft.vacantLand,
      assetSubject: draft.featureValues.assetSubject,
      classification: options?.classification,
      propertyType: options?.propertyType,
    });
  const featureFields = visibleInspectorFeatureFields(isLand);

  for (const field of featureFields) {
    if (isLand && isLandHiddenInspectorFeatureKey(field.key)) continue;
    const value = draft.featureValues[field.key] ?? "";
    if (
      inspectorFeatureRequiresPhoto(field, value) &&
      !draft.featurePhotoAttachments[field.key]?.attachmentId
    ) {
      issues.push(`يجب إرفاق صورة توثيقية: ${field.label}`);
    }
  }

  if (
    !isLand &&
    parseInspectorCount(draft.showroomCount) > 0 &&
    !draft.componentPhotoAttachments.showroom?.attachmentId
  ) {
    issues.push("يجب إرفاق صورة المعرض");
  }

  if (
    !isLand &&
    !isShop &&
    parseInspectorCount(draft.wellCount) > 0 &&
    !draft.componentPhotoAttachments.well?.attachmentId
  ) {
    issues.push("يجب إرفاق صورة البئر");
  }

  const proofSlots = options?.specialistProofServicesOnly
    ? listSpecialistProofServicePhotoSlots(draft)
    : undefined;

  const { requiredTotal, requiredDone, pendingApproval } =
    computeInspectorPhotoCoverage(draft, proofSlots);
  if (requiredDone < requiredTotal) {
    issues.push(
      options?.specialistProofServicesOnly
        ? "اختر صورة إثبات من صور المعاملة لكل خدمة (كهرباء / ماء) محددة"
        : "وثّق بالصورة كل خدمة/مرفق اخترته في «الخدمات والمرافق المحيطة»",
    );
  }
  if (pendingApproval > 0) {
    issues.push(`${pendingApproval} صورة بانتظار الاعتماد`);
  }

  const untagged = draft.freePhotos.filter((photo) => !photo.category).length;
  if (!options?.specialistProofServicesOnly && untagged > 0) {
    issues.push(`${untagged} صورة إضافية بحاجة لتعريف`);
  }

  const hasLocalOnly = Object.values(draft.definedPhotos).some((slot) =>
    slot.photos.some((p) => p.fileName && !p.attachmentId),
  );
  if (hasLocalOnly) {
    issues.push("يجب رفع الصور إلى الخادم قبل الإرسال");
  }

  return issues;
}

export function newObservationId(): string {
  return `obs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
