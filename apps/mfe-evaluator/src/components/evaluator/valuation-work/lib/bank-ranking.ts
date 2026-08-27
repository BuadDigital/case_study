import {
  listComparableProperties,
  suggestComparablePropertiesByProximity,
  type ComparablePropertyDto,
} from "@platform/api-client";

/** HTML `.grid` cols — finance-ui.css comparable bank table (+ مسافة كم). */
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

/** مواصفة النموذج التفاعلي: النسبة = الأكبر ÷ الأصغر (≥ ١)؛ ≥ ٢ تعني طريقة المضاعف وتُلوَّن حمراء. */
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

/** أقرب مساحة لعقار التقييم أولاً، ثم أقرب مسافة إن وُجدت. */
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
 * بنك العرض: البحث النصي يجلب دفعة ويُرتِّبها حسب أقرب مساحة؛ وبدونه مرشحو القرب
 * ضمن ٥ كم ثم قائمة الحي. نداء مستقل — لا يستدعي إعادة تحميل بقية الشاشة.
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
    const listed = await listComparableProperties(config, {
      q: search,
      district: opts.district || undefined,
      take: BANK_CANDIDATE_POOL,
      forPropertyId: opts.propertyId || undefined,
    });
    if (!listed.ok) return { ok: false, data: [], distances: {} };
    return {
      ok: true,
      data: rankBankCandidatesByArea(
        listed.data.map((comparable) => ({ comparable })),
        opts.subjectSqm,
      ),
      distances: {},
    };
  }
  const prox = await suggestComparablePropertiesByProximity(config, {
    propertyId: opts.propertyId || undefined,
    take: BANK_CANDIDATE_POOL,
    maxDistanceKm: 5,
    district: opts.district || undefined,
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
  const listed = await listComparableProperties(config, {
    district: opts.district || undefined,
    take: BANK_CANDIDATE_POOL,
    forPropertyId: opts.propertyId || undefined,
  });
  if (!listed.ok) return { ok: false, data: [], distances: {} };
  return {
    ok: true,
    data: rankBankCandidatesByArea(
      listed.data.map((comparable) => ({ comparable })),
      opts.subjectSqm,
    ),
    distances: {},
  };
}
