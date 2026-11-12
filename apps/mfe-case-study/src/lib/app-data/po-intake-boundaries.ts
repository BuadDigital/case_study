/** PO intake — property boundary fields, geo/map helpers. */

export {
  PROPERTY_BOUNDARY_ROWS,
  PROPERTY_BOUNDARY_TYPE_OPTIONS,
  PROPERTY_FINISHING_TYPE_OPTIONS,
  PROPERTY_FINISHING_STRUCTURE_OPTIONS,
  clearPropertyBoundaryFields,
  type PropertyBoundaryDescKey,
  type PropertyBoundaryLenKey,
  type PropertyBoundaryTypeKey,
  type PropertyBoundaryFacadeKey,
} from "@platform/app-shared/app-data/po-intake-boundaries";

/** Approximate map link from city and district (until a precise site URL is provided). */
export function approximatePropertyMapSearchUrl(property: {
  city: string;
  district: string;
}): string | null {
  const query = [property.district.trim(), property.city.trim(), "السعودية"]
    .filter(Boolean)
    .join("، ");
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function formatDmsComponent(dec: number, pos: string, neg: string): string {
  const a = Math.abs(dec);
  const d = Math.floor(a);
  const m = Math.floor((a - d) * 60);
  const s = ((a - d) * 60 - m) * 60;
  return `${d}°${m}'${s.toFixed(1)}"${dec >= 0 ? pos : neg}`;
}

/** Case Study.html coord DMS line under the map. */
export function formatGeoDms(lat: number, lng: number): string {
  return `${formatDmsComponent(lat, "N", "S")} ${formatDmsComponent(lng, "E", "W")}`;
}

/** Decimal coords for display / clipboard (HTML coord-copy). */
export function formatGeoDec(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}
