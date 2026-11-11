// The transaction's tables show its own comparables only (ruling 2026-11-11): the ones entered for the
// property or chosen for it. The bank is reached from the «إضافة مقارن» map (pins around the subject, and a
// search by reference code or district) — the system no longer suggests the nearest comparables.

import {
  listComparableProperties,
  type ComparablePropertyDto,
  type ValuationComparableSelectionDto,
} from "@platform/api-client";
import { parseLocaleNumber } from "@platform/app-shared/format/number";
import { toLatinDigits } from "@platform/ui-kit";
import { normalizeArabicSearchText } from "@platform/app-shared/domain/courts/circuit-search";
import {
  coordsFromLocationMapUrl,
  haversineKm,
  parseLatLng,
} from "@platform/app-shared/domain/geo";

/** How many search hits are asked of the bank. */
const BANK_CANDIDATE_POOL = 120;
/** A comparable farther than this from the subject counts as distant (`filterSelectionNearSubject`). */
const NEARBY_RADIUS_KM = 3;

export function isVacantLandComparable(type: string | null | undefined): boolean {
  const t = (type ?? "").trim();
  if (!t) return false;
  if (/فيلا|شقة|مبنى|دور|villa|apartment|building/i.test(t)) return false;
  return /أرض|ارض|فضاء|land/i.test(t);
}

/** Interactive-form spec: ratio = larger ÷ smaller (≥ 1); ≥ 2 means multiplier method and is highlighted red. */
export function areaRatioValue(
  subjectArea: number | null | undefined,
  compArea: number,
): number | null {
  if (!subjectArea || !compArea || subjectArea <= 0 || compArea <= 0) return null;
  return Math.max(subjectArea, compArea) / Math.min(subjectArea, compArea);
}

export function areaRatio(
  subjectArea: number | null | undefined,
  compArea: number,
): string {
  const r = areaRatioValue(subjectArea, compArea);
  return r == null ? "—" : r.toFixed(2);
}

