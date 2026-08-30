import {
  listComparableProperties,
  suggestComparablePropertiesByProximity,
  type ComparablePropertyDto,
} from "@platform/api-client";

/** HTML `.grid` cols — finance-ui.css comparable bank table (+ distance km). */
export const BANK_COLS =
  "70px minmax(132px,1.1fr) minmax(100px,.9fr) minmax(122px,1fr) 112px minmax(96px,.85fr) minmax(108px,.95fr) 92px 88px 72px minmax(84px,.75fr) minmax(120px,1.1fr)";

export const BANK_CANDIDATE_POOL = 40;
export const BANK_DISPLAY_LIMIT = 6;

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

/** Closest area to the subject first, then closest distance when available. */
export function rankBankCandidatesByArea(
  items: { comparable: ComparablePropertyDto; distanceKm?: number | null }[],
  subjectSqm: number | null,
  limit = BANK_DISPLAY_LIMIT,
): ComparablePropertyDto[] {
  const ranked = [...items].sort((a, b) => {
    if (subjectSqm != null && subjectSqm > 0) {
      const da = Math.abs((a.comparable.areaSqm || 0) - subjectSqm);
      const db = Math.abs((b.comparable.areaSqm || 0) - subjectSqm);
      if (da !== db) return da - db;
    }
    const distA = a.distanceKm ?? Number.POSITIVE_INFINITY;
    const distB = b.distanceKm ?? Number.POSITIVE_INFINITY;
    if (distA !== distB) return distA - distB;
    return (b.comparable.transactionDate || "").localeCompare(
      a.comparable.transactionDate || "",
    );
  });
  return ranked.slice(0, limit).map((x) => x.comparable);
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
};

/**
 * Display bank for the appraiser:
 * 1) Geographic proximity within 5 km (no district filter — bank is often neighboring districts)
 * 2) If empty: full bank list sorted by closest area to the subject
 * Text search is not district-restricted when it would return zero results.
 */
export async function fetchBankCandidates(
  config: { token: string; baseUrl: string },
  opts: {
    q?: string;
    propertyId?: string;
    district?: string;
    propertyType?: string;
    subjectSqm: number | null;
  },
): Promise<BankCandidatesResult> {
  const search = opts.q?.trim() ?? "";
  if (search) {
    const withDistrict = await listComparableProperties(config, {
      q: search,
      district: opts.district || undefined,
      take: BANK_CANDIDATE_POOL,
      forPropertyId: opts.propertyId || undefined,
    });
    if (!withDistrict.ok) return { ok: false, data: [], distances: {} };
    let rows = withDistrict.data;
    if (rows.length === 0 && opts.district) {
      const wide = await listComparableProperties(config, {
        q: search,
        take: BANK_CANDIDATE_POOL,
        forPropertyId: opts.propertyId || undefined,
      });
      if (!wide.ok) return { ok: false, data: [], distances: {} };
      rows = wide.data;
    }
    return {
      ok: true,
      data: rankBankCandidatesByArea(
        rows.map((comparable) => ({ comparable })),
        opts.subjectSqm,
      ),
      distances: {},
    };
  }

  // Proximity without district: “within 5 km” is enough; district filter hid Al-Yasmin records for a subject in Al-Malqa.
  const prox = await suggestComparablePropertiesByProximity(config, {
    propertyId: opts.propertyId || undefined,
    take: BANK_CANDIDATE_POOL,
    maxDistanceKm: 5,
    propertyType: opts.propertyType || undefined,
  });
  if (prox.ok && prox.data.items.length > 0) {
    const distances: Record<string, number> = {};
    for (const row of prox.data.items) {
      distances[row.comparable.id] = row.distanceKm;
    }
    return {
      ok: true,
      data: rankBankCandidatesByArea(
        prox.data.items.map((row) => ({
          comparable: row.comparable,
          distanceKm: row.distanceKm,
        })),
        opts.subjectSqm,
      ),
      distances,
    };
  }

  // No subject coords / outside 5 km / different type → show from the full bank (no district filter).
  const listed = await listComparableProperties(config, {
    take: BANK_CANDIDATE_POOL,
    forPropertyId: opts.propertyId || undefined,
    propertyType: opts.propertyType || undefined,
  });
  if (!listed.ok) return { ok: false, data: [], distances: {} };
  let rows = listed.data;
  if (rows.length === 0 && opts.propertyType) {
    const anyType = await listComparableProperties(config, {
      take: BANK_CANDIDATE_POOL,
      forPropertyId: opts.propertyId || undefined,
    });
    if (!anyType.ok) return { ok: false, data: [], distances: {} };
    rows = anyType.data;
  }
  return {
    ok: true,
    data: rankBankCandidatesByArea(
      rows.map((comparable) => ({ comparable })),
      opts.subjectSqm,
    ),
    distances: {},
  };
}
