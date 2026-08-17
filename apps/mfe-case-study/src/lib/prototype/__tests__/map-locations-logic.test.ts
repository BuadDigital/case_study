import { describe, expect, it } from "vitest";
import {
  SEED_COMPARABLES,
  SEED_PROPERTIES,
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
} from "../map-locations-logic";

describe("map-locations-logic", () => {
  it("treats missing closedDate as active", () => {
    const active = SEED_PROPERTIES.find((r) => r.id === "T-0103")!;
    const archived = SEED_PROPERTIES.find((r) => r.id === "T-0101")!;
    expect(isActive(active)).toBe(true);
    expect(isActive(archived)).toBe(false);
  });

  it("partitions active vs archive and counts missing coords", () => {
    const part = partitionProperties(SEED_PROPERTIES);
    expect(part.activeNoCoords).toBe(1);
    expect(part.active.every((r) => r.coords)).toBe(true);
    expect(part.archive.every((r) => r.coords && r.closedDate)).toBe(true);
    expect(part.active.length + part.archive.length + part.activeNoCoords).toBe(
      SEED_PROPERTIES.length,
    );
  });

  it("groups deeds that share propertyGroupId into one map point", () => {
    const grouped = groupForMap(SEED_PROPERTIES);
    const cluster = grouped.find((p) => p.kind === "group");
    expect(cluster?.kind).toBe("group");
    if (cluster?.kind !== "group") return;
    expect(cluster.groupId).toBe("G-11");
    expect(cluster.deedCount).toBe(2);
    expect(cluster.active).toBe(true);
  });

  it("filters by city and search query with Arabic normalization", () => {
    const riyadh = filterProperties(SEED_PROPERTIES, { city: "الرياض" });
    expect(riyadh.every((r) => r.city === "الرياض")).toBe(true);
    const byDeed = filterProperties(SEED_PROPERTIES, { query: "310112003308" });
    expect(byDeed.map((r) => r.id)).toEqual(["T-0104"]);
    const byHamza = filterProperties(SEED_PROPERTIES, { query: "إنفاذ" });
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
      SEED_PROPERTIES,
      { datePreset: "2025" },
      now,
    );
    expect(in2025.every((r) => (r.valuationDate || r.openedDate || "").startsWith("2025"))).toBe(
      true,
    );
  });

  it("flags issued reports older than 90 days as expired", () => {
    const now = new Date("2026-08-16T12:00:00Z");
    const recent = SEED_PROPERTIES.find((r) => r.id === "T-0112")!;
    const older = SEED_PROPERTIES.find((r) => r.id === "T-0105")!;
    expect(isReportExpired(recent, now)).toBe(false);
    expect(isReportExpired(older, now)).toBe(true);
  });

  it("computes stats and nearby comparables", () => {
    const stats = computeStats(SEED_PROPERTIES, SEED_COMPARABLES);
    expect(stats.total).toBe(SEED_PROPERTIES.length);
    expect(stats.comparablesShown).toBe(SEED_COMPARABLES.length);
    expect(stats.activeCount).toBeGreaterThan(0);
    expect(stats.archivedCount).toBeGreaterThan(0);

    const center = { lat: 24.8419, lng: 46.658 };
    const nearby = nearbyOf(center, SEED_COMPARABLES, 2, null);
    expect(nearby.length).toBeGreaterThan(0);
    expect(nearby[0]!.distanceKm).toBeLessThanOrEqual(nearby.at(-1)!.distanceKm);
    expect(nearby.some((x) => x.item.district === "النرجس")).toBe(true);
  });

  it("filters comparables by approved flag and computes price per sqm", () => {
    const approved = filterComparables(SEED_COMPARABLES, { approvedOnly: true });
    expect(approved.every((c) => c.approved)).toBe(true);
    const c = SEED_COMPARABLES.find((x) => x.id === "C-9001")!;
    expect(pricePerSqm(c)).toBeCloseTo(2650000 / 700);
  });

  it("builds a property card with workflow label", () => {
    const card = propertyCard(SEED_PROPERTIES.find((r) => r.id === "T-0104")!);
    expect(card.family).toBe("property");
    expect(card.workflowStatus.label).toBe("مرشح تعذر");
    expect(card.active).toBe(true);
    expect(card.title).toContain("القيروان");
  });

  it("filters land vs building and infeasible workflow", () => {
    const lands = filterProperties(SEED_PROPERTIES, { kindCat: "أرض" });
    expect(lands.every((r) => r.propertyType.startsWith("أرض"))).toBe(true);
    const buildings = filterProperties(SEED_PROPERTIES, { kindCat: "مبنى" });
    expect(buildings.every((r) => !r.propertyType.startsWith("أرض"))).toBe(true);
    const inf = filterProperties(SEED_PROPERTIES, { infeasOnly: true });
    expect(inf.length).toBeGreaterThan(0);
    expect(
      inf.every(
        (r) =>
          r.workflowStatus === "infeasible" ||
          r.workflowStatus === "infeasible_candidate",
      ),
    ).toBe(true);
    const residential = filterProperties(SEED_PROPERTIES, { usage: "سكني" });
    expect(residential.some((r) => r.propertyType === "فيلا")).toBe(true);
  });

  it("haversine is symmetric and zero for identical points", () => {
    const a = { lat: 24.7136, lng: 46.6753 };
    expect(haversineKm(a, a)).toBe(0);
    expect(haversineKm(a, { lat: 21.5433, lng: 39.1728 })).toBeGreaterThan(800);
  });
});
