import { describe, expect, it } from "vitest";
import type { ComparablePropertyDto } from "@platform/api-client";
import { buildBankDisplayRows } from "../bank-ranking";

const SUBJECT = { lat: 24.7136, lng: 46.6753 };

/** A comparable `km` kilometres north of the subject (1° of latitude ≈ 111.19 km). */
function comparableAt(id: string, km: number, type = "أرض"): ComparablePropertyDto {
  return {
    id,
    latitude: SUBJECT.lat + km / 111.19,
    longitude: SUBJECT.lng,
    city: "الرياض",
    areaSqm: 500,
    comparablePropertyType: type,
  } as unknown as ComparablePropertyDto;
}

const own = (comp: ComparablePropertyDto, isAdopted = true) =>
  ({ id: `s-${comp.id}`, isAdopted, comparable: comp }) as never;

// Ruling 2026-11-11: the system suggests no comparables — the table is the transaction's own rows.
describe("a transaction's table shows its own comparables only", () => {
  it("is empty for a transaction with no comparables", () => {
    expect(buildBankDisplayRows({ selectionItems: [], subjectCoords: SUBJECT }).rows).toEqual([]);
  });

  it("shows every own row — entered for the property or chosen — whatever the distance or the count", () => {
    const kms = [0.2, 1, 4, 9, 30, 55, 80, 120];
    const { rows, distances } = buildBankDisplayRows({
      selectionItems: [...kms].reverse().map((km) => own(comparableAt(`c${km}`, km))),
      subjectCoords: SUBJECT,
    });
    expect(rows.map((r) => r.comp.id)).toEqual(kms.map((km) => `c${km}`)); // nearest first
    expect(distances.c120).toBeCloseTo(120, 0);
  });

  it("keeps an own row the appraiser un-adopted, so it can be adopted again", () => {
    const { rows } = buildBankDisplayRows({
      selectionItems: [own(comparableAt("far", 40), false)],
      subjectCoords: SUBJECT,
    });
    expect(rows.map((r) => r.comp.id)).toEqual(["far"]);
    expect(rows[0].adopted).toBe(false);
    expect(rows[0].selected).toBe(true);
  });

  it("shows an own row when the subject has no coordinates", () => {
    const { rows, distances } = buildBankDisplayRows({
      selectionItems: [own(comparableAt("own", 1))],
      subjectCoords: null,
    });
    expect(rows.map((r) => r.comp.id)).toEqual(["own"]);
    expect(distances).toEqual({});
  });

  it("shows a building among a land's rows — an own row is never filtered by type", () => {
    const { rows } = buildBankDisplayRows({
      selectionItems: [own(comparableAt("villa", 0.05, "فيلا")), own(comparableAt("land", 0.5))],
      subjectCoords: SUBJECT,
    });
    expect(rows.map((r) => r.comp.id)).toEqual(["villa", "land"]);
  });
});
