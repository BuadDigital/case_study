import {
  listComparableProperties,
  suggestComparablePropertiesByProximity,
  type ComparablePropertyDto,
  type ValuationComparableSelectionDto,
} from "@platform/api-client";
import { approximatePropertyGeo, hasDistrictGeo } from "@case-study/mfe/lib/prototype/po-intake-boundaries";
import { coordsFromLocationMapUrl } from "@case-study/mfe/lib/prototype/map-live-records";

export const BANK_CANDIDATE_POOL = 40;
export const BANK_DISPLAY_LIMIT = 6;
/** Prefer comps inside this radius when the subject has coordinates. */
export const PREFERRED_RADIUS_KM = 3;
/** Maximum distance from subject when coordinates are known. */
export const NEARBY_RADIUS_KM = 3;
/** Hide comparables farther than this from the subject when coords are known. */
export const MAX_BANK_DISPLAY_DISTANCE_KM = 3;

const EARTH_RADIUS_KM = 6371;

export function sourceCardLine(comp: ComparablePropertyDto): string {
  const card = comp.sourceCard;
  return [
    card.intakeChannelLabelAr,
    card.freshnessLabelAr,
    card.fromPriorDeal ? "من معاملات سابقة" : null,
    card.sourceWorkOrderNumber ? `أمر ${card.sourceWorkOrderNumber}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

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

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function hasUsableCoords(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

function normalizeCity(city: string | null | undefined): string {
  return (city ?? "").trim().replace(/\s+/g, " ");
}

/** Loose city match — handles short vs. full city names (e.g. "Makkah" vs "Makkah Al-Mukarramah"). */
export function citiesMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normalizeCity(a);
  const nb = normalizeCity(b);
  if (!na || !nb) return true;
  if (na === nb) return true;
  if (na.includes("مكة") && nb.includes("مكة")) return true;
  if (na.includes("المدينة") && nb.includes("المدينة")) return true;
  return false;
}

/** Within NEARBY_RADIUS_KM when subject coords exist; same city otherwise. */
export function isNearSubjectComparable(
  comp: ComparablePropertyDto,
  subjectCity: string | null | undefined,
  distanceKm: number | null | undefined,
  subjectHasCoords = false,
): boolean {
  if (subjectHasCoords) {
    return (
      distanceKm != null &&
      Number.isFinite(distanceKm) &&
      distanceKm <= NEARBY_RADIUS_KM
    );
  }

  const city = normalizeCity(subjectCity);
  const compCity = normalizeCity(comp.city);

  if (distanceKm != null && Number.isFinite(distanceKm)) {
    return distanceKm <= NEARBY_RADIUS_KM;
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
      distanceKm = haversineKm(
        subjectCoords.lat,
        subjectCoords.lng,
        comp.latitude,
        comp.longitude,
      );
    }
    return isNearSubjectComparable(
      comp,
      subjectCity,
      distanceKm,
      Boolean(subjectCoords),
    );
  });
}

function filterNearSubject(
  items: RankedItem[],
  subjectCity: string | null | undefined,
  subjectCoords?: { lat: number; lng: number } | null,
): RankedItem[] {
  const subjectHasCoords = Boolean(subjectCoords);
  return items.filter((row) => {
    let distanceKm = row.distanceKm ?? null;
    if (
      subjectCoords &&
      distanceKm == null &&
      hasUsableCoords(row.comparable.latitude, row.comparable.longitude)
    ) {
      distanceKm = haversineKm(
        subjectCoords.lat,
        subjectCoords.lng,
        row.comparable.latitude,
        row.comparable.longitude,
      );
    }
    return isNearSubjectComparable(
      row.comparable,
      subjectCity,
      distanceKm,
      subjectHasCoords,
    );
  });
}

export function resolveSubjectCoordsForBank(opts: {
  latitude?: number | null;
  longitude?: number | null;
  locationMapUrl?: string | null;
  city?: string | null;
  district?: string | null;
  deedNumber?: string | null;
}): { lat: number; lng: number } | null {
  const fromUrl = coordsFromLocationMapUrl(opts.locationMapUrl);
  if (fromUrl) return fromUrl;

  const city = opts.city?.trim();
  const district = opts.district?.trim();
  const deedNumber = opts.deedNumber?.trim() || city || "";

  // Property intake city+district wins over field-inspection GPS when district is known.
  if (city && district && hasDistrictGeo(city, district)) {
    return approximatePropertyGeo({ city, district, deedNumber });
  }

  if (
    opts.latitude != null &&
    opts.longitude != null &&
    hasUsableCoords(opts.latitude, opts.longitude)
  ) {
    return { lat: opts.latitude, lng: opts.longitude };
  }

  if (city) {
    return approximatePropertyGeo({
      city,
      district: district || undefined,
      deedNumber,
    });
  }

  return null;
}

type RankedItem = {
  comparable: ComparablePropertyDto;
  distanceKm?: number | null;
};

/** Closest distance first, then closest area to the subject. */
export function rankBankCandidates(
  items: RankedItem[],
  subjectSqm: number | null,
  limit = BANK_DISPLAY_LIMIT,
): ComparablePropertyDto[] {
  const ranked = [...items].sort((a, b) => {
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
  });
  return ranked.slice(0, limit).map((x) => x.comparable);
}

/** @deprecated Use rankBankCandidates — kept for older imports. */
export const rankBankCandidatesByArea = rankBankCandidates;

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
      distanceKm: haversineKm(subjectLat, subjectLng, lat, lng),
    };
  });
}

function buildDistancesMap(items: RankedItem[]): Record<string, number> {
  const distances: Record<string, number> = {};
  for (const row of items) {
    if (row.distanceKm != null && Number.isFinite(row.distanceKm)) {
      distances[row.comparable.id] = row.distanceKm;
    }
  }
  return distances;
}

function finalizeBankResultFromItems(
  items: RankedItem[],
  subjectSqm: number | null,
  subjectCoords: { lat: number; lng: number } | null,
): BankCandidatesResult {
  const ranked = rankBankCandidates(items, subjectSqm);
  const rankedIds = new Set(ranked.map((c) => c.id));
  const rankedItems = items.filter((row) => rankedIds.has(row.comparable.id));
  return {
    ok: true,
    data: ranked,
    distances: buildDistancesMap(rankedItems),
    subjectCoords,
  };
}

async function listBankPool(
  config: { token: string; baseUrl: string },
  opts: {
    q?: string;
    city?: string;
    propertyId?: string;
    propertyType?: string;
  },
): Promise<ComparablePropertyDto[]> {
  const res = await listComparableProperties(config, {
    q: opts.q || undefined,
    city: opts.city || undefined,
    take: BANK_CANDIDATE_POOL,
    forPropertyId: opts.propertyId || undefined,
    propertyType: opts.propertyType || undefined,
  });
  if (!res.ok) return [];
  return res.data;
}

async function listNearSubjectPool(
  config: { token: string; baseUrl: string },
  opts: {
    q?: string;
    city?: string;
    propertyId?: string;
    propertyType?: string;
  },
  subjectCoords: { lat: number; lng: number },
  subjectCity?: string | null,
): Promise<RankedItem[]> {
  const attempts: {
    q?: string;
    city?: string;
    propertyId?: string;
    propertyType?: string;
  }[] = [
    opts,
    { q: opts.q, city: opts.city, propertyId: opts.propertyId },
    { q: opts.q, propertyId: opts.propertyId },
    { propertyId: opts.propertyId },
  ];

  let rows: ComparablePropertyDto[] = [];
  for (const attempt of attempts) {
    rows = await listBankPool(config, attempt);
    if (rows.length > 0) break;
  }

  return filterNearSubject(
    attachDistances(rows, subjectCoords.lat, subjectCoords.lng),
    subjectCity,
    subjectCoords,
  );
}

export function parseSubjectAreaSqm(
  subjectAreaField: string,
  propertyArea?: string,
): number | null {
  const fromUi = Number(String(subjectAreaField ?? "").replace(",", "."));
  if (Number.isFinite(fromUi) && fromUi > 0) return fromUi;
  const fromProp = Number(String(propertyArea ?? "").replace(",", "."));
  if (Number.isFinite(fromProp) && fromProp > 0) return fromProp;
  return null;
}

export type BankCandidatesResult = {
  ok: boolean;
  data: ComparablePropertyDto[];
  distances: Record<string, number>;
  subjectCoords: { lat: number; lng: number } | null;
};

/**
 * Display bank for the appraiser:
 * 1) Nearest comps within NEARBY_RADIUS_KM of the subject
 * 2) Same city only when subject coordinates are unknown
 */
export async function fetchBankCandidates(
  config: { token: string; baseUrl: string },
  opts: {
    q?: string;
    propertyId?: string;
    district?: string;
    city?: string;
    deedNumber?: string;
    locationMapUrl?: string;
    propertyType?: string;
    subjectSqm: number | null;
    latitude?: number | null;
    longitude?: number | null;
  },
): Promise<BankCandidatesResult> {
  const subjectCoords = resolveSubjectCoordsForBank(opts);
  const search = opts.q?.trim() ?? "";

  if (search) {
    const rows = await listBankPool(config, {
      q: search,
      city: opts.city || undefined,
      propertyId: opts.propertyId || undefined,
      propertyType: opts.propertyType || undefined,
    });
    let items: RankedItem[] = rows.map((comparable) => ({ comparable }));
    if (subjectCoords) {
      items = attachDistances(
        rows,
        subjectCoords.lat,
        subjectCoords.lng,
      );
    }
    items = filterNearSubject(items, opts.city, subjectCoords);
    return finalizeBankResultFromItems(items, opts.subjectSqm, subjectCoords);
  }

  if (subjectCoords) {
    const prox = await suggestComparablePropertiesByProximity(config, {
      propertyId: opts.propertyId || undefined,
      latitude: subjectCoords.lat,
      longitude: subjectCoords.lng,
      take: BANK_CANDIDATE_POOL,
      maxDistanceKm: NEARBY_RADIUS_KM,
    });

    if (prox.ok && prox.data.items.length > 0) {
      let items: RankedItem[] = prox.data.items.map((row) => ({
        comparable: row.comparable,
        distanceKm: row.distanceKm,
      }));
      items = filterNearSubject(items, opts.city, subjectCoords);
      if (items.length > 0) {
        return finalizeBankResultFromItems(items, opts.subjectSqm, subjectCoords);
      }
    }

    const items = await listNearSubjectPool(
      config,
      {
        city: opts.city || undefined,
        propertyId: opts.propertyId || undefined,
        propertyType: opts.propertyType || undefined,
      },
      subjectCoords,
      opts.city,
    );
    return finalizeBankResultFromItems(items, opts.subjectSqm, subjectCoords);
  }

  const rows = await listBankPool(config, {
    city: opts.city || undefined,
    propertyId: opts.propertyId || undefined,
    propertyType: opts.propertyType || undefined,
  });
  const items = filterNearSubject(
    rows.map((comparable) => ({ comparable })),
    opts.city,
  );
  return finalizeBankResultFromItems(items, opts.subjectSqm, null);
}

export type BankDisplayRow = {
  key: string;
  selected: boolean;
  adopted: boolean;
  comp: ComparablePropertyDto;
  item?: ValuationComparableSelectionDto;
};

/** Merge selection + candidates — only near-subject rows, nearest first. */
export function buildBankDisplayRows(opts: {
  selectionItems: ValuationComparableSelectionDto[];
  candidates: ComparablePropertyDto[];
  subjectCity?: string | null;
  subjectCoords?: { lat: number; lng: number } | null;
  subjectSqm?: number | null;
  limit?: number;
}): { rows: BankDisplayRow[]; distances: Record<string, number> } {
  const limit = opts.limit ?? BANK_DISPLAY_LIMIT;
  const itemByCompId = new Map<string, ValuationComparableSelectionDto>();
  const compById = new Map<string, ComparablePropertyDto>();

  for (const item of opts.selectionItems) {
    compById.set(item.comparable.id, item.comparable);
    itemByCompId.set(item.comparable.id, item);
  }
  for (const comp of opts.candidates) {
    if (!compById.has(comp.id)) compById.set(comp.id, comp);
  }

  const ranked: RankedItem[] = [...compById.values()].map((comparable) => {
    let distanceKm: number | null = null;
    if (
      opts.subjectCoords &&
      hasUsableCoords(comparable.latitude, comparable.longitude)
    ) {
      distanceKm = haversineKm(
        opts.subjectCoords.lat,
        opts.subjectCoords.lng,
        comparable.latitude,
        comparable.longitude,
      );
    }
    return { comparable, distanceKm };
  });

  const eligible = filterNearSubject(
    ranked,
    opts.subjectCity,
    opts.subjectCoords,
  );

  const ordered = [...eligible]
    .sort((a, b) => {
      const distA = a.distanceKm ?? Number.POSITIVE_INFINITY;
      const distB = b.distanceKm ?? Number.POSITIVE_INFINITY;
      if (distA !== distB) return distA - distB;
      if (opts.subjectSqm != null && opts.subjectSqm > 0) {
        const da = Math.abs((a.comparable.areaSqm || 0) - opts.subjectSqm);
        const db = Math.abs((b.comparable.areaSqm || 0) - opts.subjectSqm);
        if (da !== db) return da - db;
      }
      return (b.comparable.transactionDate || "").localeCompare(
        a.comparable.transactionDate || "",
      );
    })
    .slice(0, limit);

  const distances: Record<string, number> = {};
  const rows: BankDisplayRow[] = ordered.map((row) => {
    const item = itemByCompId.get(row.comparable.id);
    if (row.distanceKm != null && Number.isFinite(row.distanceKm)) {
      distances[row.comparable.id] = row.distanceKm;
    }
    return {
      key: item?.id ?? row.comparable.id,
      selected: Boolean(item),
      adopted: item?.isAdopted ?? false,
      comp: row.comparable,
      item,
    };
  });

  return { rows, distances };
}
