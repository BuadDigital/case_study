/** Inspector workspace draft — replaces legacy FieldInspectionSubmission. */

export type InspectorWorkspaceStatus = "draft" | "submitted" | "reopened";

export type InspectorBoundaryKey = "north" | "south" | "east" | "west";

export type InspectorBoundaryMatch = {
  matches: boolean;
  mismatchNote: string;
};

import { jeddahDefaultCoords } from "@engineering-office/mfe/lib/jeddah-default-coords";

export type InspectorPhotoAttachment = {
  fileName: string;
  mimeType: string;
  attachmentId?: string;
  sizeBytes?: number;
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
};

export type InspectorDefinedPhotoSlot = {
  none: boolean;
  photos: InspectorSlotPhoto[];
};

export type InspectorFreePhoto = {
  id: number;
  category: string | null;
  approved: boolean;
  fileName: string;
  mimeType: string;
  attachmentId?: string;
  sizeBytes?: number;
};

export type InspectorFeatureField = {
  key: string;
  label: string;
  options: readonly string[];
  photoOnYes: boolean;
  shared?: boolean;
};

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
    options: ["شمال", "جنوب", "شرق", "غرب"],
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
    key: "kitchen",
    label: "مطبخ",
    options: ["نعم", "لا"],
    photoOnYes: true,
  },
];

export const INSPECTOR_SERVICE_OPTIONS = [
  "كهرباء",
  "ماء",
  "صرف صحي",
  "هاتف / اتصالات",
  "سفلتة",
  "إنارة",
] as const;

