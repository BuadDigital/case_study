import type {
  ComparablePropertyDto,
  UpsertComparablePropertyRequest,
} from "@platform/api-client";

export const COMPARABLE_SOURCE_OPTIONS = [
  { value: "listing_platform", label: "منصة عقارية" },
  { value: "bourse", label: "البورصة العقارية" },
  { value: "field", label: "رصد ميداني" },
  { value: "prior_valuation", label: "تقييم سابق" },
  { value: "other", label: "أخرى" },
] as const;

/** Shared bank kinds — land feeds cost, building feeds market. */
export type ComparableKind = "land" | "building";

export const LAND_COMPARABLE_TYPE = "أرض";
export const BUILDING_COMPARABLE_TYPE = "مبنى";

export type ComparableEntryDraft = {
  kind: ComparableKind | "";
  comparablePropertyType: string;
  transactionKind: "offer" | "executed";
  priceDescription: "asking" | "som";
  source: string;
  listingNumber: string;
  advertiserPhone: string;
  areaSqm: string;
  transactionDate: string;
  price: string;
  city: string;
  district: string;
  planNumber: string;
  plotNumber: string;
  latitude: string;
  longitude: string;
  description: string;
};

export type ComparableSubjectPin = {
  lat: number;
  lng: number;
};

export function parseComparableCoords(
  latitude?: string | null,
  longitude?: string | null,
): ComparableSubjectPin | null {
  const lat = Number.parseFloat((latitude ?? "").replace(",", "."));
  const lng = Number.parseFloat((longitude ?? "").replace(",", "."));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function comparableKindFromType(
  type: string | null | undefined,
): ComparableKind | "" {
  const t = (type ?? "").trim();
  if (!t) return "";
  if (/فيلا|شقة|مبنى|دور|villa|apartment|building/i.test(t)) return "building";
  if (/أرض|ارض|فضاء|land/i.test(t)) return "land";
  return "";
}

export function emptyComparableEntryDraft(): ComparableEntryDraft {
  return {
    kind: "",
    comparablePropertyType: "",
    transactionKind: "offer",
    priceDescription: "asking",
    source: "listing_platform",
    listingNumber: "",
    advertiserPhone: "",
    areaSqm: "",
    transactionDate: "",
    price: "",
    city: "",
    district: "",
    planNumber: "",
    plotNumber: "",
    latitude: "",
    longitude: "",
    description: "",
  };
}

export function comparableDtoToDraft(row: ComparablePropertyDto): ComparableEntryDraft {
  const type = row.comparablePropertyType ?? "";
  return {
    kind: comparableKindFromType(type),
    comparablePropertyType: type,
    transactionKind: row.transactionKind === "executed" ? "executed" : "offer",
    priceDescription: row.priceDescription === "som" ? "som" : "asking",
    source: row.source || "other",
    listingNumber: row.listingNumber ?? row.transactionReference ?? "",
    advertiserPhone: row.advertiserPhone ?? "",
    areaSqm: String(row.areaSqm ?? ""),
    transactionDate: row.transactionDate ?? "",
    price: String(row.price ?? ""),
    city: row.city ?? "",
    district: row.district ?? "",
    planNumber: row.planNumber ?? "",
    plotNumber: row.plotNumber ?? "",
    latitude: String(row.latitude ?? ""),
    longitude: String(row.longitude ?? ""),
    description: row.description ?? "",
  };
}

export function comparableTypeForSave(draft: ComparableEntryDraft): string {
  if (draft.kind === "land") {
    return draft.comparablePropertyType.trim() || LAND_COMPARABLE_TYPE;
  }
  if (draft.kind === "building") {
    return draft.comparablePropertyType.trim() || BUILDING_COMPARABLE_TYPE;
  }
  return draft.comparablePropertyType.trim();
}

export function comparableLocationPinned(draft: ComparableEntryDraft): boolean {
  return parseComparableCoords(draft.latitude, draft.longitude) != null;
}

export function comparablePlaceLine(draft: Pick<ComparableEntryDraft, "city" | "district">): string {
  return [draft.city.trim(), draft.district.trim()].filter(Boolean).join(" · ");
}

function positiveAmount(raw: string): boolean {
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) && n > 0;
}

function hasIsoDate(raw: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw.trim());
}

export type ComparableEntryFieldErrors = Partial<
  Record<
    | "location"
    | "kind"
    | "district"
    | "price"
    | "areaSqm"
    | "transactionDate"
    | "priceDescription"
    | "source",
    string
  >
>;

const COMPARABLE_ENTRY_ERROR_ORDER: {
  key: keyof ComparableEntryFieldErrors;
  targetId: string;
}[] = [
  { key: "location", targetId: "cmp-location" },
  { key: "kind", targetId: "cmp-kind" },
  { key: "district", targetId: "cmp-district" },
  { key: "price", targetId: "cmp-price" },
  { key: "areaSqm", targetId: "cmp-area" },
  { key: "transactionDate", targetId: "cmp-date" },
  { key: "priceDescription", targetId: "cmp-price-description" },
  { key: "source", targetId: "cmp-source" },
];

