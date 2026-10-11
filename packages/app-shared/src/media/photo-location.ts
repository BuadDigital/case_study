/** Photo vs property location flags. Never blocks upload. */

import { haversineMeters, parseLatLng } from "../domain/geo";

export const PHOTO_LOCATION_MAX_MATCH_M = 500;

export const PHOTO_LOCATION_FLAGS = {
  match: "match",
  outside_property: "outside_property",
  location_unavailable: "location_unavailable",
} as const;

type PhotoLocationFlag =
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
        { lat: photoLatitude, lng: photoLongitude },
        { lat: propertyLatitude, lng: propertyLongitude },
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

/** Placed map pin — rejects empty / non-numeric / out-of-range / (0,0) unset defaults. */
export const parsePlacedMapPin = parseLatLng;

/** True when two pins are farther apart than the photo/property match radius (500 m). */
export function pinsExceedMatchMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
  maxMeters: number = PHOTO_LOCATION_MAX_MATCH_M,
): boolean {
  return haversineMeters(a, b) > maxMeters;
}

export function pinDistanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  return Math.round(haversineMeters(a, b) * 10) / 10;
}
