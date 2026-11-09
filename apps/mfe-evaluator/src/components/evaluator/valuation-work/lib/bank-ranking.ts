// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 2 (1b19bedc)
//  • Adopted comparables always show in the bank (whatever the radius or the limit) and are not
//          counted as «beyond»; the nearest others fill the rest of the limit (buildBankDisplayRows).
// ──────────────────────────────────────────────────────────────────────────────────────────────

import { listComparableProperties,suggestComparablePropertiesByProximity, 
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

// Wide enough that the subject's kind is in the pool: with 40, an apartment amid many nearby land
// deals got lands only (A→Z #43), and the type filter below had nothing to show.
const BANK_CANDIDATE_POOL = 120;
export const BANK_DISPLAY_LIMIT = 6;
export const BANK_SEARCH_DISPLAY_LIMIT = 24;
/** Maximum distance from subject when coordinates are known. */
export const NEARBY_RADIUS_KM = 3;
/**
 * How far the bank is searched around the subject. The table filters this pool by the radius the
 * appraiser picked (3 km by default), so widening the radius never needs another request.
 */
const BANK_FETCH_RADIUS_KM = 50;
/** Radius choices of the bank table — `null` is «الكل» (everything fetched). */
export const BANK_RADIUS_OPTIONS_KM: readonly (number | null)[] = [3, 10, 25, null];
/** What lies beyond the chosen radius: shown in the empty state so the appraiser knows where to go next. */
export type BankBeyond = { count: number; nearestKm: number | null };

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

/** The bank table's type filter: the subject's kind (default) or every type («كل الأنواع»). */
export type BankTypeFilter = "subject" | "all";

/**
 * Do two property type names name the same type («شقة» / «شقة سكنية», «فيلا» / «فيلا دوبلكس»)?
 *
 * How it works: both are normalized (`normalizeArabicSearchText`: hamza, taa marbuta, spacing) and
 * one must contain the other.
 *
 * Edge cases: an empty type never matches.
 */
function sameComparableType(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeArabicSearchText(a ?? "");
  const nb = normalizeArabicSearchText(b ?? "");
  return Boolean(na && nb) && (na.includes(nb) || nb.includes(na));
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

function filterNearSubject(
  items: RankedItem[],
  subjectCity: string | null | undefined,
  subjectCoords?: { lat: number; lng: number } | null,
  radiusKm: number = NEARBY_RADIUS_KM,
): RankedItem[] {
  const subjectHasCoords = Boolean(subjectCoords);
  return items.filter((row) => {
    let distanceKm = row.distanceKm ?? null;
    if (
      subjectCoords &&
      distanceKm == null &&
      hasUsableCoords(row.comparable.latitude, row.comparable.longitude)
    ) {
      distanceKm = haversineKm(subjectCoords, {
        lat: row.comparable.latitude,
        lng: row.comparable.longitude,
      });
    }
    return isNearSubjectComparable(
      row.comparable,
      subjectCity,
      distanceKm,
      subjectHasCoords,
      radiusKm,
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

/** Closest distance first, then closest area to the subject. */
function rankBankCandidates(
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

function buildDistancesMap(items: RankedItem[]): Record<string, number> {
  const distances: Record<string, number> = {};
  for (const row of items) {
    if (row.distanceKm != null && Number.isFinite(row.distanceKm)) {
      distances[row.comparable.id] = row.distanceKm;
    }
  }
  return distances;
}

/**
 * The fetched pool, nearest first. It stays wider than the table: the land table filters this pool by
 * kind, so cutting it to the display limit here left a villa's land table empty whenever six buildings
 * lay nearer. `buildBankDisplayRows` applies the display limit.
 */
function finalizeBankResultFromItems(
  items: RankedItem[],
  subjectSqm: number | null,
  subjectCoords: { lat: number; lng: number } | null,
  limit = BANK_CANDIDATE_POOL,
): BankCandidatesResult {
  const ranked = rankBankCandidates(items, subjectSqm, limit);
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
  },
): Promise<ComparablePropertyDto[]> {
  const res = await listComparableProperties(config, {
    q: opts.q || undefined,
    city: opts.city || undefined,
    take: BANK_CANDIDATE_POOL,
    forPropertyId: opts.propertyId || undefined,
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
  },
  subjectCoords: { lat: number; lng: number },
  subjectCity?: string | null,
): Promise<RankedItem[]> {
  const attempts: {
    q?: string;
    city?: string;
    propertyId?: string;
  }[] = [
    opts,
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
    BANK_FETCH_RADIUS_KM,
  );
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

type BankCandidatesResult = {
  ok: boolean;
  data: ComparablePropertyDto[];
  distances: Record<string, number>;
  subjectCoords: { lat: number; lng: number } | null;
};

/**
 * Display bank for the appraiser:
 * 1) Nearest comps within NEARBY_RADIUS_KM of the subject
 * 2) Same city only when subject coordinates are unknown
 *
 * How it works: a search goes to the whole bank; a subject with coordinates asks the proximity
 * endpoint; a subject with none lists the bank by city and matches the city loosely on the client.
 *
 * Edge cases: the property type filters nothing here. The bank saves every land comparable as the
 * bare «أرض» and the server matches by `Contains`, so a «أرض سكنية», a «فيلا» or a «مزرعة» never matched
 * one: a land comparable vanished from this table while the bank page still listed it.
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
      propertyId: opts.propertyId || undefined,
    });
    let items: RankedItem[] = subjectCoords
      ? attachDistances(rows, subjectCoords.lat, subjectCoords.lng)
      : rows.map((comparable) => ({ comparable }));
    return finalizeBankResultFromItems(
      items,
      opts.subjectSqm,
      subjectCoords,
      BANK_SEARCH_DISPLAY_LIMIT,
    );
  }

  if (subjectCoords) {
    const prox = await suggestComparablePropertiesByProximity(config, {
      propertyId: opts.propertyId || undefined,
      latitude: subjectCoords.lat,
      longitude: subjectCoords.lng,
      take: BANK_CANDIDATE_POOL,
      maxDistanceKm: BANK_FETCH_RADIUS_KM,
    });

    if (prox.ok && prox.data.items.length > 0) {
      let items: RankedItem[] = prox.data.items.map((row) => ({
        comparable: row.comparable,
        distanceKm: row.distanceKm,
      }));
      items = filterNearSubject(items, opts.city, subjectCoords, BANK_FETCH_RADIUS_KM);
      if (items.length > 0) {
        return finalizeBankResultFromItems(items, opts.subjectSqm, subjectCoords);
      }
    }

    const items = await listNearSubjectPool(
      config,
      {
        city: opts.city || undefined,
        propertyId: opts.propertyId || undefined,
      },
      subjectCoords,
      opts.city,
    );
    return finalizeBankResultFromItems(items, opts.subjectSqm, subjectCoords);
  }

  const rows = await listBankPool(config, {
    city: opts.city || undefined,
    propertyId: opts.propertyId || undefined,
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

/**
 * Merge selection + candidates — nearby rows by default, or search hits when nearbyOnly is false.
 *
 * How it works: the property's own rows (`selectionItems`: entered inside its transaction, or chosen
 * for it) always show, whatever the radius, the city or the limit. The nearest others fill the rest.
 * With `preferLand`, land comparables fill it first.
 *
 * With `subjectKind`, the type filter (`typeFilter`, default «subject») keeps only comparables of the
 * subject's kind (land ↔ buildings); «all» keeps every type. Either way the subject's own type
 * (`subjectType`, e.g. «شقة») fills the free rows first, then its kind, then the rest.
 *
 * Edge cases: an own row the appraiser un-adopted stays, so it can be adopted again; only adopted rows
 * used to be kept, and an un-adopted one farther than the radius disappeared with no way back but
 * search. `preferLand` orders and never filters, so a building comparable can still fill a free row.
 * The property's own rows are never filtered by type. Fixed 2026-11-04 (A→Z #43/#60): the bank had
 * no type filter — an apartment's market bank showed six lands (even with «الكل») and a land's showed
 * villas; «الكل» counted as all types though it only widened the radius. «beyond» counts only
 * comparables the type filter keeps.
 */
export function buildBankDisplayRows(opts: {
  selectionItems: ValuationComparableSelectionDto[];
  candidates: ComparablePropertyDto[];
  subjectCity?: string | null;
  subjectCoords?: { lat: number; lng: number } | null;
  subjectSqm?: number | null;
  limit?: number;
  nearbyOnly?: boolean;
  /** The radius the appraiser picked; `null` shows everything fetched. Default 3 km. */
  radiusKm?: number | null;
  /** The subject is valued as land: land comparables take the free rows before buildings. */
  preferLand?: boolean;
  /** What the subject is compared as — enables the type filter and the type ordering. */
  subjectKind?: "land" | "building" | null;
  /** The subject's own type («شقة», «فيلا») — its comparables come first. */
  subjectType?: string | null;
  /** «subject» (default) keeps the subject's kind only; «all» keeps every type. */
  typeFilter?: BankTypeFilter;
}): { rows: BankDisplayRow[]; distances: Record<string, number>; beyond: BankBeyond } {
  const limit = opts.limit ?? BANK_DISPLAY_LIMIT;
  const nearbyOnly = opts.nearbyOnly !== false;
  const itemByCompId = new Map<string, ValuationComparableSelectionDto>();
  const compById = new Map<string, ComparablePropertyDto>();

  if (nearbyOnly) {
    for (const item of opts.selectionItems) {
      compById.set(item.comparable.id, item.comparable);
      itemByCompId.set(item.comparable.id, item);
    }
  }
  for (const comp of opts.candidates) {
    if (!compById.has(comp.id)) compById.set(comp.id, comp);
  }
  if (!nearbyOnly) {
    const candidateIds = new Set(opts.candidates.map((c) => c.id));
    for (const item of opts.selectionItems) {
      if (!candidateIds.has(item.comparable.id)) continue;
      itemByCompId.set(item.comparable.id, item);
    }
  }

  const allRanked: RankedItem[] = [...compById.values()].map((comparable) => {
    let distanceKm: number | null = null;
    if (
      opts.subjectCoords &&
      hasUsableCoords(comparable.latitude, comparable.longitude)
    ) {
      distanceKm = haversineKm(opts.subjectCoords, {
        lat: comparable.latitude,
        lng: comparable.longitude,
      });
    }
    return { comparable, distanceKm };
  });

  const kindOf = (row: RankedItem): "land" | "building" =>
    isVacantLandComparable(row.comparable.comparablePropertyType) ? "land" : "building";
  const subjectKind = opts.subjectKind ?? null;
  const filterByKind = subjectKind != null && (opts.typeFilter ?? "subject") === "subject";
  const ranked = filterByKind
    ? allRanked.filter((row) => itemByCompId.has(row.comparable.id) || kindOf(row) === subjectKind)
    : allRanked;

  const radiusKm = opts.radiusKm === undefined ? NEARBY_RADIUS_KM : opts.radiusKm;
  const eligible = nearbyOnly
    ? filterNearSubject(
        ranked,
        opts.subjectCity,
        opts.subjectCoords,
        radiusKm ?? BANK_FETCH_RADIUS_KM,
      )
    : ranked;

  // What the chosen radius leaves out, so an empty table can say where the nearest ones are.
  const eligibleIds = new Set(eligible.map((row) => row.comparable.id));
  const farther = nearbyOnly
    ? ranked.filter(
        (row) =>
          !eligibleIds.has(row.comparable.id) &&
          // The property's own row outside the radius still shows (below) — it is not «beyond».
          !itemByCompId.has(row.comparable.id) &&
          row.distanceKm != null &&
          Number.isFinite(row.distanceKm),
      )
    : [];
  const beyond: BankBeyond = {
    count: farther.length,
    nearestKm: farther.length
      ? Math.min(...farther.map((row) => row.distanceKm as number))
      : null,
  };

  const byNearest = (a: RankedItem, b: RankedItem) => {
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
  };
  const isOwn = (row: RankedItem) => itemByCompId.has(row.comparable.id);
  const ownRows = ranked.filter(isOwn);
  const isLand = (row: RankedItem) => kindOf(row) === "land";
  const nearest = eligible.filter((row) => !isOwn(row)).sort(byNearest);
  // 0 = the subject's own type, 1 = its kind, 2 = the rest (stable sort keeps the nearest first).
  const typeRank = (row: RankedItem): number => {
    if (subjectKind == null) return opts.preferLand && !isLand(row) ? 1 : 0;
    if (kindOf(row) !== subjectKind) return 2;
    return subjectKind === "building" &&
      opts.subjectType?.trim() &&
      !sameComparableType(row.comparable.comparablePropertyType, opts.subjectType)
      ? 1
      : 0;
  };
  const others = [...nearest]
    .sort((a, b) => typeRank(a) - typeRank(b))
    .slice(0, Math.max(0, limit - ownRows.length));
  const ordered = [...ownRows, ...others].sort(byNearest);

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

  return { rows, distances, beyond };
}
