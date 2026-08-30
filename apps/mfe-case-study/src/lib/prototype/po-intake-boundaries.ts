/** PO intake — property boundary fields, geo/map helpers, description line. */

/** Boundary and length input rows — bourse stage (specialist). */
export const PROPERTY_BOUNDARY_ROWS = [
  {
    descKey: "northBoundary",
    lenKey: "northBoundaryLengthM",
    typeKey: "northBoundaryType",
    facadeKey: "northFacadeFinishing",
    label: "الحد الشمالي",
  },
  {
    descKey: "southBoundary",
    lenKey: "southBoundaryLengthM",
    typeKey: "southBoundaryType",
    facadeKey: "southFacadeFinishing",
    label: "الحد الجنوبي",
  },
  {
    descKey: "eastBoundary",
    lenKey: "eastBoundaryLengthM",
    typeKey: "eastBoundaryType",
    facadeKey: "eastFacadeFinishing",
    label: "الحد الشرقي",
  },
  {
    descKey: "westBoundary",
    lenKey: "westBoundaryLengthM",
    typeKey: "westBoundaryType",
    facadeKey: "westFacadeFinishing",
    label: "الحد الغربي",
  },
] as const;

export const PROPERTY_BOUNDARY_TYPE_OPTIONS = [
  { value: "", label: "—" },
  { value: "street", label: "شارع" },
  { value: "plot", label: "قطعة" },
  { value: "passage", label: "ممر" },
  { value: "rail", label: "سكة" },
] as const;

export const PROPERTY_FINISHING_TYPE_OPTIONS = [
  { value: "", label: "—" },
  { value: "luxury", label: "فاخر" },
  { value: "medium", label: "متوسط" },
  { value: "ordinary", label: "عادي" },
  { value: "none", label: "بدون تشطيب" },
] as const;

export const PROPERTY_FINISHING_STRUCTURE_OPTIONS = [
  { value: "", label: "—" },
  { value: "concrete", label: "خرساني" },
  { value: "metal", label: "معدني" },
  { value: "mixed", label: "مختلط" },
  { value: "other", label: "أخرى" },
] as const;

export type PropertyBoundaryDescKey =
  (typeof PROPERTY_BOUNDARY_ROWS)[number]["descKey"];
export type PropertyBoundaryLenKey =
  (typeof PROPERTY_BOUNDARY_ROWS)[number]["lenKey"];
export type PropertyBoundaryTypeKey =
  (typeof PROPERTY_BOUNDARY_ROWS)[number]["typeKey"];
export type PropertyBoundaryFacadeKey =
  (typeof PROPERTY_BOUNDARY_ROWS)[number]["facadeKey"];

export function clearPropertyBoundaryFields(): {
  northBoundary: string;
  northBoundaryLengthM: string;
  northBoundaryType: string;
  northFacadeFinishing: string;
  southBoundary: string;
  southBoundaryLengthM: string;
  southBoundaryType: string;
  southFacadeFinishing: string;
  eastBoundary: string;
  eastBoundaryLengthM: string;
  eastBoundaryType: string;
  eastFacadeFinishing: string;
  westBoundary: string;
  westBoundaryLengthM: string;
  westBoundaryType: string;
  westFacadeFinishing: string;
} {
  return {
    northBoundary: "",
    northBoundaryLengthM: "",
    northBoundaryType: "",
    northFacadeFinishing: "",
    southBoundary: "",
    southBoundaryLengthM: "",
    southBoundaryType: "",
    southFacadeFinishing: "",
    eastBoundary: "",
    eastBoundaryLengthM: "",
    eastBoundaryType: "",
    eastFacadeFinishing: "",
    westBoundary: "",
    westBoundaryLengthM: "",
    westBoundaryType: "",
    westFacadeFinishing: "",
  };
}

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

const CITY_GEO: Record<string, [number, number]> = {
  الرياض: [24.7136, 46.6753],
  جدة: [21.4858, 39.1925],
  "مكة المكرمة": [21.3891, 39.8579],
  مكة: [21.3891, 39.8579],
  الطائف: [21.2703, 40.4158],
  الدمام: [26.4207, 50.0888],
  المدينة: [24.5247, 39.5692],
  "المدينة المنورة": [24.5247, 39.5692],
  الخبر: [26.2172, 50.1971],
  أبها: [18.2164, 42.5053],
  تبوك: [28.3838, 36.555],
  حائل: [27.5114, 41.7208],
  بريدة: [26.326, 43.975],
  نجران: [17.5656, 44.2289],
  جازان: [16.8894, 42.5706],
};

/**
 * Approximate lat/lng for OSM embed (city centroid + deed-based jitter).
 * Matches Case Study.html CITY_GEO heuristic until real coordinates exist.
 */
export function approximatePropertyGeo(property: {
  city: string;
  deedNumber: string;
}): { lat: number; lng: number } | null {
  const city = property.city.trim();
  if (!city) return null;
  const base = CITY_GEO[city] ?? [24.7136, 46.6753];
  let seed = 0;
  const deed = property.deedNumber.trim() || city;
  for (let i = 0; i < deed.length; i += 1) {
    seed += deed.charCodeAt(i) * (i + 1);
  }
  return {
    lat: base[0] + ((seed % 37) - 18) / 1000,
    lng: base[1] + ((seed % 53) - 26) / 1000,
  };
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
