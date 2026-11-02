import { describe, expect, it } from "vitest";
import type { ComparablePropertyDto } from "@platform/api-client";
import { buildBankDisplayRows } from "../bank-ranking";

const SUBJECT = { lat: 24.7136, lng: 46.6753 };

/** A comparable `km` kilometres north of the subject (1° of latitude ≈ 111.19 km). */
function comparableAt(id: string, km: number): ComparablePropertyDto {
  return {
    id,
    latitude: SUBJECT.lat + km / 111.19,
    longitude: SUBJECT.lng,
    city: "الرياض",
    areaSqm: 500,
  } as unknown as ComparablePropertyDto;
}

function build(radiusKm: number | null | undefined, kms: number[]) {
  return buildBankDisplayRows({
    selectionItems: [],
    candidates: kms.map((km, i) => comparableAt(`c${i}`, km)),
    subjectCity: "الرياض",
    subjectCoords: SUBJECT,
    radiusKm,
  });
}

describe("bank radius", () => {
  it("shows only what lies within 3 km by default", () => {
    const { rows, beyond } = build(undefined, [1, 2.5, 4.2, 9]);
    expect(rows).toHaveLength(2);
    expect(beyond.count).toBe(2);
    expect(beyond.nearestKm).toBeCloseTo(4.2, 1);
  });

  it("reports how far the nearest one is when nothing is within the radius", () => {
    const { rows, beyond } = build(3, [4.2, 9]);
    expect(rows).toHaveLength(0);
    expect(beyond).toEqual({ count: 2, nearestKm: expect.closeTo(4.2, 1) });
  });

  it("widening the radius brings the farther ones in and empties «beyond»", () => {
    const wide = build(10, [4.2, 9, 30]);
    expect(wide.rows).toHaveLength(2);
    expect(wide.beyond.count).toBe(1);

    const all = build(null, [4.2, 9, 30]);
    expect(all.rows).toHaveLength(3);
    expect(all.beyond).toEqual({ count: 0, nearestKm: null });
  });

  it("an empty bank has nothing beyond either", () => {
    expect(build(3, []).beyond).toEqual({ count: 0, nearestKm: null });
  });
});

describe("the property's own comparables and the land rows", () => {
  const land = (id: string, km: number) =>
    ({ ...comparableAt(id, km), comparablePropertyType: "أرض" }) as ComparablePropertyDto;
  const building = (id: string, km: number) =>
    ({ ...comparableAt(id, km), comparablePropertyType: "فيلا" }) as ComparablePropertyDto;

  it("keeps an own row the appraiser un-adopted, however far, and does not count it as beyond", () => {
    const far = land("far", 40);
    const { rows, beyond } = buildBankDisplayRows({
      selectionItems: [{ id: "s-far", isAdopted: false, comparable: far } as never],
      candidates: [],
      subjectCity: "الرياض",
      subjectCoords: SUBJECT,
    });
    expect(rows.map((r) => r.comp.id)).toEqual(["far"]);
    expect(rows[0].adopted).toBe(false);
    expect(beyond.count).toBe(0);
  });

  it("shows an own row with no location match when the subject has no coordinates", () => {
    const own = { ...land("own", 1), city: "" } as ComparablePropertyDto;
    const { rows } = buildBankDisplayRows({
      selectionItems: [{ id: "s-own", isAdopted: true, comparable: own } as never],
      candidates: [],
      subjectCity: "مكة المكرمة",
      subjectCoords: null,
    });
    expect(rows.map((r) => r.comp.id)).toEqual(["own"]);
  });

  const crowded = [
    ...[0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4].map((km, i) => building(`b${i}`, km)),
    land("land", 2.5),
  ];

  it("lets land fill the free rows first when the subject is valued as land", () => {
    const ids = buildBankDisplayRows({
      selectionItems: [],
      candidates: crowded,
      subjectCity: "الرياض",
      subjectCoords: SUBJECT,
      preferLand: true,
    }).rows.map((r) => r.comp.id);
    expect(ids).toHaveLength(6);
    expect(ids).toContain("land");
  });

  it("keeps the nearest first otherwise", () => {
    const ids = buildBankDisplayRows({
      selectionItems: [],
      candidates: crowded,
      subjectCity: "الرياض",
      subjectCoords: SUBJECT,
    }).rows.map((r) => r.comp.id);
    expect(ids).not.toContain("land");
  });
});

describe("bank rows — adopted comparables always show (round 2)", () => {
  it("adopted ones are kept past the 6-row limit and the radius; the nearest others fill the rest", () => {
    const kms = [0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 2.9, 7];
    const candidates = kms.map((km, i) => comparableAt(`c${i}`, km));
    const adopt = (id: string) =>
      ({ id: `s-${id}`, isAdopted: true, comparable: candidates.find((c) => c.id === id)! }) as never;
    const { rows, beyond } = buildBankDisplayRows({
      selectionItems: [adopt("c7"), adopt("c8")],
      candidates,
      subjectCity: "الرياض",
      subjectCoords: SUBJECT,
    });
    const ids = rows.map((r) => r.comp.id);
    expect(ids).toHaveLength(6);
    expect(ids).toContain("c7");
    expect(ids).toContain("c8"); // 7 km — outside the 3 km radius, but adopted
    expect(ids.filter((id) => id !== "c7" && id !== "c8")).toEqual(["c0", "c1", "c2", "c3"]);
    expect(rows.find((r) => r.comp.id === "c8")?.adopted).toBe(true);
    expect(beyond.count).toBe(0);
  });
});
