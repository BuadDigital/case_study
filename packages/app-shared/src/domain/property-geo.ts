/** Approximate city/district centroids and map-URL coordinate parsing. */

import { parseLatLng } from "./geo";

export type MapCoords = { lat: number; lng: number };

/**
 * Approximate city centroids. Every one of the 13 region capitals, the governorates seen in live
 * data, and the main governorates; a city missing here gets no guessed location (see
 * approximatePropertyGeo) — it used to fall back to central Riyadh.
 */
const CITY_GEO_SOURCE: Record<string, [number, number]> = {
  // Region capitals (13)
  الرياض: [24.7136, 46.6753],
  "مكة المكرمة": [21.3891, 39.8579],
  مكة: [21.3891, 39.8579],
  "المدينة المنورة": [24.5247, 39.5692],
  المدينة: [24.5247, 39.5692],
  بريدة: [26.326, 43.975],
  الدمام: [26.4207, 50.0888],
  أبها: [18.2164, 42.5053],
  تبوك: [28.3838, 36.555],
  حائل: [27.5114, 41.7208],
  عرعر: [30.9753, 41.0381],
  جازان: [16.8894, 42.5706],
  نجران: [17.5656, 44.2289],
  الباحة: [20.0129, 41.4677],
  سكاكا: [29.9697, 40.2064],
  // Governorates
  جدة: [21.4858, 39.1925],
  الطائف: [21.2703, 40.4158],
  الجموم: [21.6158, 39.6982],
  الخبر: [26.2172, 50.1971],
  الظهران: [26.2361, 50.0393],
  القطيف: [26.5196, 50.0115],
  الجبيل: [27.0174, 49.6225],
  بقيق: [25.9336, 49.6681],
  الخفجي: [28.4392, 48.4913],
  "حفر الباطن": [28.4328, 45.9708],
  الاحساء: [25.3836, 49.588],
  الهفوف: [25.3836, 49.588],
  الخرج: [24.1556, 47.3122],
  الدرعية: [24.734, 46.576],
  المجمعة: [25.9036, 45.3456],
  الزلفي: [26.2994, 44.8155],
  الدوادمي: [24.5077, 44.3924],
  "وادي الدواسر": [20.444, 44.78],
  عنيزة: [26.0841, 43.9937],
  الرس: [25.8694, 43.4973],
  البكيرية: [26.1394, 43.6585],
  "خميس مشيط": [18.3061, 42.729],
  بيشة: [19.985, 42.6052],
  محايل: [18.544, 42.0478],
  ينبع: [24.0889, 38.0618],
  العلا: [26.6085, 37.9232],
  ثول: [22.284, 39.105],
  رابغ: [22.7986, 39.0349],
  الليث: [20.1497, 40.2706],
  القنفذة: [19.1281, 41.0787],
  صبيا: [17.1495, 42.6254],
  شرورة: [17.488, 47.1124],
  الوجه: [26.2324, 36.4636],
  القريات: [31.3318, 37.3428],
  طريف: [31.6725, 38.6637],
  رفحاء: [29.6202, 43.4948],
};

/** Known district centroids — `${city}|${district}` */
const DISTRICT_GEO_SOURCE: Record<string, [number, number]> = {
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

const DIACRITICS = /[\u064B-\u065F\u0670]/gu;
// Folded spelling (ة→ه) — stripped after folding.
const PLACE_PREFIX = /^\s*(محافظه|مدينه|مركز|حي)\s+/u;

/**
 * One spelling per place, the same folding as the backend's LocationNameNormalizer: no diacritics or
 * tatweel, أ/إ/آ/ٱ→ا, ؤ→و, ئ→ي, ة→ه, ى→ي, and no «محافظة/مدينة/مركز/حي» prefix — so «محافظة الخرج»,
 * «الخرج» and «الأحساء»/«الاحساء» meet.
 */
export function normalizePlaceName(input: string | null | undefined): string {
  if (!input?.trim()) return "";
  const folded = input
    .trim()
    .normalize("NFKC")
    .replace(DIACRITICS, "")
    .replace(/\u0640/g, " ") // tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");
  return folded.replace(PLACE_PREFIX, "").replace(/\s+/g, " ").trim();
}

const CITY_GEO = new Map(
  Object.entries(CITY_GEO_SOURCE).map(([name, at]) => [normalizePlaceName(name), at] as const),
);

function districtGeoKey(city: string, district: string): string {
  return `${normalizePlaceName(city)}|${normalizePlaceName(district)}`;
}

const DISTRICT_GEO = new Map(
  Object.entries(DISTRICT_GEO_SOURCE).map(([key, at]) => {
    const [city, district] = key.split("|");
    return [districtGeoKey(city, district), at] as const;
  }),
);

/** True when the city has a known centroid — callers can avoid guessing a location for other cities. */
export function hasCityGeo(city: string): boolean {
  return CITY_GEO.has(normalizePlaceName(city));
}

/** True when city+district resolves to a known centroid (not city-only fallback). */
export function hasDistrictGeo(city: string, district: string): boolean {
  if (!city.trim() || !district.trim()) return false;
  return DISTRICT_GEO.has(districtGeoKey(city, district));
}

/**
 * Approximate lat/lng for OSM embed (district centroid, else city + deed jitter).
 * Matches Case Study.html CITY_GEO heuristic until real coordinates exist.
 * Null for a city it does not know: a wrong location (it used to be central Riyadh) is worse than none.
 */
export function approximatePropertyGeo(property: {
  city: string;
  district?: string;
  deedNumber: string;
}): { lat: number; lng: number } | null {
  const city = property.city.trim();
  if (!city) return null;
  const district = property.district?.trim();
  const districtBase = district ? DISTRICT_GEO.get(districtGeoKey(city, district)) : undefined;
  const base = districtBase ?? CITY_GEO.get(normalizePlaceName(city));
  if (!base) return null;
  const jitterDivisor = districtBase ? 5000 : 1000;
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
      const m = q.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
      if (m) return parseLatLng(m[1], m[2]);
    }
  } catch {
    /* not a URL — fall through */
  }
  const at = raw.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) return parseLatLng(at[1], at[2]);
  const plain = raw.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (plain) return parseLatLng(plain[1], plain[2]);
  return null;
}