export const INSPECTOR_AMENITY_OPTIONS = [
  "مدارس",
  "مستشفيات",
  "مساجد",
  "أسواق تجارية",
  "طرق رئيسية",
  "حدائق",
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

export type InspectorDefinedPhotoDef = {
  id: string;
  name: string;
  icon: string;
  required: boolean;
  annexOnly?: boolean;
};

export const INSPECTOR_DEFINED_PHOTOS: InspectorDefinedPhotoDef[] = [
  { id: "front", name: "الواجهة الأمامية", icon: "ti-building", required: true },
  { id: "sides", name: "الجهات الأخرى", icon: "ti-box-multiple", required: true },
  { id: "water", name: "عداد المياه", icon: "ti-droplet", required: true },
  { id: "elec", name: "عداد الكهرباء", icon: "ti-bolt", required: true },
  { id: "inside", name: "من الداخل", icon: "ti-home", required: true },
  { id: "floor", name: "الأرضيات", icon: "ti-grid-dots", required: false },
  {
    id: "annexup",
    name: "ملحق علوي",
    icon: "ti-stairs-up",
    required: true,
    annexOnly: true,
  },
  {
    id: "annexdn",
    name: "ملحق سفلي",
    icon: "ti-stairs-down",
    required: true,
    annexOnly: true,
  },
];

export type InspectorFreePhotoCategory = {
  key: string;
  label: string;
  icon: string;
};

export const INSPECTOR_FREE_PHOTO_CATEGORIES: InspectorFreePhotoCategory[] = [
  { key: "main", label: "رئيسية", icon: "ti-home" },
  { key: "front", label: "الواجهة", icon: "ti-building" },
  { key: "water", label: "عداد الماء", icon: "ti-droplet" },
  { key: "elec", label: "عداد الكهرباء", icon: "ti-bolt" },
  { key: "inside", label: "من الداخل", icon: "ti-door" },
  { key: "floor", label: "الأرضيات", icon: "ti-grid-dots" },
  { key: "annexu", label: "ملحق علوي", icon: "ti-stairs-up" },
  { key: "annexd", label: "ملحق سفلي", icon: "ti-stairs-down" },
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
  featureValues: Record<string, string>;
  featurePhotoAttachments: Record<string, InspectorPhotoAttachment | null>;
  componentPhotoAttachments: InspectorComponentPhotoAttachments;
  streetName: string;
  mainStreetName: string;
  streetWidthM: string;
  accessRouteDescription: string;
  roomCount: string;
  hallCount: string;
  unitCount: string;
  bathroomCount: string;
  showroomCount: string;
  wellCount: string;
  propertyAgeYears: string;
  buildLicenseNumber: string;
  hasAnnex: "" | "نعم" | "لا";
  boundaryMatches: Record<InspectorBoundaryKey, InspectorBoundaryMatch>;
  services: string[];
  amenities: string[];
  propertyDescription: string;
  districtProsCons: string;
  assetNotes: string;
  definedPhotos: Record<string, InspectorDefinedPhotoSlot>;
  freePhotos: InspectorFreePhoto[];
  observations: InspectorObservation[];
  inspectionConfirmed: boolean;
  status: InspectorWorkspaceStatus;
  returnNote?: string;
  submittedAtUtc: string | null;
  updatedAtUtc: string;
};

function emptyDefinedPhotos(): Record<string, InspectorDefinedPhotoSlot> {
  const out: Record<string, InspectorDefinedPhotoSlot> = {};
  for (const slot of INSPECTOR_DEFINED_PHOTOS) {
    out[slot.id] = { none: false, photos: [] };
  }
  return out;
}

function emptyBoundaryMatches(): Record<
  InspectorBoundaryKey,
  InspectorBoundaryMatch
> {
  return {
    north: { matches: true, mismatchNote: "" },
    south: { matches: true, mismatchNote: "" },
    east: { matches: true, mismatchNote: "" },
    west: { matches: true, mismatchNote: "" },
  };
}

export function createInspectorWorkspaceDraft(input: {
  taskId: string;
  propertyId: string;
  poNumber: string;
  propertyDisplayId?: string;
}): InspectorWorkspaceDraft {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const { latitude, longitude } = jeddahDefaultCoords();
  return {
    taskId: input.taskId,
    propertyId: input.propertyId,
    poNumber: input.poNumber,
    propertyDisplayId: input.propertyDisplayId?.trim() ?? "",
    inspectionDate: today,
    inspectionTime: "10:30",
    mapLatitude: latitude,
    mapLongitude: longitude,
    featureValues: {},
    featurePhotoAttachments: {},
    componentPhotoAttachments: emptyComponentPhotoAttachments(),
    streetName: "",
    mainStreetName: "",
    streetWidthM: "",
    accessRouteDescription: "",
    roomCount: "",
    hallCount: "",
    unitCount: "",
    bathroomCount: "",
    showroomCount: "",
    wellCount: "",
    propertyAgeYears: "",
    buildLicenseNumber: "",
    hasAnnex: "",
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
    updatedAtUtc: now,
  };
}

export function isInspectorWorkspaceLocked(
  status: InspectorWorkspaceStatus,
): boolean {
  return status === "submitted";
}

export function inspectorWorkspaceStatusLabel(
  status: InspectorWorkspaceStatus,
): string {
  if (status === "submitted") return "مُرسَل";
  if (status === "reopened") return "مُعاد للتصحيح";
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

export function inspectorPhotoStampText(draft: InspectorWorkspaceDraft): string {
  const when = [draft.inspectionDate, draft.inspectionTime]
    .filter(Boolean)
    .join(" ");
  const coords =
    draft.mapLatitude.trim() && draft.mapLongitude.trim()
      ? ` · ${draft.mapLatitude.trim()}, ${draft.mapLongitude.trim()}`
      : "";
  return `${when}${coords}`.trim();
}

export function computeInspectorPhotoCoverage(draft: InspectorWorkspaceDraft): {
  requiredTotal: number;
  requiredDone: number;
  pendingApproval: number;
} {
  const showAnnex = draft.hasAnnex === "نعم";
  const required = INSPECTOR_DEFINED_PHOTOS.filter(
    (def) => def.required && (!def.annexOnly || showAnnex),
  );
  const requiredDone = required.filter((def) => {
    const slot = draft.definedPhotos[def.id];
    if (!slot) return false;
    if (slot.none) return true;
    return slot.photos.some((photo) => photo.approved);
  }).length;

  let pendingApproval = 0;
  for (const slot of Object.values(draft.definedPhotos)) {
    pendingApproval += slot.photos.filter((photo) => !photo.approved).length;
  }
  for (const photo of draft.freePhotos) {
    if (photo.category && !photo.approved) pendingApproval++;
  }

  return { requiredTotal: required.length, requiredDone, pendingApproval };
}

export function inspectorPhotoCoverageLabel(draft: InspectorWorkspaceDraft): string {
  const { requiredTotal, requiredDone, pendingApproval } =
    computeInspectorPhotoCoverage(draft);
  let label = `${requiredDone}/${requiredTotal} مكتمل`;
  if (pendingApproval > 0) {
    label += ` · ${pendingApproval} بانتظار الاعتماد`;
  }
  return label;
}

export function parseInspectorCount(value: string): number {
  const n = Number.parseInt(value.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
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
): string[] {
  const issues: string[] = [];

  for (const field of INSPECTOR_FEATURE_FIELDS) {
    const value = draft.featureValues[field.key] ?? "";
    if (
      inspectorFeatureRequiresPhoto(field, value) &&
      !draft.featurePhotoAttachments[field.key]?.fileName
    ) {
      issues.push(`يجب إرفاق صورة توثيقية: ${field.label}`);
    }
  }

  if (
    parseInspectorCount(draft.showroomCount) > 0 &&
    !draft.componentPhotoAttachments.showroom?.fileName
  ) {
    issues.push("يجب إرفاق صورة المعرض");
  }
  if (
    parseInspectorCount(draft.wellCount) > 0 &&
    !draft.componentPhotoAttachments.well?.fileName
  ) {
    issues.push("يجب إرفاق صورة البئر");
  }

  const { requiredTotal, requiredDone, pendingApproval } =
    computeInspectorPhotoCoverage(draft);
  if (requiredDone < requiredTotal) {
    issues.push(
      "أكمل صور العقار الموثّقة المطلوبة (رفع صورة معتمدة أو تفعيل «لا يوجد»)",
    );
  }
  if (pendingApproval > 0) {
    issues.push(`${pendingApproval} صورة بانتظار الاعتماد`);
  }

  const untagged = draft.freePhotos.filter((photo) => !photo.category).length;
  if (untagged > 0) {
    issues.push(`${untagged} صورة إضافية بحاجة لتعريف`);
  }

  return issues;
}

export function newObservationId(): string {
  return `obs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
