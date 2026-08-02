/** Photo vs property location flags (security_offline_spec §5.4). Never blocks upload. */

export const PHOTO_LOCATION_MAX_MATCH_M = 500;

export const PHOTO_LOCATION_FLAGS = {
  match: "match",
  outside_property: "outside_property",
  location_unavailable: "location_unavailable",
} as const;

export type PhotoLocationFlag =
  (typeof PHOTO_LOCATION_FLAGS)[keyof typeof PHOTO_LOCATION_FLAGS];

export function photoLocationFlagLabel(flag: string | null | undefined): string {
  switch (flag) {
    case PHOTO_LOCATION_FLAGS.match:
      return "مطابق";
    case PHOTO_LOCATION_FLAGS.outside_property:
      return "خارج نطاق العقار";
    case PHOTO_LOCATION_FLAGS.location_unavailable:
      return "موقع غير متاح";
    default:
      return "";
  }
}

export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const earthRadiusM = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusM * c;
}

export function evaluatePhotoLocation(input: {
  photoLatitude?: number | null;
  photoLongitude?: number | null;
  propertyLatitude?: number | null;
  propertyLongitude?: number | null;
}): { distanceM: number | null; flag: PhotoLocationFlag | null } {
  const { photoLatitude, photoLongitude, propertyLatitude, propertyLongitude } =
    input;
  if (
    photoLatitude == null ||
    photoLongitude == null ||
    Number.isNaN(photoLatitude) ||
    Number.isNaN(photoLongitude)
  ) {
    return { distanceM: null, flag: PHOTO_LOCATION_FLAGS.location_unavailable };
  }
  if (
    propertyLatitude == null ||
    propertyLongitude == null ||
    Number.isNaN(propertyLatitude) ||
    Number.isNaN(propertyLongitude)
  ) {
    return { distanceM: null, flag: null };
  }
  const distanceM =
    Math.round(
      haversineMeters(
        photoLatitude,
        photoLongitude,
        propertyLatitude,
        propertyLongitude,
      ) * 10,
    ) / 10;
  return {
    distanceM,
    flag:
      distanceM > PHOTO_LOCATION_MAX_MATCH_M
        ? PHOTO_LOCATION_FLAGS.outside_property
        : PHOTO_LOCATION_FLAGS.match,
  };
}

export function parseCoord(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(n) ? n : null;
}
