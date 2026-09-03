/** Studied-locations map logic — v2.0. Pure layer with no DOM. */

export const POINT_FAMILIES = {
  property: "عقارات النظام",
  comparable: "مقارنات السوق",
} as const;

export const LAYERS = {
  active: {
    key: "active",
    label: "أوامر العمل النشطة",
    family: "property" as const,
    defaultOn: true,
  },
  archive: {
    key: "archive",
    label: "الأرشيف (المغلق)",
    family: "property" as const,
    defaultOn: false,
  },
  comparables: {
    key: "comparables",
    label: "مقارنات السوق",
    family: "comparable" as const,
    defaultOn: false,
  },
} as const;

export type LayerKey = keyof typeof LAYERS;

export const WORKFLOW_STATUS = {
  in_progress: { key: "in_progress", label: "قيد العمل" },
  issued: { key: "issued", label: "صادر" },
  infeasible_candidate: { key: "infeasible_candidate", label: "مرشح تعذر" },
  infeasible: { key: "infeasible", label: "متعذر" },
} as const;

export type WorkflowStatusKey = keyof typeof WORKFLOW_STATUS;

export type MapCoords = { lat: number; lng: number };

export type MapPropertyRecord = {
  id: string;
  refNo: string;
  deedNo: string;
  deedType: string;
  propertyType: string;
  city: string;
  district: string;
  area: number | null;
  client: string;
  assignmentType: string;
  workflowStatus: WorkflowStatusKey;
  openedDate: string | null;
  valuationDate: string | null;
  issueDate: string | null;
  closedDate: string | null;
  finalValue: number | null;
  valuer: string | null;
  coords: MapCoords | null;
  coordsSource: string | null;
  propertyGroupId: string | null;
  poNumber?: string;
  propertyId?: string;
};

export type MapComparableRecord = {
  id: string;
  refNo: string;
  comparableType: string;
  operationType: string;
  priceDescription: string | null;
  operationDate: string | null;
  price: number | null;
  area: number | null;
  city: string;
  district: string;
  source: string | null;
  approved: boolean;
  description: string | null;
  coords: MapCoords | null;
};

export type DatePreset =
  | "all"
  | "today"
  | "7d"
  | "90d"
  | "1y"
  | "month"
  | "year"
  | "2025"
  | "2026";

export type PropertyKindCat = "أرض" | "مبنى";
export type PropertyUsageCat = "سكني" | "تجاري" | "زراعي" | "خدمات" | "أخرى";

export function isLandType(type: string | null | undefined): boolean {
  return (type || "").startsWith("أرض");
}

export function usageOf(type: string | null | undefined): PropertyUsageCat {
  const t = type || "";
  if (t.includes("سكني") || t === "فيلا" || t === "شقة") return "سكني";
  if (t.includes("تجاري") || t === "مستودع") return "تجاري";
  if (t.includes("زراعي")) return "زراعي";
  if (t.includes("خدم")) return "خدمات";
  return "أخرى";
}

export type FilterCriteria = {
  city?: string;
  propertyType?: string;
  assignmentType?: string;
  workflowStatuses?: WorkflowStatusKey[];
  expiredOnly?: boolean;
  datePreset?: DatePreset;
  dateFrom?: Date | null;
  dateTo?: Date | null;
  query?: string;
  comparableType?: string;
  operationType?: string;
  approvedOnly?: boolean;
  kindCat?: PropertyKindCat | "";
  usage?: PropertyUsageCat | "";
  infeasOnly?: boolean;
};

export type DateRange = { from: Date | null; to: Date | null };

export const REPORT_VALIDITY_DAYS = 90;

export function isActive(r: Pick<MapPropertyRecord, "closedDate">): boolean {
  return !r.closedDate;
}

export function isReportExpired(
  r: Pick<MapPropertyRecord, "workflowStatus" | "issueDate">,
  now = new Date(),
): boolean {
  if (r.workflowStatus !== "issued" || !r.issueDate) return false;
  const expiry = new Date(r.issueDate);
  expiry.setDate(expiry.getDate() + REPORT_VALIDITY_DAYS);
  return now > expiry;
}

export function hasCoords(r: { coords: MapCoords | null | undefined }): boolean {
  return r.coords != null && r.coords.lat != null && r.coords.lng != null;
}

export function partitionProperties(records: MapPropertyRecord[]) {
  const active: MapPropertyRecord[] = [];
  const archive: MapPropertyRecord[] = [];
  let activeNoCoords = 0;
  let archiveNoCoords = 0;
  for (const r of records) {
    if (isActive(r)) {
      if (hasCoords(r)) active.push(r);
      else activeNoCoords += 1;
    } else if (hasCoords(r)) {
      archive.push(r);
    } else {
      archiveNoCoords += 1;
    }
  }
  return { active, archive, activeNoCoords, archiveNoCoords };
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function resolveDateRange(preset: DatePreset | string, now = new Date()): DateRange {
  switch (preset) {
    case "today":
      return { from: startOfDay(now), to: now };
    case "7d": {
      const from = new Date(now);
      from.setDate(from.getDate() - 7);
      return { from, to: now };
    }
    case "90d": {
      const from = new Date(now);
      from.setDate(from.getDate() - 90);
      return { from, to: now };
    }
    case "1y": {
      const from = new Date(now);
      from.setFullYear(from.getFullYear() - 1);
      return { from, to: now };
    }
    case "month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from, to: now };
    }
    case "year": {
      const from = new Date(now.getFullYear(), 0, 1);
      return { from, to: now };
    }
    case "2025":
      return {
        from: new Date("2025-01-01"),
        to: new Date("2025-12-31T23:59:59"),
      };
    case "2026":
      return {
        from: new Date("2026-01-01"),
        to: new Date("2026-12-31T23:59:59"),
      };
    default:
      return { from: null, to: null };
  }
}

