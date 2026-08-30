import { describe, expect, it } from "vitest";
import {
  computeStats,
  filterComparables,
  filterProperties,
  groupForMap,
  haversineKm,
  isActive,
  isReportExpired,
  nearbyOf,
  partitionProperties,
  pricePerSqm,
  propertyCard,
  resolveDateRange,
  type MapComparableRecord,
  type MapPropertyRecord,
} from "../map-locations-logic";

/** Fixtures for unit tests only — not shown on the live map. */
const FIXTURE_PROPERTIES: MapPropertyRecord[] = [
  {
    id: "T-0103",
    refNo: "EJD-2026-0103",
    deedNo: "310112009914",
    deedType: "تقليدي",
    propertyType: "عمارة سكنية",
    city: "الرياض",
    district: "اليرموك",
    area: 900,
    client: "شركة أملاك الأولى",
    assignmentType: "شركة",
    workflowStatus: "in_progress",
    openedDate: "2026-08-02",
    valuationDate: null,
    issueDate: null,
    closedDate: null,
    finalValue: null,
    valuer: "م. خالد العتيبي",
    coords: { lat: 24.7791, lng: 46.8291 },
    coordsSource: "مقيم",
    propertyGroupId: null,
  },
  {
    id: "T-0104",
    refNo: "EJD-2026-0104",
    deedNo: "310112003308",
    deedType: "تقليدي",
    propertyType: "أرض تجارية",
    city: "الرياض",
    district: "القيروان",
    area: 1200,
    client: "منصة إنفاذ",
    assignmentType: "إنفاذ",
    workflowStatus: "infeasible_candidate",
    openedDate: "2026-07-20",
    valuationDate: null,
    issueDate: null,
    closedDate: null,
    finalValue: null,
    valuer: "أ. فهد الشمري",
    coords: { lat: 24.8556, lng: 46.5893 },
    coordsSource: "ميداني",
    propertyGroupId: null,
  },
  {
    id: "T-0109",
    refNo: "EJD-2026-0109",
    deedNo: "310112005521",
    deedType: "تقليدي",
    propertyType: "عمارة تجارية",
    city: "الرياض",
    district: "النسيم الشرقي",
    area: 800,
    client: "شركة تطوير الشرق",
    assignmentType: "شركة",
    workflowStatus: "in_progress",
    openedDate: "2026-07-01",
    valuationDate: null,
    issueDate: null,
    closedDate: null,
    finalValue: null,
    valuer: "م. خالد العتيبي",
    coords: { lat: 24.7455, lng: 46.8419 },
    coordsSource: "ميداني",
    propertyGroupId: "G-11",
  },
  {
    id: "T-0110",
    refNo: "EJD-2026-0110",
    deedNo: "310112005522",
    deedType: "تقليدي",
    propertyType: "عمارة تجارية",
    city: "الرياض",
    district: "النسيم الشرقي",
    area: 760,
    client: "شركة تطوير الشرق",
    assignmentType: "شركة",
    workflowStatus: "in_progress",
    openedDate: "2026-07-15",
    valuationDate: null,
    issueDate: null,
    closedDate: null,
    finalValue: null,
    valuer: "م. خالد العتيبي",
    coords: { lat: 24.7455, lng: 46.8419 },
    coordsSource: "ميداني",
    propertyGroupId: "G-11",
  },
  {
    id: "T-0112",
    refNo: "EJD-2026-0112",
    deedNo: "310112007070",
    deedType: "سجل عيني",
    propertyType: "أرض سكنية",
    city: "الرياض",
    district: "الرمال",
    area: 570,
    client: "نورة القحطاني",
    assignmentType: "فرد",
    workflowStatus: "issued",
    openedDate: "2026-07-25",
    valuationDate: "2026-08-01",
    issueDate: "2026-08-04",
    closedDate: null,
    finalValue: 1420000,
    valuer: "م. سارة الدوسري",
    coords: { lat: 24.796, lng: 46.8666 },
    coordsSource: "ميداني",
    propertyGroupId: null,
  },
  {
    id: "T-0601",
    refNo: "EJD-2026-0601",
    deedNo: "310112009999",
    deedType: "تقليدي",
    propertyType: "أرض سكنية",
    city: "الرياض",
    district: "طويق",
    area: 500,
    client: "منصة إنفاذ",
    assignmentType: "إنفاذ",
    workflowStatus: "in_progress",
    openedDate: "2026-08-14",
    valuationDate: null,
    issueDate: null,
    closedDate: null,
    finalValue: null,
    valuer: "أ. فهد الشمري",
    coords: null,
    coordsSource: null,
    propertyGroupId: null,
  },
  {
    id: "T-0101",
    refNo: "EJD-2026-0101",
    deedNo: "310112004512",
    deedType: "سجل عيني",
    propertyType: "أرض سكنية",
    city: "الرياض",
    district: "النرجس",
    area: 750,
    client: "منصة إنفاذ",
    assignmentType: "إنفاذ",
    workflowStatus: "issued",
    openedDate: "2026-05-02",
    valuationDate: "2026-05-10",
    issueDate: "2026-05-14",
    closedDate: "2026-05-20",
    finalValue: 2810000,
    valuer: "م. خالد العتيبي",
    coords: { lat: 24.8419, lng: 46.658 },
    coordsSource: "ميداني",
    propertyGroupId: null,
  },
  {
    id: "T-0105",
    refNo: "EJD-2026-0105",
    deedNo: "310112001177",
    deedType: "سجل عيني",
    propertyType: "شقة",
    city: "الرياض",
    district: "حطين",
    area: 172,
    client: "عبدالله المطيري",
    assignmentType: "فرد",
    workflowStatus: "issued",
    openedDate: "2026-04-11",
    valuationDate: "2026-04-16",
    issueDate: "2026-04-19",
    closedDate: "2026-04-26",
    finalValue: 985000,
    valuer: "م. سارة الدوسري",
    coords: { lat: 24.7729, lng: 46.5977 },
    coordsSource: "ميداني",
    propertyGroupId: null,
  },
  {
    id: "T-0106",
    refNo: "EJD-2025-0388",
    deedNo: "310112008841",
    deedType: "تقليدي",
    propertyType: "مستودع",
    city: "الرياض",
    district: "السلي",
    area: 2400,
    client: "مصرف الراجحي",
    assignmentType: "بنك",
    workflowStatus: "issued",
    openedDate: "2025-11-03",
    valuationDate: "2025-11-12",
    issueDate: "2025-11-16",
    closedDate: "2025-11-25",
    finalValue: 4120000,
    valuer: "م. خالد العتيبي",
    coords: { lat: 24.6428, lng: 46.7987 },
    coordsSource: "ميداني",
    propertyGroupId: null,
  },
  {
    id: "T-0102",
    refNo: "EJD-2026-0102",
    deedNo: "310112007733",
    deedType: "تقليدي",
    propertyType: "فيلا",
    city: "الرياض",
    district: "الملقا",
    area: 480,
    client: "بنك الرياض",
    assignmentType: "بنك",
    workflowStatus: "issued",
    openedDate: "2026-06-01",
    valuationDate: "2026-06-08",
    issueDate: "2026-06-11",
    closedDate: "2026-06-18",
    finalValue: 3650000,
    valuer: "م. سارة الدوسري",
    coords: { lat: 24.8034, lng: 46.6002 },
    coordsSource: "ميداني",
    propertyGroupId: null,
  },
];

