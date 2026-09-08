/** PO intake — property boundary fields, geo/map helpers, description line. */

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

export {
  approximatePropertyGeo,
  hasDistrictGeo,
} from "@platform/app-shared/domain/property-geo";

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

/** Short property description under the main photo (HTML property description). */
export function buildPropertyDescriptionLine(
  property: {
    propertyType: string;
    classification: string;
    area: string;
    district: string;
    bourseDataCompleted: boolean;
  },
  inspectorDescription?: string,
): string {
  const fromInspector = inspectorDescription?.trim();
  if (fromInspector) return fromInspector;
  if (!property.bourseDataCompleted) {
    return "يُحدَّث وصف العقار بعد اكتمال استعلام البورصة وتقرير المعاين.";
  }
  const parts = [
    property.propertyType.trim(),
    property.classification.trim(),
  ].filter(Boolean);
  const head = parts.join(" ");
  const area = property.area.trim()
    ? `مساحة ${property.area.trim()} م²`
    : "";
  const district = property.district.trim()
    ? `بحي ${property.district.trim()}`
    : "";
  const body = [head, area, district].filter(Boolean).join("، ");
  if (!body) return "يُحدَّث الوصف التفصيلي من تقرير المعاين.";
  return `${body}. يُحدَّث الوصف التفصيلي من تقرير المعاين.`;
}