function normalize(s: string | null | undefined): string {
  return (s || "")
    .toString()
    .toLowerCase()
    .replace(/[ً-ْ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");
}

function inRange(d: string | null | undefined, range: DateRange): boolean {
  if (!range.from && !range.to) return true;
  if (!d) return false;
  const t = new Date(d);
  if (range.from && t < range.from) return false;
  if (range.to && t > range.to) return false;
  return true;
}

function criteriaRange(c: FilterCriteria, now: Date): DateRange {
  let range: DateRange = { from: c.dateFrom || null, to: c.dateTo || null };
  if (!range.from && !range.to && c.datePreset && c.datePreset !== "all") {
    range = resolveDateRange(c.datePreset, now);
  }
  return range;
}

export function filterProperties(
  records: MapPropertyRecord[],
  criteria: FilterCriteria = {},
  now = new Date(),
): MapPropertyRecord[] {
  const c = criteria;
  const range = criteriaRange(c, now);
  const q = c.query ? normalize(c.query) : null;
  return records.filter((r) => {
    if (c.city && r.city !== c.city) return false;
    if (c.propertyType && r.propertyType !== c.propertyType) return false;
    if (c.kindCat === "أرض" && !isLandType(r.propertyType)) return false;
    if (c.kindCat === "مبنى" && isLandType(r.propertyType)) return false;
    if (c.usage && usageOf(r.propertyType) !== c.usage) return false;
    if (c.assignmentType && r.assignmentType !== c.assignmentType) return false;
    if (
      c.infeasOnly &&
      r.workflowStatus !== "infeasible" &&
      r.workflowStatus !== "infeasible_candidate"
    ) {
      return false;
    }
    if (
      c.workflowStatuses?.length &&
      !c.workflowStatuses.includes(r.workflowStatus)
    ) {
      return false;
    }
    if (c.expiredOnly && !isReportExpired(r, now)) return false;
    if (!inRange(r.valuationDate || r.openedDate, range)) return false;
    if (
      q &&
      !normalize(
        [r.deedNo, r.refNo, r.district, r.client, r.city].join(" "),
      ).includes(q)
    ) {
      return false;
    }
    return true;
  });
}

export function filterComparables(
  comparables: MapComparableRecord[],
  criteria: FilterCriteria = {},
  now = new Date(),
): MapComparableRecord[] {
  const c = criteria;
  const range = criteriaRange(c, now);
  const q = c.query ? normalize(c.query) : null;
  return comparables.filter((x) => {
    if (c.city && x.city !== c.city) return false;
    if (c.comparableType && x.comparableType !== c.comparableType) return false;
    if (c.kindCat === "أرض" && !isLandType(x.comparableType)) return false;
    if (c.kindCat === "مبنى" && isLandType(x.comparableType)) return false;
    if (c.usage && usageOf(x.comparableType) !== c.usage) return false;
    if (c.operationType && x.operationType !== c.operationType) return false;
    if (c.approvedOnly && !x.approved) return false;
    if (!inRange(x.operationDate, range)) return false;
    if (
      q &&
      !normalize(
        [x.refNo, x.district, x.city, x.source, x.description].join(" "),
      ).includes(q)
    ) {
      return false;
    }
    return true;
  });
}

export function countWithoutCoords(list: { coords: MapCoords | null }[]): number {
  return list.filter((x) => !hasCoords(x)).length;
}

export type MapSinglePoint = {
  kind: "single";
  record: MapPropertyRecord;
  coords: MapCoords | null;
  active: boolean;
};

export type MapGroupPoint = {
  kind: "group";
  groupId: string;
  members: MapPropertyRecord[];
  deedCount: number;
  active: boolean;
  coords: MapCoords | null;
};

export type MapGroupedPoint = MapSinglePoint | MapGroupPoint;

export function groupForMap(records: MapPropertyRecord[]): MapGroupedPoint[] {
  const singles: MapSinglePoint[] = [];
  const groups = new Map<string, MapPropertyRecord[]>();
  for (const r of records) {
    if (r.propertyGroupId) {
      const existing = groups.get(r.propertyGroupId) ?? [];
      existing.push(r);
      groups.set(r.propertyGroupId, existing);
    } else {
      singles.push({
        kind: "single",
        record: r,
        coords: r.coords,
        active: isActive(r),
      });
    }
  }
  const grouped: MapGroupPoint[] = [...groups.values()].map((members) => ({
    kind: "group",
    groupId: members[0]!.propertyGroupId!,
    members,
    deedCount: members.length,
    active: members.some(isActive),
    coords: members[0]!.coords,
  }));
  return [...singles, ...grouped];
}

export function computeStats(
  properties: MapPropertyRecord[],
  comparablesShown: MapComparableRecord[] = [],
  now = new Date(),
) {
  const byStatus: Partial<Record<WorkflowStatusKey, number>> = {};
  let issuedValueSum = 0;
  let expiredCount = 0;
  let activeCount = 0;
  const cities = new Set<string>();
  for (const r of properties) {
    byStatus[r.workflowStatus] = (byStatus[r.workflowStatus] || 0) + 1;
    cities.add(r.city);
    if (isActive(r)) activeCount += 1;
    if (r.workflowStatus === "issued" && typeof r.finalValue === "number") {
      issuedValueSum += r.finalValue;
    }
    if (isReportExpired(r, now)) expiredCount += 1;
  }
  return {
    total: properties.length,
    activeCount,
    archivedCount: properties.length - activeCount,
    byStatus,
    issuedValueSum,
    expiredCount,
    cityCount: cities.size,
    comparablesShown: comparablesShown.length,
  };
}

export function haversineKm(a: MapCoords, b: MapCoords): number {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function nearbyOf<T extends { id: string; coords: MapCoords | null }>(
  center: MapCoords,
  list: T[],
  radiusKm = 2,
  excludeId: string | null = null,
): { item: T; distanceKm: number }[] {
  return list
    .filter((x) => hasCoords(x) && x.id !== excludeId)
    .map((x) => ({ item: x, distanceKm: haversineKm(center, x.coords!) }))
    .filter((x) => x.distanceKm <= radiusKm)
    .sort((x, y) => x.distanceKm - y.distanceKm);
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())}`;
}

export function fmtMoney(v: number | null | undefined): string {
  if (v == null) return "-";
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 }) + " ريال";
}

export type MapCardRow = [string, string];

export type PropertyMapCard = {
  family: "property";
  active: boolean;
  workflowStatus: (typeof WORKFLOW_STATUS)[WorkflowStatusKey];
  expired: boolean;
  title: string;
  rows: MapCardRow[];
  actionId: string;
};

export function propertyCard(
  r: MapPropertyRecord,
  now = new Date(),
): PropertyMapCard {
  return {
    family: "property",
    active: isActive(r),
    workflowStatus: WORKFLOW_STATUS[r.workflowStatus],
    expired: isReportExpired(r, now),
    title: `${r.propertyType} — ${r.district}، ${r.city}`,
    rows: [
      ["الرقم المرجعي", r.refNo],
      ["رقم الصك", r.deedNo],
      ["العميل", r.client],
      ["نوع الإسناد", r.assignmentType],
      ["المساحة", r.area != null ? r.area.toLocaleString("en-US") + " م²" : "-"],
      ["تاريخ التقييم", fmtDate(r.valuationDate)],
      ["تاريخ الإصدار", fmtDate(r.issueDate)],
      ["تاريخ الإغلاق", fmtDate(r.closedDate)],
      [
        "الرأي النهائي للقيمة",
        r.workflowStatus === "issued" ? fmtMoney(r.finalValue) : "-",
      ],
      ["المقيم", r.valuer || "-"],
      ["مصدر الإحداثيات", r.coordsSource || "-"],
    ],
    actionId: r.id,
  };
}

export function pricePerSqm(c: MapComparableRecord): number | null {
  if (c.price == null || !c.area) return null;
  return c.price / c.area;
}

export type ComparableMapCard = {
  family: "comparable";
  approved: boolean;
  title: string;
  rows: MapCardRow[];
  actionId: string;
};

export function comparableCard(c: MapComparableRecord): ComparableMapCard {
  const ppsm = pricePerSqm(c);
  return {
    family: "comparable",
    approved: !!c.approved,
    title: `مقارن ${c.comparableType} — ${c.district}، ${c.city}`,
    rows: [
      ["الرقم المرجعي", c.refNo],
      ["نوع العملية", c.operationType],
      [
        "وصف السعر",
        c.operationType === "عرض" ? c.priceDescription || "-" : "-",
      ],
      ["تاريخ العملية", fmtDate(c.operationDate)],
      ["السعر", fmtMoney(c.price)],
      [
        "سعر المتر (محسوب)",
        ppsm != null ? fmtMoney(Math.round(ppsm)) : "-",
      ],
      ["المساحة", c.area != null ? c.area.toLocaleString("en-US") + " م²" : "-"],
      ["المصدر", c.source || "-"],
      ["الوصف", c.description || "-"],
    ],
    actionId: c.id,
  };
}

export function distinctValues<T>(list: T[], field: keyof T): string[] {
  const out = new Set<string>();
  for (const item of list) {
    const v = item[field];
    if (typeof v === "string" && v) out.add(v);
  }
  return [...out];
}
