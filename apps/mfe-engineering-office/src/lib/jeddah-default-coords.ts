/** جدة — البلد (موقع على اليابسة، للنموذج والعرض التجريبي). */
export const JEDDAH_DEFAULT_LAT = "21.481000";
export const JEDDAH_DEFAULT_LNG = "39.186500";

export const JEDDAH_DEFAULT_CENTER = {
  lat: Number(JEDDAH_DEFAULT_LAT),
  lng: Number(JEDDAH_DEFAULT_LNG),
};

/** إحداثيات المثال القديمة كانت في البحر الأحمر — نُحدّثها تلقائياً. */
const LEGACY_SEA_COORDS = new Set([
  "21.5433,39.1728",
  "21.543300,39.172800",
]);

const SAUDI_LAT_MIN = 16;
const SAUDI_LAT_MAX = 33;
const SAUDI_LNG_MIN = 34;
const SAUDI_LNG_MAX = 56;

function parseCoordNumber(value: string): number | null {
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : null;
}

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

  const latN = parseCoordNumber(lat);
  const lngN = parseCoordNumber(lng);
  if (latN === null || lngN === null) return true;
  if (!isWithinSaudiBounds(latN, lngN)) return true;

  return false;
}