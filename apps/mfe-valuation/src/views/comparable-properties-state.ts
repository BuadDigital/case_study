/**
 * Pure rules and closed lists behind `ComparablePropertiesView`: the empty
 * intake form, coordinate parsing/formatting and the bank map pins. No React.
 */
import type {
  ComparablePropertyDto,
  UpsertComparablePropertyRequest,
} from "@platform/api-client";
import type { GoogleMapContextPin } from "@platform/ui-kit";

// Q-3/5: closed lists aligned with subject-property lists — no free text.
export const COMPARABLE_TYPE_OPTIONS = [
  "أرض",
  "شقة",
  "فيلا",
  "عمارة",
  "محل تجاري",
  "مستودع",
] as const;

export const COMPARABLE_USAGE_OPTIONS = [
  "سكني",
  "تجاري",
  "صناعي",
  "زراعي",
  "مختلط",
] as const;


export const SAR_FORMAT = new Intl.NumberFormat("ar-SA");

/** Sentinel: no pin yet — user must pick on the map. */
export const UNSET_COORD = Number.NaN;

export function emptyForm(): UpsertComparablePropertyRequest {
  return {
    comparablePropertyType: "",
    usage: "",
    transactionKind: "offer",
    priceDescription: "asking",
    source: "listing_platform",
    listingNumber: "",
    transactionReference: "",
    advertiserPhone: "",
    latitude: UNSET_COORD,
    longitude: UNSET_COORD,
    areaSqm: 0,
    transactionDate: "",
    price: 0,
    city: "",
    district: "",
    description: "",
    intakeChannel: "office",
    isActive: true,
  };
}

export function hasMapPin(form: UpsertComparablePropertyRequest): boolean {
  return Number.isFinite(form.latitude) && Number.isFinite(form.longitude);
}

export function parseLatLngPair(
  raw: string,
): { lat: number; lng: number } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = trimmed.match(
    /^(-?\d+(?:\.\d+)?)\s*[,،]\s*(-?\d+(?:\.\d+)?)$/,
  );
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function formatLatLngPair(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

export function bankContextPins(rows: ComparablePropertyDto[]): GoogleMapContextPin[] {
  return rows
    .filter(
      (r) =>
        r.isActive !== false &&
        Number.isFinite(r.latitude) &&
        Number.isFinite(r.longitude),
    )
    .slice(0, 40)
    .map((r) => ({
      lat: r.latitude,
      lng: r.longitude,
      label: r.comparablePropertyType?.slice(0, 1) || "م",
      title: [
        r.referenceCode,
        r.comparablePropertyType,
        r.district,
        r.price != null ? `${SAR_FORMAT.format(r.price)} ر.س` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    }));
}
