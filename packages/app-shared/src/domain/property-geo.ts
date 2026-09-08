/** Approximate city/district centroids and map-URL coordinate parsing. */

export type MapCoords = { lat: number; lng: number };

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
  الجموم: [21.6158, 39.6982],
};

/** Known district centroids — `${city}|${district}` */
const DISTRICT_GEO: Record<string, [number, number]> = {
  "جدة|الروضة": [21.5731, 39.1521],
  "جدة|السلامة": [21.6001, 39.1435],
  "جدة|النعيم": [21.628, 39.123],
  "جدة|أبحر الشمالية": [21.7743, 39.0987],
  "جدة|الشاطئ": [21.6152, 39.1044],
  "الرياض|النرجس": [24.8419, 46.658],
  "الرياض|الملقا": [24.8034, 46.6002],
  "الرياض|حطين": [24.7729, 46.5977],
  "الرياض|العارض": [24.9066, 46.635],
  "الجموم|السنابل": [21.6172, 39.7011],
  "مكة المكرمة|الراشدية": [21.3891, 39.8579],
};

function districtGeoKey(city: string, district: string): string {
  return `${city.trim()}|${district.trim()}`;
}

/** True when city+district resolves to a known centroid (not city-only fallback). */
export function hasDistrictGeo(city: string, district: string): boolean {
  const c = city.trim();
  const d = district.trim();
  if (!c || !d) return false;
  return Boolean(DISTRICT_GEO[districtGeoKey(c, d)]);
}

/**
 * Approximate lat/lng for OSM embed (district centroid, else city + deed jitter).
 * Matches Case Study.html CITY_GEO heuristic until real coordinates exist.
 */
export function approximatePropertyGeo(property: {
  city: string;
  district?: string;
  deedNumber: string;
}): { lat: number; lng: number } | null {
  const city = property.city.trim();
  if (!city) return null;
  const district = property.district?.trim();
  let base: [number, number];
  let jitterDivisor = 1000;
  if (district) {
    const districtBase =
      DISTRICT_GEO[districtGeoKey(city, district)] ??
      DISTRICT_GEO[districtGeoKey(city, district.replace(/^حي\s+/u, ""))];
    if (districtBase) {
      base = districtBase;
      jitterDivisor = 5000;
    } else {
      base = CITY_GEO[city] ?? [24.7136, 46.6753];
    }
  } else {
    base = CITY_GEO[city] ?? [24.7136, 46.6753];
  }
  let seed = 0;
  const deed = property.deedNumber.trim() || city;
  for (let i = 0; i < deed.length; i += 1) {
    seed += deed.charCodeAt(i) * (i + 1);
  }
  const jitter = jitterDivisor;
  return {
    lat: base[0] + ((seed % 37) - 18) / jitter,
    lng: base[1] + ((seed % 53) - 26) / jitter,
  };
}

function parseCoordPair(
  latRaw: string | null | undefined,
  lngRaw: string | null | undefined,
): MapCoords | null {
  const lat = Number.parseFloat((latRaw ?? "").trim().replace(",", "."));
  const lng = Number.parseFloat((lngRaw ?? "").trim().replace(",", "."));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

/** Extract lat/lng from a Google Maps URL when present. */
export function coordsFromLocationMapUrl(
  url: string | null | undefined,
): MapCoords | null {
  const raw = (url ?? "").trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const q = u.searchParams.get("query") || u.searchParams.get("q");
    if (q) {
      const m = q.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
      if (m) return parseCoordPair(m[1], m[2]);
    }
  } catch {
    /* not a URL — fall through */
  }
  const at = raw.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (at) return parseCoordPair(at[1], at[2]);
  const plain = raw.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
  if (plain) return parseCoordPair(plain[1], plain[2]);
  return null;
}
