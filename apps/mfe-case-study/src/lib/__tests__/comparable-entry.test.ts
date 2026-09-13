import { describe, expect, it } from "vitest";
import {
  BUILDING_COMPARABLE_TYPE,
  LAND_COMPARABLE_TYPE,
  comparableDraftToUpsert,
  comparableEntryReady,
  comparableKindFromType,
  comparablePlaceLine,
  comparableTypeForSave,
  emptyComparableEntryDraft,
  firstComparableEntryError,
  parseComparableCoords,
  validateComparableEntry,
} from "../comparable-entry";

describe("parseComparableCoords", () => {
  it("rejects blanks and the 0,0 placeholder", () => {
    expect(parseComparableCoords("", "")).toBeNull();
    expect(parseComparableCoords("0", "0")).toBeNull();
    expect(parseComparableCoords("24.84", "46.65")).toEqual({
      lat: 24.84,
      lng: 46.65,
    });
  });
});

describe("comparableKindFromType", () => {
  it("classifies land and building labels", () => {
    expect(comparableKindFromType("أرض")).toBe("land");
    expect(comparableKindFromType("فيلا سكنية")).toBe("building");
    expect(comparableKindFromType("مبنى")).toBe("building");
    expect(comparableKindFromType("")).toBe("");
  });
});

describe("comparableTypeForSave / ready", () => {
  it("defaults land and building types when the subtype is empty", () => {
    const land = { ...emptyComparableEntryDraft(), kind: "land" as const };
    const building = { ...emptyComparableEntryDraft(), kind: "building" as const };
    expect(comparableTypeForSave(land)).toBe(LAND_COMPARABLE_TYPE);
    expect(comparableTypeForSave(building)).toBe(BUILDING_COMPARABLE_TYPE);
  });

  it("is ready only after pin, kind, district, price, area, and date", () => {
    const draft = {
      ...emptyComparableEntryDraft(),
      kind: "land" as const,
      latitude: "24.84",
      longitude: "46.65",
      district: "النرجس",
      price: "1000000",
      areaSqm: "400",
      transactionDate: "2026-09-07",
    };
    expect(comparableEntryReady({ ...draft, kind: "" }, true)).toBe(false);
    expect(comparableEntryReady({ ...draft, district: "" }, true)).toBe(false);
    expect(comparableEntryReady({ ...draft, price: "0" }, true)).toBe(false);
    expect(comparableEntryReady(draft, false)).toBe(false);
    expect(comparableEntryReady(draft, true)).toBe(true);
    expect(comparableEntryReady(emptyComparableEntryDraft(), true)).toBe(false);
  });

  it("names the first missing field for save guidance", () => {
    const errors = validateComparableEntry(emptyComparableEntryDraft(), false);
    expect(firstComparableEntryError(errors)).toBe(
      "ثبّت موقع المقارن على الخريطة",
    );
    expect(errors.kind).toBeTruthy();
    expect(errors.price).toBeTruthy();
  });

  it("writes land type أرض when kind is land", () => {
    const body = comparableDraftToUpsert(
      {
        ...emptyComparableEntryDraft(),
        kind: "land",
        latitude: "24.8401",
        longitude: "46.6556",
        district: "النرجس",
        transactionDate: "2026-09-07",
        areaSqm: "400",
        price: "1000000",
      },
      { intakeChannel: "field" },
    );
    expect(body.comparablePropertyType).toBe("أرض");
    expect(body.latitude).toBe(24.8401);
  });
});

describe("comparablePlaceLine", () => {
  it("joins city and district from the pin", () => {
    expect(comparablePlaceLine({ city: "الرياض", district: "النرجس" })).toBe(
      "الرياض · النرجس",
    );
    expect(comparablePlaceLine({ city: "", district: "" })).toBe("");
  });
});
