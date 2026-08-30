import { getApiBase } from "./api-base";
import { repositoryFetch as fetch } from "./write-repository";
import { parseJson } from "./parse-json";

export type ComparableSourceCardDto = {
  intakeChannel: string;
  intakeChannelLabelAr: string;
  freshness: string;
  freshnessLabelAr: string;
  fromPriorDeal: boolean;
  sourceWorkOrderNumber?: string | null;
};

export type ComparablePropertyDto = {
  id: string;
  referenceCode: string;
  comparablePropertyType: string;
  /** استخدام المقارن — قائمة مغلقة (ق-3/5). */
  usage: string;
  transactionKind: string;
  transactionKindLabelAr: string;
  priceDescription: string;
  priceDescriptionLabelAr: string;
  source: string;
  listingNumber?: string | null;
  /** ق-3/3: مرجع صفقة البورصة للمنفّذ. */
  transactionReference?: string | null;
  advertiserPhone?: string | null;
  listingImageFileName?: string | null;
  latitude: number;
  longitude: number;
  areaSqm: number;
  transactionDate: string;
  price: number;
  pricePerSqm: number;
 /** anomaly notice — advisory. */
  pricePerSqmAnomalyNoteAr?: string | null;
  city?: string | null;
  district: string;
  planNumber?: string | null;
  plotNumber?: string | null;
  description?: string | null;
  intakeChannel: string;
  enteredByUserId?: string | null;
  enteredAtUtc: string;
  sourceWorkOrderNumber?: string | null;
  sourcePropertyId?: string | null;
  isActive: boolean;
  /** ق-3: وسوم الجودة البشرية — normal | anomalous | unreliable. */
  reliabilityTag: string;
  reliabilityTagLabelAr: string;
  isDuplicateTagged: boolean;
  tagRationale?: string | null;
  taggedByUserId?: string | null;
  taggedAtUtc?: string | null;
  /** موسوم فيُستبعد من الاقتراحات ويُميَّز بصرياً. */
  isExcludedFromSuggestions: boolean;
  /** اشتباه تكرار آلي (سجل آخر بنفس الموقع) — اقتراح فقط. */
  duplicateSuspect: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
  sourceCard: ComparableSourceCardDto;
};

/** ق-3: وضع/تحديث وسوم الجودة بمبرر — السجل يبقى. */
export type SaveComparableQualityTagsRequest = {
  reliabilityTag: string;
  isDuplicateTagged: boolean;
  tagRationale?: string | null;
};

export type UpsertComparablePropertyRequest = {
  comparablePropertyType: string;
  /** استخدام المقارن — قائمة مغلقة (ق-3/5). */
  usage?: string | null;
  transactionKind: string;
  priceDescription?: string | null;
  source: string;
  listingNumber?: string | null;
  /** ق-3/3: مرجع الصفقة — للمنفّذ. */
  transactionReference?: string | null;
  advertiserPhone?: string | null;
  listingImageFileName?: string | null;
  latitude: number;
  longitude: number;
  areaSqm: number;
  transactionDate: string;
  price: number;
  city?: string | null;
  district: string;
  planNumber?: string | null;
  plotNumber?: string | null;
  description?: string | null;
  intakeChannel: string;
  sourceWorkOrderNumber?: string | null;
  sourcePropertyId?: string | null;
  isActive?: boolean;
};

export type ComparablePropertyListQuery = {
  district?: string;
  city?: string;
  transactionKind?: string;
  source?: string;
  intakeChannel?: string;
  propertyType?: string;
  q?: string;
  fromDate?: string;
  toDate?: string;
  includeInactive?: boolean;
  take?: number;
  /** مواصفة-طريقة-المقارنة: أولوية ميداني لهذا العقار. */
  forPropertyId?: string;
};

export type ComparableProximityQuery = {
  propertyId?: string;
  latitude?: number;
  longitude?: number;
  maxDistanceKm?: number;
  take?: number;
  excludeIds?: string;
  district?: string;
  propertyType?: string;
};

export type ComparableProximitySuggestionDto = {
  comparable: ComparablePropertyDto;
  distanceKm: number;
};

export type ComparableProximitySuggestionListDto = {
  subjectLatitude?: number | null;
  subjectLongitude?: number | null;
  subjectCoordSource: string;
  maxDistanceKm: number;
  items: ComparableProximitySuggestionDto[];
};

export type ComparablePropertiesApiConfig = {
  baseUrl?: string;
  token: string;
};

type Result<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      kind: "auth" | "network" | "server" | "validation";
      message?: string;
      errors?: Record<string, string>;
    };

function headers(token: string): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}


