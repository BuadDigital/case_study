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

export type ComparableEntryDraft = {
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

export function emptyComparableEntryDraft(seed?: {
  type?: string;
  city?: string;
  district?: string;
  latitude?: string;
  longitude?: string;
}): ComparableEntryDraft {
  return {
    comparablePropertyType: seed?.type ?? "",
    transactionKind: "offer",
    priceDescription: "asking",
    source: "listing_platform",
    listingNumber: "",
    advertiserPhone: "",
    areaSqm: "",
    transactionDate: "",
    price: "",
    city: seed?.city ?? "",
    district: seed?.district ?? "",
    planNumber: "",
    plotNumber: "",
    latitude: seed?.latitude ?? "",
    longitude: seed?.longitude ?? "",
    description: "",
  };
}

export function comparableDtoToDraft(row: ComparablePropertyDto): ComparableEntryDraft {
  return {
    comparablePropertyType: row.comparablePropertyType ?? "",
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

export function comparableDraftToUpsert(
  draft: ComparableEntryDraft,
  extras: {
    intakeChannel: string;
    sourceWorkOrderNumber?: string | null;
    sourcePropertyId?: string | null;
  },
): UpsertComparablePropertyRequest {
  const executed = draft.transactionKind === "executed";
  return {
    comparablePropertyType: draft.comparablePropertyType.trim(),
    transactionKind: draft.transactionKind,
    priceDescription: executed ? null : draft.priceDescription,
    source: draft.source,
    listingNumber: executed ? null : draft.listingNumber.trim() || null,
    transactionReference: executed ? draft.listingNumber.trim() || null : null,
    advertiserPhone: draft.advertiserPhone.trim() || null,
    latitude: Number(draft.latitude.replace(",", ".")) || 0,
    longitude: Number(draft.longitude.replace(",", ".")) || 0,
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
