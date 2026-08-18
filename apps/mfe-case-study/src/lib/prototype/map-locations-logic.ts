/** منطق خريطة المواقع المدروسة — الإصدار 2.0. طبقة نقية بلا DOM. */

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
      ["نوع الصك", r.deedType],
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

/** بيانات تجريبية (معاينة). لاحقاً: الخريطة تبدأ فارغة وتُملأ من أوامر العمل الحية بدل هذه البذور. */
export const SEED_PROPERTIES: MapPropertyRecord[] = [
  { id: "T-0103", refNo: "EJD-2026-0103", deedNo: "310112009914", deedType: "تقليدي", propertyType: "عمارة سكنية", city: "الرياض", district: "اليرموك", area: 900, client: "شركة أملاك الأولى", assignmentType: "شركة", workflowStatus: "in_progress", openedDate: "2026-08-02", valuationDate: null, issueDate: null, closedDate: null, finalValue: null, valuer: "م. خالد العتيبي", coords: { lat: 24.7791, lng: 46.8291 }, coordsSource: "مقيم", propertyGroupId: null },
  { id: "T-0104", refNo: "EJD-2026-0104", deedNo: "310112003308", deedType: "تقليدي", propertyType: "أرض تجارية", city: "الرياض", district: "القيروان", area: 1200, client: "منصة إنفاذ", assignmentType: "إنفاذ", workflowStatus: "infeasible_candidate", openedDate: "2026-07-20", valuationDate: null, issueDate: null, closedDate: null, finalValue: null, valuer: "أ. فهد الشمري", coords: { lat: 24.8556, lng: 46.5893 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0108", refNo: "EJD-2026-0108", deedNo: "310112006650", deedType: "سجل عيني", propertyType: "فيلا", city: "الرياض", district: "الشفا", area: 400, client: "البنك الأهلي", assignmentType: "بنك", workflowStatus: "in_progress", openedDate: "2026-08-10", valuationDate: null, issueDate: null, closedDate: null, finalValue: null, valuer: "م. سارة الدوسري", coords: { lat: 24.5566, lng: 46.7107 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0112", refNo: "EJD-2026-0112", deedNo: "310112007070", deedType: "سجل عيني", propertyType: "أرض سكنية", city: "الرياض", district: "الرمال", area: 570, client: "نورة القحطاني", assignmentType: "فرد", workflowStatus: "issued", openedDate: "2026-07-25", valuationDate: "2026-08-01", issueDate: "2026-08-04", closedDate: null, finalValue: 1420000, valuer: "م. سارة الدوسري", coords: { lat: 24.796, lng: 46.8666 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0109", refNo: "EJD-2026-0109", deedNo: "310112005521", deedType: "تقليدي", propertyType: "عمارة تجارية", city: "الرياض", district: "النسيم الشرقي", area: 800, client: "شركة تطوير الشرق", assignmentType: "شركة", workflowStatus: "in_progress", openedDate: "2026-07-01", valuationDate: null, issueDate: null, closedDate: null, finalValue: null, valuer: "م. خالد العتيبي", coords: { lat: 24.7455, lng: 46.8419 }, coordsSource: "ميداني", propertyGroupId: "G-11" },
  { id: "T-0110", refNo: "EJD-2026-0110", deedNo: "310112005522", deedType: "تقليدي", propertyType: "عمارة تجارية", city: "الرياض", district: "النسيم الشرقي", area: 760, client: "شركة تطوير الشرق", assignmentType: "شركة", workflowStatus: "in_progress", openedDate: "2026-07-15", valuationDate: null, issueDate: null, closedDate: null, finalValue: null, valuer: "م. خالد العتيبي", coords: { lat: 24.7455, lng: 46.8419 }, coordsSource: "ميداني", propertyGroupId: "G-11" },
  { id: "T-0203", refNo: "EJD-2026-0203", deedNo: "420334009917", deedType: "تقليدي", propertyType: "أرض تجارية", city: "جدة", district: "السلامة", area: 1500, client: "منصة إنفاذ", assignmentType: "إنفاذ", workflowStatus: "in_progress", openedDate: "2026-08-05", valuationDate: null, issueDate: null, closedDate: null, finalValue: null, valuer: "م. عمر باناجه", coords: { lat: 21.6001, lng: 39.1435 }, coordsSource: "مقيم", propertyGroupId: null },
  { id: "T-0205", refNo: "EJD-2026-0205", deedNo: "420334002950", deedType: "تقليدي", propertyType: "أرض سكنية", city: "جدة", district: "النعيم", area: 450, client: "منصة إنفاذ", assignmentType: "إنفاذ", workflowStatus: "infeasible_candidate", openedDate: "2026-07-28", valuationDate: null, issueDate: null, closedDate: null, finalValue: null, valuer: "أ. ماجد الزهراني", coords: { lat: 21.628, lng: 39.123 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0302", refNo: "EJD-2026-0302", deedNo: "530221008812", deedType: "تقليدي", propertyType: "مستودع", city: "الدمام", district: "المنطقة الصناعية الثانية", area: 5000, client: "شركة لوجستيات الخليج", assignmentType: "شركة", workflowStatus: "in_progress", openedDate: "2026-08-09", valuationDate: null, issueDate: null, closedDate: null, finalValue: null, valuer: "م. حسن العلي", coords: { lat: 26.3541, lng: 50.0322 }, coordsSource: "مقيم", propertyGroupId: null },
  { id: "T-0402", refNo: "EJD-2026-0402", deedNo: "440556008833", deedType: "سجل عيني", propertyType: "أرض سكنية", city: "مكة المكرمة", district: "الشوقية", area: 800, client: "منصة إنفاذ", assignmentType: "إنفاذ", workflowStatus: "in_progress", openedDate: "2026-08-12", valuationDate: null, issueDate: null, closedDate: null, finalValue: null, valuer: "م. تركي السبيعي", coords: { lat: 21.3705, lng: 39.796 }, coordsSource: "مقيم", propertyGroupId: null },
  { id: "T-0502", refNo: "EJD-2026-0502", deedNo: "470889002626", deedType: "تقليدي", propertyType: "عمارة سكنية", city: "أبها", district: "المنسك", area: 610, client: "بنك الرياض", assignmentType: "بنك", workflowStatus: "in_progress", openedDate: "2026-08-03", valuationDate: null, issueDate: null, closedDate: null, finalValue: null, valuer: "أ. ناصر الحربي", coords: { lat: 18.23, lng: 42.506 }, coordsSource: "مقيم", propertyGroupId: null },
  { id: "T-0601", refNo: "EJD-2026-0601", deedNo: "310112009999", deedType: "تقليدي", propertyType: "أرض سكنية", city: "الرياض", district: "طويق", area: 500, client: "منصة إنفاذ", assignmentType: "إنفاذ", workflowStatus: "in_progress", openedDate: "2026-08-14", valuationDate: null, issueDate: null, closedDate: null, finalValue: null, valuer: "أ. فهد الشمري", coords: null, coordsSource: null, propertyGroupId: null },
  { id: "T-0101", refNo: "EJD-2026-0101", deedNo: "310112004512", deedType: "سجل عيني", propertyType: "أرض سكنية", city: "الرياض", district: "النرجس", area: 750, client: "منصة إنفاذ", assignmentType: "إنفاذ", workflowStatus: "issued", openedDate: "2026-05-02", valuationDate: "2026-05-10", issueDate: "2026-05-14", closedDate: "2026-05-20", finalValue: 2810000, valuer: "م. خالد العتيبي", coords: { lat: 24.8419, lng: 46.658 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0102", refNo: "EJD-2026-0102", deedNo: "310112007733", deedType: "تقليدي", propertyType: "فيلا", city: "الرياض", district: "الملقا", area: 480, client: "بنك الرياض", assignmentType: "بنك", workflowStatus: "issued", openedDate: "2026-06-01", valuationDate: "2026-06-08", issueDate: "2026-06-11", closedDate: "2026-06-18", finalValue: 3650000, valuer: "م. سارة الدوسري", coords: { lat: 24.8034, lng: 46.6002 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0105", refNo: "EJD-2026-0105", deedNo: "310112001177", deedType: "سجل عيني", propertyType: "شقة", city: "الرياض", district: "حطين", area: 172, client: "عبدالله المطيري", assignmentType: "فرد", workflowStatus: "issued", openedDate: "2026-04-11", valuationDate: "2026-04-16", issueDate: "2026-04-19", closedDate: "2026-04-26", finalValue: 985000, valuer: "م. سارة الدوسري", coords: { lat: 24.7729, lng: 46.5977 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0106", refNo: "EJD-2025-0388", deedNo: "310112008841", deedType: "تقليدي", propertyType: "مستودع", city: "الرياض", district: "السلي", area: 2400, client: "مصرف الراجحي", assignmentType: "بنك", workflowStatus: "issued", openedDate: "2025-11-03", valuationDate: "2025-11-12", issueDate: "2025-11-16", closedDate: "2025-11-25", finalValue: 4120000, valuer: "م. خالد العتيبي", coords: { lat: 24.6428, lng: 46.7987 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0107", refNo: "EJD-2026-0107", deedNo: "310112002216", deedType: "تقليدي", propertyType: "أرض سكنية", city: "الرياض", district: "العارض", area: 625, client: "منصة إنفاذ", assignmentType: "إنفاذ", workflowStatus: "infeasible", openedDate: "2026-03-05", valuationDate: null, issueDate: null, closedDate: "2026-03-22", finalValue: null, valuer: "أ. فهد الشمري", coords: { lat: 24.9066, lng: 46.635 }, coordsSource: "مقيم", propertyGroupId: null },
  { id: "T-0111", refNo: "EJD-2025-0301", deedNo: "310112000944", deedType: "تقليدي", propertyType: "أرض سكنية", city: "الرياض", district: "لبن", area: 900, client: "منصة إنفاذ", assignmentType: "إنفاذ", workflowStatus: "issued", openedDate: "2025-09-14", valuationDate: "2025-09-22", issueDate: "2025-09-25", closedDate: "2025-10-02", finalValue: 1980000, valuer: "أ. فهد الشمري", coords: { lat: 24.618, lng: 46.562 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0201", refNo: "EJD-2026-0201", deedNo: "420334006611", deedType: "تقليدي", propertyType: "فيلا", city: "جدة", district: "أبحر الشمالية", area: 520, client: "بنك الجزيرة", assignmentType: "بنك", workflowStatus: "issued", openedDate: "2026-05-20", valuationDate: "2026-05-28", issueDate: "2026-06-01", closedDate: "2026-06-08", finalValue: 2340000, valuer: "م. عمر باناجه", coords: { lat: 21.7743, lng: 39.0987 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0202", refNo: "EJD-2026-0202", deedNo: "420334001208", deedType: "سجل عيني", propertyType: "شقة", city: "جدة", district: "الشاطئ", area: 210, client: "ريم الحربي", assignmentType: "فرد", workflowStatus: "issued", openedDate: "2026-06-14", valuationDate: "2026-06-19", issueDate: "2026-06-22", closedDate: "2026-06-30", finalValue: 1150000, valuer: "م. عمر باناجه", coords: { lat: 21.6152, lng: 39.1044 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0204", refNo: "EJD-2025-0412", deedNo: "420334004433", deedType: "تقليدي", propertyType: "عمارة سكنية", city: "جدة", district: "الروضة", area: 680, client: "شركة إسكان الغرب", assignmentType: "شركة", workflowStatus: "issued", openedDate: "2025-12-01", valuationDate: "2025-12-09", issueDate: "2025-12-12", closedDate: "2025-12-20", finalValue: 5230000, valuer: "م. عمر باناجه", coords: { lat: 21.5731, lng: 39.1521 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0301", refNo: "EJD-2026-0301", deedNo: "530221003377", deedType: "سجل عيني", propertyType: "فيلا", city: "الدمام", district: "الشاطئ الغربي", area: 465, client: "بنك ساب", assignmentType: "بنك", workflowStatus: "issued", openedDate: "2026-04-02", valuationDate: "2026-04-09", issueDate: "2026-04-12", closedDate: "2026-04-20", finalValue: 1890000, valuer: "م. حسن العلي", coords: { lat: 26.468, lng: 50.062 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0303", refNo: "EJD-2026-0303", deedNo: "530445001122", deedType: "تقليدي", propertyType: "شقة", city: "الخبر", district: "العقربية", area: 195, client: "محمد الغامدي", assignmentType: "فرد", workflowStatus: "issued", openedDate: "2026-06-25", valuationDate: "2026-07-01", issueDate: "2026-07-03", closedDate: "2026-07-10", finalValue: 720000, valuer: "م. حسن العلي", coords: { lat: 26.286, lng: 50.208 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0304", refNo: "EJD-2025-0355", deedNo: "530445007765", deedType: "تقليدي", propertyType: "أرض تجارية", city: "الخبر", district: "الحزام الذهبي", area: 2000, client: "منصة إنفاذ", assignmentType: "إنفاذ", workflowStatus: "infeasible", openedDate: "2025-10-11", valuationDate: null, issueDate: null, closedDate: "2025-11-01", finalValue: null, valuer: "أ. ماجد الزهراني", coords: { lat: 26.2455, lng: 50.199 }, coordsSource: "مقيم", propertyGroupId: null },
  { id: "T-0401", refNo: "EJD-2026-0401", deedNo: "440556002211", deedType: "تقليدي", propertyType: "عمارة سكنية", city: "مكة المكرمة", district: "العوالي", area: 540, client: "بنك البلاد", assignmentType: "بنك", workflowStatus: "issued", openedDate: "2026-03-15", valuationDate: "2026-03-24", issueDate: "2026-03-28", closedDate: "2026-04-05", finalValue: 3980000, valuer: "م. تركي السبيعي", coords: { lat: 21.352, lng: 39.889 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0403", refNo: "EJD-2026-0403", deedNo: "450667003344", deedType: "تقليدي", propertyType: "فيلا", city: "المدينة المنورة", district: "قباء", area: 430, client: "سلطان الأحمدي", assignmentType: "فرد", workflowStatus: "issued", openedDate: "2026-05-05", valuationDate: "2026-05-13", issueDate: "2026-05-17", closedDate: "2026-05-25", finalValue: 1560000, valuer: "م. تركي السبيعي", coords: { lat: 24.439, lng: 39.617 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0501", refNo: "EJD-2026-0501", deedNo: "460778001515", deedType: "تقليدي", propertyType: "أرض زراعية", city: "بريدة", district: "الصفراء", area: 12000, client: "منصة إنفاذ", assignmentType: "إنفاذ", workflowStatus: "issued", openedDate: "2026-02-10", valuationDate: "2026-02-19", issueDate: "2026-02-23", closedDate: "2026-03-03", finalValue: 3400000, valuer: "أ. ناصر الحربي", coords: { lat: 26.366, lng: 43.928 }, coordsSource: "ميداني", propertyGroupId: null },
  { id: "T-0503", refNo: "EJD-2025-0290", deedNo: "480990003737", deedType: "تقليدي", propertyType: "أرض سكنية", city: "تبوك", district: "المروج", area: 750, client: "منصة إنفاذ", assignmentType: "إنفاذ", workflowStatus: "issued", openedDate: "2025-08-20", valuationDate: "2025-08-28", issueDate: "2025-09-01", closedDate: "2025-09-10", finalValue: 640000, valuer: "أ. ناصر الحربي", coords: { lat: 28.406, lng: 36.543 }, coordsSource: "ميداني", propertyGroupId: null },
];

/** بيانات تجريبية للمقارنات. لاحقاً: املأ الطبقة من بنك المقارنات الحي. */
export const SEED_COMPARABLES: MapComparableRecord[] = [
  { id: "C-9001", refNo: "CMP-2026-9001", comparableType: "أرض سكنية", operationType: "تنفيذ", priceDescription: null, operationDate: "2026-07-02", price: 2650000, area: 700, city: "الرياض", district: "النرجس", source: "البورصة العقارية", approved: true, description: "صفقة موثقة — شارع 20 شمالي", coords: { lat: 24.846, lng: 46.651 } },
  { id: "C-9002", refNo: "CMP-2026-9002", comparableType: "أرض سكنية", operationType: "عرض", priceDescription: "قابل للتفاوض", operationDate: "2026-08-01", price: 2900000, area: 750, city: "الرياض", district: "النرجس", source: "منصة عقار", approved: true, description: "عرض معلن — زاوية", coords: { lat: 24.838, lng: 46.664 } },
  { id: "C-9003", refNo: "CMP-2026-9003", comparableType: "فيلا", operationType: "عرض", priceDescription: "حد", operationDate: "2026-07-18", price: 3400000, area: 450, city: "الرياض", district: "الملقا", source: "منصة عقار", approved: false, description: "عرض حديث — تشطيب فاخر", coords: { lat: 24.809, lng: 46.595 } },
  { id: "C-9004", refNo: "CMP-2026-9004", comparableType: "عمارة تجارية", operationType: "تنفيذ", priceDescription: null, operationDate: "2026-06-10", price: 6800000, area: 820, city: "الرياض", district: "النسيم الشرقي", source: "معاملة سابقة", approved: true, description: "من مقارنات معاملة مغلقة", coords: { lat: 24.749, lng: 46.836 } },
  { id: "C-9005", refNo: "CMP-2026-9005", comparableType: "أرض تجارية", operationType: "عرض", priceDescription: "قابل للتفاوض", operationDate: "2026-08-08", price: 5200000, area: 1300, city: "الرياض", district: "القيروان", source: "مسح ميداني", approved: true, description: "رافد ميداني", coords: { lat: 24.859, lng: 46.582 } },
  { id: "C-9006", refNo: "CMP-2026-9006", comparableType: "أرض سكنية", operationType: "تنفيذ", priceDescription: null, operationDate: "2026-05-25", price: 1800000, area: 600, city: "جدة", district: "النعيم", source: "البورصة العقارية", approved: true, description: "صفقة موثقة", coords: { lat: 21.631, lng: 39.119 } },
  { id: "C-9007", refNo: "CMP-2026-9007", comparableType: "فيلا", operationType: "عرض", priceDescription: "حد", operationDate: "2026-07-30", price: 2500000, area: 500, city: "جدة", district: "أبحر الشمالية", source: "منصة عقار", approved: false, description: "عرض معلن", coords: { lat: 21.77, lng: 39.105 } },
  { id: "C-9008", refNo: "CMP-2026-9008", comparableType: "مستودع", operationType: "تنفيذ", priceDescription: null, operationDate: "2026-06-20", price: 3900000, area: 4500, city: "الدمام", district: "المنطقة الصناعية الثانية", source: "معاملة سابقة", approved: true, description: "من مقارنات معاملة مغلقة", coords: { lat: 26.358, lng: 50.028 } },
  { id: "C-9009", refNo: "CMP-2026-9009", comparableType: "أرض سكنية", operationType: "عرض", priceDescription: "قابل للتفاوض", operationDate: "2026-08-05", price: 950000, area: 780, city: "مكة المكرمة", district: "الشوقية", source: "منصة عقار", approved: true, description: "عرض حديث", coords: { lat: 21.368, lng: 39.79 } },
  { id: "C-9010", refNo: "CMP-2026-9010", comparableType: "عمارة سكنية", operationType: "تنفيذ", priceDescription: null, operationDate: "2026-07-12", price: 2100000, area: 580, city: "أبها", district: "المنسك", source: "البورصة العقارية", approved: true, description: "صفقة موثقة", coords: { lat: 18.233, lng: 42.51 } },
];