/** Digits and one decimal point — Arabic numerals accepted. */
export function sanitizeAmountInput(raw: string): string {
  return toLatinDigits(raw).replace(/[^\d.]/g, "");
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function amountOr(raw: string | null | undefined, fallback: number): number {
  if (raw == null || raw.trim() === "") return fallback;
  const n = parseLocaleNumber(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Live سعر العقار / المساحة / سعر المتر while the evaluator is still in the cell. */
export function liveBankMoney(args: {
  committedPrice: number;
  committedArea: number;
  priceDraft?: string | null;
  areaDraft?: string | null;
  unitDraft?: string | null;
}): { price: number; area: number; unit: number | null } {
  const area = amountOr(args.areaDraft, args.committedArea);
  if (args.unitDraft != null && args.unitDraft !== "") {
    const unit = amountOr(args.unitDraft, 0);
    return {
      area,
      unit: unit > 0 ? unit : null,
      price:
        unit > 0 && area > 0 ? roundMoney(unit * area) : args.committedPrice,
    };
  }
  const price = amountOr(args.priceDraft, args.committedPrice);
  return {
    price,
    area,
    unit: area > 0 ? roundMoney(price / area) : null,
  };
}

function hasUsableCoords(lat: number, lng: number): boolean {
  return parseLatLng(lat, lng) != null;
}

function normalizeCity(city: string | null | undefined): string {
  // «محافظة الخرج» = «الخرج»: the administrative prefix is not part of the city.
  return normalizeArabicSearchText((city ?? "").trim().replace(/^(محافظة|مدينة)\s+/u, ""));
}

/** Loose city match — handles short vs. full city names (e.g. "Makkah" vs "Makkah Al-Mukarramah"). */
function citiesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizeCity(a);
  const nb = normalizeCity(b);
  if (!na || !nb) return true;
  if (na === nb) return true;
  // Folded spellings: ة→ه, so «مكة» / «المدينة» appear as «مكه» / «المدينه».
  if (na.includes("مكه") && nb.includes("مكه")) return true;
  if (na.includes("المدينه") && nb.includes("المدينه")) return true;
  return false;
}

/** Within `radiusKm` (3 by default) when subject coords exist; same city otherwise. */
function isNearSubjectComparable(
  comp: ComparablePropertyDto,
  subjectCity: string | null | undefined,
  distanceKm: number | null | undefined,
  subjectHasCoords = false,
  radiusKm: number = NEARBY_RADIUS_KM,
): boolean {
  if (subjectHasCoords) {
    return (
      distanceKm != null &&
      Number.isFinite(distanceKm) &&
      distanceKm <= radiusKm
    );
  }

  const city = normalizeCity(subjectCity);
  const compCity = normalizeCity(comp.city);

  if (distanceKm != null && Number.isFinite(distanceKm)) {
    return distanceKm <= radiusKm;
  }

  if (city && compCity && citiesMatch(city, compCity)) return true;
  if (city) return false;
  return true;
}

export function filterSelectionNearSubject(
  items: ValuationComparableSelectionDto[],
  subjectCity?: string | null,
  subjectCoords?: { lat: number; lng: number } | null,
): ValuationComparableSelectionDto[] {
  return items.filter((item) => {
    const comp = item.comparable;
    let distanceKm: number | null = null;
    if (
      subjectCoords &&
      hasUsableCoords(comp.latitude, comp.longitude)
    ) {
      distanceKm = haversineKm(subjectCoords, {
        lat: comp.latitude,
        lng: comp.longitude,
      });
    }
    return isNearSubjectComparable(
      comp,
      subjectCity,
      distanceKm,
      Boolean(subjectCoords),
    );
  });
}

/**
 * The subject's real location only — the inspector's pin, else the intake map link. No guess from
 * the city name: a guessed centroid (central Riyadh for an unknown city) ranked the wrong comparables
 * as nearby; without a location the bank matches on the city instead.
 */
export function resolveSubjectCoordsForBank(opts: {
  latitude?: number | null;
  longitude?: number | null;
  locationMapUrl?: string | null;
}): { lat: number; lng: number } | null {
  return parseLatLng(opts.latitude, opts.longitude) ?? coordsFromLocationMapUrl(opts.locationMapUrl);
}

type RankedItem = {
  comparable: ComparablePropertyDto;
  distanceKm?: number | null;
};

/** Closest distance first, then closest area to the subject, then the most recent deal. */
function byNearestTo(subjectSqm: number | null | undefined) {
  return (a: RankedItem, b: RankedItem): number => {
    const distA = a.distanceKm ?? Number.POSITIVE_INFINITY;
    const distB = b.distanceKm ?? Number.POSITIVE_INFINITY;
    if (distA !== distB) return distA - distB;
    if (subjectSqm != null && subjectSqm > 0) {
      const da = Math.abs((a.comparable.areaSqm || 0) - subjectSqm);
      const db = Math.abs((b.comparable.areaSqm || 0) - subjectSqm);
      if (da !== db) return da - db;
    }
    return (b.comparable.transactionDate || "").localeCompare(
      a.comparable.transactionDate || "",
    );
  };
}

function attachDistances(
  comps: ComparablePropertyDto[],
  subjectLat: number,
  subjectLng: number,
): RankedItem[] {
  return comps.map((comparable) => {
    const lat = comparable.latitude;
    const lng = comparable.longitude;
    if (!hasUsableCoords(lat, lng)) {
      return { comparable, distanceKm: null };
    }
    return {
      comparable,
      distanceKm: haversineKm({ lat: subjectLat, lng: subjectLng }, { lat, lng }),
    };
  });
}

async function listBankPool(
  config: { token: string; baseUrl: string },
  opts: { q: string; propertyId?: string },
): Promise<ComparablePropertyDto[]> {
  const res = await listComparableProperties(config, {
    q: opts.q,
    take: BANK_CANDIDATE_POOL,
    forPropertyId: opts.propertyId || undefined,
  });
  if (!res.ok) return [];
  return res.data;
}

export function parseSubjectAreaSqm(
  subjectAreaField: string,
  propertyArea?: string,
): number | null {
  const fromUi = parseLocaleNumber(subjectAreaField);
  if (Number.isFinite(fromUi) && fromUi > 0) return fromUi;
  const fromProp = parseLocaleNumber(propertyArea);
  if (Number.isFinite(fromProp) && fromProp > 0) return fromProp;
  return null;
}

/** What the bank needs to know about the subject: where it is, and what a search ranks by. */
export type BankSubjectOptions = {
  q?: string;
  propertyId?: string;
  district?: string;
  city?: string;
  deedNumber?: string;
  locationMapUrl?: string;
  subjectSqm: number | null;
  latitude?: number | null;
  longitude?: number | null;
};

/**
 * The bank comparables a search finds, nearest to the subject first.
 *
 * How it works: the search text (reference code, district, type) goes to the whole bank — any
 * city, any distance; the hits are ranked by distance from the subject, then by area.
 *
 * Edge cases: empty search text asks nothing and returns nothing. The property type filters
 * nothing on the server: the bank saves every land as the bare «أرض» and the server matches by
 * `Contains`.
 */
export async function searchBankComparables(
  config: { token: string; baseUrl: string },
  opts: BankSubjectOptions,
): Promise<ComparablePropertyDto[]> {
  const search = opts.q?.trim() ?? "";
  if (!search) return [];
  const subjectCoords = resolveSubjectCoordsForBank(opts);
  const rows = await listBankPool(config, {
    q: search,
    propertyId: opts.propertyId || undefined,
  });
  const items: RankedItem[] = subjectCoords
    ? attachDistances(rows, subjectCoords.lat, subjectCoords.lng)
    : rows.map((comparable) => ({ comparable }));
  return [...items].sort(byNearestTo(opts.subjectSqm)).map((row) => row.comparable);
}

export type BankDisplayRow = {
  key: string;
  selected: boolean;
  adopted: boolean;
  comp: ComparablePropertyDto;
  item?: ValuationComparableSelectionDto;
};

/**
 * The rows of a transaction's comparables table: its own comparables (`selectionItems` — entered
 * for the property, or chosen for it) and nothing else. The system suggests none.
 *
 * How it works: every own row shows, whatever its distance, type or count, nearest first.
 *
 * Edge cases: an own row the appraiser un-adopted stays, so it can be adopted again. A comparable
 * or a subject with no coordinates has no distance and sorts last.
 */
export function buildBankDisplayRows(opts: {
  selectionItems: ValuationComparableSelectionDto[];
  subjectCoords?: { lat: number; lng: number } | null;
  subjectSqm?: number | null;
}): { rows: BankDisplayRow[]; distances: Record<string, number> } {
  const ranked = opts.selectionItems
    .map((item) => ({
      item,
      comparable: item.comparable,
      distanceKm:
        opts.subjectCoords &&
        hasUsableCoords(item.comparable.latitude, item.comparable.longitude)
          ? haversineKm(opts.subjectCoords, {
              lat: item.comparable.latitude,
              lng: item.comparable.longitude,
            })
          : null,
    }))
    .sort(byNearestTo(opts.subjectSqm));

  const distances: Record<string, number> = {};
  const rows: BankDisplayRow[] = ranked.map(({ item, comparable, distanceKm }) => {
    if (distanceKm != null && Number.isFinite(distanceKm)) distances[comparable.id] = distanceKm;
    return {
      key: item.id,
      selected: true,
      adopted: item.isAdopted,
      comp: comparable,
      item,
    };
  });

  return { rows, distances };
}