export async function listComparableProperties(
  config: ComparablePropertiesApiConfig,
  query: ComparablePropertyListQuery = {},
): Promise<Result<ComparablePropertyDto[]>> {
  const base = config.baseUrl ?? getApiBase();
  const qs = new URLSearchParams();
  if (query.district) qs.set("district", query.district);
  if (query.city) qs.set("city", query.city);
  if (query.transactionKind) qs.set("transactionKind", query.transactionKind);
  if (query.source) qs.set("source", query.source);
  if (query.intakeChannel) qs.set("intakeChannel", query.intakeChannel);
  if (query.propertyType) qs.set("propertyType", query.propertyType);
  if (query.q) qs.set("q", query.q);
  if (query.fromDate) qs.set("fromDate", query.fromDate);
  if (query.toDate) qs.set("toDate", query.toDate);
  if (query.includeInactive) qs.set("includeInactive", "true");
  if (query.take) qs.set("take", String(query.take));
  if (query.forPropertyId) qs.set("forPropertyId", query.forPropertyId);
  try {
    const res = await fetch(
      `${base}/api/comparable-properties?${qs}`,
      { headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    const data = await parseJson<ComparablePropertyDto[]>(res);
    return { ok: true, data: Array.isArray(data) ? data : [] };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function suggestComparablePropertiesByProximity(
  config: ComparablePropertiesApiConfig,
  query: ComparableProximityQuery = {},
): Promise<Result<ComparableProximitySuggestionListDto>> {
  const base = config.baseUrl ?? getApiBase();
  const qs = new URLSearchParams();
  if (query.propertyId) qs.set("propertyId", query.propertyId);
  if (query.latitude != null) qs.set("latitude", String(query.latitude));
  if (query.longitude != null) qs.set("longitude", String(query.longitude));
  if (query.maxDistanceKm != null) qs.set("maxDistanceKm", String(query.maxDistanceKm));
  if (query.take != null) qs.set("take", String(query.take));
  if (query.excludeIds) qs.set("excludeIds", query.excludeIds);
  if (query.district) qs.set("district", query.district);
  if (query.propertyType) qs.set("propertyType", query.propertyType);
  try {
    const res = await fetch(
      `${base}/api/comparable-properties/proximity-suggestions?${qs}`,
      { headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    return {
      ok: true,
      data: await parseJson<ComparableProximitySuggestionListDto>(res),
    };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function createComparableProperty(
  config: ComparablePropertiesApiConfig,
  body: UpsertComparablePropertyRequest,
): Promise<Result<ComparablePropertyDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/comparable-properties`, {
      method: "POST",
      headers: headers(config.token),
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 400) {
      const payload = (await res.json().catch(() => null)) as {
        errors?: Record<string, string>;
        error?: string;
      } | null;
      return {
        ok: false,
        kind: "validation",
        message:
          payload?.errors
            ? Object.values(payload.errors)[0]
            : payload?.error ?? "بيانات غير صالحة",
        errors: payload?.errors,
      };
    }
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as {
        detail?: string;
        title?: string;
        error?: string;
        message?: string;
      } | null;
      return {
        ok: false,
        kind: "server",
        message:
          payload?.detail ??
          payload?.title ??
          payload?.error ??
          payload?.message ??
          "تعذّر حفظ المقارن",
      };
    }
    return { ok: true, data: await parseJson<ComparablePropertyDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function updateComparableProperty(
  config: ComparablePropertiesApiConfig,
  id: string,
  body: UpsertComparablePropertyRequest,
): Promise<Result<ComparablePropertyDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/comparable-properties/${id}`, {
      method: "PUT",
      headers: headers(config.token),
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 400) {
      const payload = (await res.json().catch(() => null)) as {
        errors?: Record<string, string>;
        error?: string;
      } | null;
      return {
        ok: false,
        kind: "validation",
        message:
          payload?.errors
            ? Object.values(payload.errors)[0]
            : payload?.error ?? "بيانات غير صالحة",
        errors: payload?.errors,
      };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await parseJson<ComparablePropertyDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

/** ق-3: وسوم الجودة البشرية — يضعها ذو صفة بمبرر، والسجل يبقى موسوماً. */
export async function setComparableQualityTags(
  config: ComparablePropertiesApiConfig,
  id: string,
  body: SaveComparableQualityTagsRequest,
): Promise<Result<ComparablePropertyDto>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/comparable-properties/${id}/quality-tags`, {
      method: "PUT",
      headers: headers(config.token),
      body: JSON.stringify(body),
    });
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (res.status === 400) {
      const payload = (await res.json().catch(() => null)) as {
        errors?: Record<string, string>;
      } | null;
      return {
        ok: false,
        kind: "validation",
        message: payload?.errors
          ? Object.values(payload.errors)[0]
          : "بيانات الوسم غير صالحة",
        errors: payload?.errors,
      };
    }
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: await parseJson<ComparablePropertyDto>(res) };
  } catch {
    return { ok: false, kind: "network" };
  }
}

export async function deactivateComparableProperty(
  config: ComparablePropertiesApiConfig,
  id: string,
): Promise<Result<null>> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(
      `${base}/api/comparable-properties/${id}/deactivate`,
      { method: "POST", headers: headers(config.token) },
    );
    if (res.status === 401) return { ok: false, kind: "auth" };
    if (!res.ok) return { ok: false, kind: "server" };
    return { ok: true, data: null };
  } catch {
    return { ok: false, kind: "network" };
  }
}