const FIXTURE_COMPARABLES: MapComparableRecord[] = [
  {
    id: "C-9001",
    refNo: "CMP-2026-9001",
    comparableType: "أرض سكنية",
    operationType: "تنفيذ",
    priceDescription: null,
    operationDate: "2026-07-02",
    price: 2650000,
    area: 700,
    city: "الرياض",
    district: "النرجس",
    source: "البورصة العقارية",
    approved: true,
    description: "صفقة موثقة",
    coords: { lat: 24.846, lng: 46.651 },
  },
  {
    id: "C-9003",
    refNo: "CMP-2026-9003",
    comparableType: "فيلا",
    operationType: "عرض",
    priceDescription: "حد",
    operationDate: "2026-07-18",
    price: 3400000,
    area: 450,
    city: "الرياض",
    district: "الملقا",
    source: "منصة عقار",
    approved: false,
    description: "عرض حديث",
    coords: { lat: 24.809, lng: 46.595 },
  },
];

describe("map-locations-logic", () => {
  it("treats missing closedDate as active", () => {
    const active = FIXTURE_PROPERTIES.find((r) => r.id === "T-0103")!;
    const archived = FIXTURE_PROPERTIES.find((r) => r.id === "T-0101")!;
    expect(isActive(active)).toBe(true);
    expect(isActive(archived)).toBe(false);
  });

  it("partitions active vs archive and counts missing coords", () => {
    const part = partitionProperties(FIXTURE_PROPERTIES);
    expect(part.activeNoCoords).toBe(1);
    expect(part.active.every((r) => r.coords)).toBe(true);
    expect(part.archive.every((r) => r.coords && r.closedDate)).toBe(true);
    expect(part.active.length + part.archive.length + part.activeNoCoords).toBe(
      FIXTURE_PROPERTIES.length,
    );
  });

  it("groups deeds that share propertyGroupId into one map point", () => {
    const grouped = groupForMap(FIXTURE_PROPERTIES);
    const cluster = grouped.find((p) => p.kind === "group");
    expect(cluster?.kind).toBe("group");
    if (cluster?.kind !== "group") return;
    expect(cluster.groupId).toBe("G-11");
    expect(cluster.deedCount).toBe(2);
    expect(cluster.active).toBe(true);
  });

  it("filters by city and search query with Arabic normalization", () => {
    const riyadh = filterProperties(FIXTURE_PROPERTIES, { city: "الرياض" });
    expect(riyadh.every((r) => r.city === "الرياض")).toBe(true);
    const byDeed = filterProperties(FIXTURE_PROPERTIES, { query: "310112003308" });
    expect(byDeed.map((r) => r.id)).toEqual(["T-0104"]);
    const byHamza = filterProperties(FIXTURE_PROPERTIES, { query: "إنفاذ" });
    expect(byHamza.length).toBeGreaterThan(0);
  });

  it("resolves date presets and applies them to valuation/opened date", () => {
    const now = new Date("2026-08-16T12:00:00Z");
    const range90 = resolveDateRange("90d", now);
    expect(range90.from).not.toBeNull();
    const elapsedDays =
      (now.getTime() - range90.from!.getTime()) / (24 * 60 * 60 * 1000);
    expect(elapsedDays).toBeCloseTo(90, 0);
    const in2025 = filterProperties(
      FIXTURE_PROPERTIES,
      { datePreset: "2025" },
      now,
    );
    expect(in2025.every((r) => (r.valuationDate || r.openedDate || "").startsWith("2025"))).toBe(
      true,
    );
  });

  it("flags issued reports older than 90 days as expired", () => {
    const now = new Date("2026-08-16T12:00:00Z");
    const recent = FIXTURE_PROPERTIES.find((r) => r.id === "T-0112")!;
    const older = FIXTURE_PROPERTIES.find((r) => r.id === "T-0105")!;
    expect(isReportExpired(recent, now)).toBe(false);
    expect(isReportExpired(older, now)).toBe(true);
  });

  it("computes stats and nearby comparables", () => {
    const stats = computeStats(FIXTURE_PROPERTIES, FIXTURE_COMPARABLES);
    expect(stats.total).toBe(FIXTURE_PROPERTIES.length);
    expect(stats.comparablesShown).toBe(FIXTURE_COMPARABLES.length);
    expect(stats.activeCount).toBeGreaterThan(0);
    expect(stats.archivedCount).toBeGreaterThan(0);

    const center = { lat: 24.8419, lng: 46.658 };
    const nearby = nearbyOf(center, FIXTURE_COMPARABLES, 2, null);
    expect(nearby.length).toBeGreaterThan(0);
    expect(nearby[0]!.distanceKm).toBeLessThanOrEqual(nearby.at(-1)!.distanceKm);
    expect(nearby.some((x) => x.item.district === "النرجس")).toBe(true);
  });

  it("filters comparables by approved flag and computes price per sqm", () => {
    const approved = filterComparables(FIXTURE_COMPARABLES, { approvedOnly: true });
    expect(approved.every((c) => c.approved)).toBe(true);
    const c = FIXTURE_COMPARABLES.find((x) => x.id === "C-9001")!;
    expect(pricePerSqm(c)).toBeCloseTo(2650000 / 700);
  });

  it("builds a property card with workflow label", () => {
    const card = propertyCard(FIXTURE_PROPERTIES.find((r) => r.id === "T-0104")!);
    expect(card.family).toBe("property");
    expect(card.workflowStatus.label).toBe("مرشح تعذر");
    expect(card.active).toBe(true);
    expect(card.title).toContain("القيروان");
  });

  it("filters land vs building and infeasible workflow", () => {
    const lands = filterProperties(FIXTURE_PROPERTIES, { kindCat: "أرض" });
    expect(lands.every((r) => r.propertyType.startsWith("أرض"))).toBe(true);
    const buildings = filterProperties(FIXTURE_PROPERTIES, { kindCat: "مبنى" });
    expect(buildings.every((r) => !r.propertyType.startsWith("أرض"))).toBe(true);
    const inf = filterProperties(FIXTURE_PROPERTIES, { infeasOnly: true });
    expect(inf.length).toBeGreaterThan(0);
    expect(
      inf.every(
        (r) =>
          r.workflowStatus === "infeasible" ||
          r.workflowStatus === "infeasible_candidate",
      ),
    ).toBe(true);
    const residential = filterProperties(FIXTURE_PROPERTIES, { usage: "سكني" });
    expect(residential.some((r) => r.propertyType === "فيلا")).toBe(true);
  });

  it("haversine is symmetric and zero for identical points", () => {
    const a = { lat: 24.7136, lng: 46.6753 };
    expect(haversineKm(a, a)).toBe(0);
    expect(haversineKm(a, { lat: 21.5433, lng: 39.1728 })).toBeGreaterThan(800);
  });
});