/** Field-level gates for the add-comparable form (office + field). */
export function validateComparableEntry(
  draft: ComparableEntryDraft,
  locationConfirmed: boolean,
): ComparableEntryFieldErrors {
  const errors: ComparableEntryFieldErrors = {};

  if (!locationConfirmed || !comparableLocationPinned(draft)) {
    errors.location = "ثبّت موقع المقارن على الخريطة";
  } else if (!draft.district.trim()) {
    errors.district = "أدخل اسم الحي (يُستخرج من الخريطة أو يُكتب يدوياً)";
  }

  if (draft.kind !== "land" && draft.kind !== "building") {
    errors.kind = "اختر نوع المقارن (أرض أو مبنى)";
  }

  if (!positiveAmount(draft.price)) {
    errors.price = "أدخل سعراً أكبر من صفر";
  }

  if (!positiveAmount(draft.areaSqm)) {
    errors.areaSqm = "أدخل مساحة أكبر من صفر";
  }

  if (!hasIsoDate(draft.transactionDate)) {
    errors.transactionDate = "حدّد تاريخ العملية";
  }

  if (draft.transactionKind === "offer") {
    if (
      draft.priceDescription !== "asking" &&
      draft.priceDescription !== "som"
    ) {
      errors.priceDescription = "اختر وصف السعر (حد أو سوم)";
    }
  }

  if (!draft.source.trim()) {
    errors.source = "اختر مصدر المعلومة";
  }

  return errors;
}

export function firstComparableEntryError(
  errors: ComparableEntryFieldErrors,
): string | null {
  for (const { key } of COMPARABLE_ENTRY_ERROR_ORDER) {
    const message = errors[key];
    if (message) return message;
  }
  return null;
}

export function firstComparableEntryErrorTarget(
  errors: ComparableEntryFieldErrors,
): string | null {
  for (const { key, targetId } of COMPARABLE_ENTRY_ERROR_ORDER) {
    if (errors[key]) return targetId;
  }
  return null;
}

/** Pin confirmed, kind, price, area, date, and geocoded district. */
export function comparableEntryReady(
  draft: ComparableEntryDraft,
  locationConfirmed: boolean,
): boolean {
  return Object.keys(validateComparableEntry(draft, locationConfirmed)).length === 0;
}

export function comparableDraftToUpsert(
  draft: ComparableEntryDraft,
  extras: {
    intakeChannel: string;
    sourceWorkOrderNumber?: string | null;
    sourcePropertyId?: string | null;
  },
): UpsertComparablePropertyRequest {
  const executed = draft.transactionKind === "executed";
  const coords = parseComparableCoords(draft.latitude, draft.longitude);
  return {
    comparablePropertyType: comparableTypeForSave(draft),
    transactionKind: draft.transactionKind,
    priceDescription: executed ? null : draft.priceDescription,
    source: draft.source,
    listingNumber: executed ? null : draft.listingNumber.trim() || null,
    transactionReference: executed ? draft.listingNumber.trim() || null : null,
    advertiserPhone: draft.advertiserPhone.trim() || null,
    latitude: coords?.lat ?? 0,
    longitude: coords?.lng ?? 0,
    areaSqm: Number(draft.areaSqm.replace(",", ".")) || 0,
    transactionDate: draft.transactionDate,
    price: Number(draft.price.replace(",", ".")) || 0,
    city: draft.city.trim() || null,
    district: draft.district.trim(),
    planNumber: draft.planNumber.trim() || null,
    plotNumber: draft.plotNumber.trim() || null,
    description: draft.description.trim() || null,
    intakeChannel: extras.intakeChannel,
    sourceWorkOrderNumber: extras.sourceWorkOrderNumber ?? null,
    sourcePropertyId: extras.sourcePropertyId ?? null,
  };
}

export function comparableDealLabel(row: Pick<ComparablePropertyDto, "transactionKind" | "priceDescription" | "transactionKindLabelAr" | "priceDescriptionLabelAr">): string {
  if (row.transactionKind === "executed") return row.transactionKindLabelAr || "صفقة منفّذة";
  const price = row.priceDescriptionLabelAr || (row.priceDescription === "som" ? "سوم" : "حد");
  return `عرض ${price}`;
}

export function formatComparableCoords(lat: number, lon: number): string {
  if (!lat && !lon) return "—";
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

export function computedPricePerSqm(price: string, area: string): string {
  const p = Number(price.replace(",", "."));
  const a = Number(area.replace(",", "."));
  if (!a || !p) return "—";
  return (p / a).toFixed(2);
}
