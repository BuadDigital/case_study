import { parseCoordinate, parseLatLng } from "./geo";
import { normalizeArabicSearchText } from "./courts/circuit-search";

/** Jeddah — Al-Balad (on-land location for the form and demo display). */
export const JEDDAH_DEFAULT_LAT = "21.481000";
export const JEDDAH_DEFAULT_LNG = "39.186500";

export const JEDDAH_DEFAULT_CENTER = {
  lat: Number(JEDDAH_DEFAULT_LAT),
  lng: Number(JEDDAH_DEFAULT_LNG),
};

/** Old sample coordinates were in the Red Sea — update them automatically. */
const LEGACY_SEA_COORDS = new Set([
  "21.5433,39.1728",
  "21.543300,39.172800",
]);

const SAUDI_LAT_MIN = 16;
const SAUDI_LAT_MAX = 33;
const SAUDI_LNG_MIN = 34;
const SAUDI_LNG_MAX = 56;

function isWithinSaudiBounds(lat: number, lng: number): boolean {
  return (
    lat >= SAUDI_LAT_MIN &&
    lat <= SAUDI_LAT_MAX &&
    lng >= SAUDI_LNG_MIN &&
    lng <= SAUDI_LNG_MAX
  );
}

export function jeddahDefaultCoords(): { latitude: string; longitude: string } {
  return { latitude: JEDDAH_DEFAULT_LAT, longitude: JEDDAH_DEFAULT_LNG };
}

export function shouldUseJeddahDefaultCoords(
  latitude: string,
  longitude: string,
): boolean {
  const lat = latitude.trim();
  const lng = longitude.trim();
  if (!lat && !lng) return true;
  if (LEGACY_SEA_COORDS.has(`${lat},${lng}`)) return true;

  const latN = parseCoordinate(lat, "lat");
  const lngN = parseCoordinate(lng, "lng");
  if (latN === null || lngN === null) return true;
  if (!isWithinSaudiBounds(latN, lngN)) return true;

  return false;
}

/** The Jeddah placeholder's distance tolerance — the map rounds a pin to five decimals. */
const PLACEHOLDER_EPSILON = 0.00001;

/**
 * The pair is exactly the Jeddah placeholder (the map's start point when the property has no map link).
 *
 * How it works: both values parse (any digit system) and each is within 0.00001° of 21.4810 / 39.1865.
 *
 * Edge cases: added A→Z 2026-11-02 #42. Empty or unreadable values are not the placeholder (they are
 * «no pin», handled by `shouldUseJeddahDefaultCoords`).
 */
export function isJeddahPlaceholderPin(latitude: string, longitude: string): boolean {
  const point = parseLatLng(latitude, longitude);
  if (!point) return false;
  return (
    Math.abs(point.lat - JEDDAH_DEFAULT_CENTER.lat) < PLACEHOLDER_EPSILON &&
    Math.abs(point.lng - JEDDAH_DEFAULT_CENTER.lng) < PLACEHOLDER_EPSILON
  );
}

/** The city is Jeddah («جدة» / «جده», any spelling the Arabic search normaliser folds together). */
export function isJeddahCity(city: string | null | undefined): boolean {
  return normalizeArabicSearchText(city ?? "").replace(/^مدينه\s+/, "") === "جده";
}

/**
 * Why «تثبيت الموقع» must refuse this pin, or null when it may be pinned.
 *
 * How it works: the pin still sits exactly on the Jeddah placeholder and the property's city is not Jeddah
 * (or unknown) → the message naming the city; anything else → null.
 *
 * Edge cases: fixed A→Z 2026-11-02 #42 — a plan-and-plot property (no map link) opened the inspector's map on
 * the Jeddah default and «تثبيت الموقع» accepted it, so a Riyadh property got Jeddah coordinates and its
 * comparables showed 846 km away. A Jeddah property may keep the point (it can really be there).
 */
export function jeddahPlaceholderPinError(
  latitude: string,
  longitude: string,
  city: string | null | undefined,
): string | null {
  if (!isJeddahPlaceholderPin(latitude, longitude) || isJeddahCity(city)) return null;
  const where = (city ?? "").trim();
  return where
    ? `الدبوس ما زال على موقع جدة الافتراضي والعقار في ${where} — حرّك الخريطة إلى موقع العقار ثم ثبّته`
    : "الدبوس ما زال على موقع جدة الافتراضي — حرّك الخريطة إلى موقع العقار ثم ثبّته";
}
