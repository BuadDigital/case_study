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
  parseCoordinatePair,
  contactNumbers,
  contactNumbersError,
  contactNumbersForSave,
  formatContactNumbersInput,
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

describe("parseCoordinatePair", () => {
  it("reads pasted map coordinates in the usual notations", () => {
    const expected = { lat: 24.7136, lng: 46.6753 };
    expect(parseCoordinatePair("24.7136, 46.6753")).toEqual(expected);
    expect(parseCoordinatePair("24.7136 46.6753")).toEqual(expected);
    expect(parseCoordinatePair("٢٤٫٧١٣٦، ٤٦٫٦٧٥٣")).toEqual(expected);
  });

  it("rejects partial, extra or off-earth values", () => {
    expect(parseCoordinatePair("24.7136")).toBeNull();
    expect(parseCoordinatePair("24.7, 46.6, 12")).toBeNull();
    expect(parseCoordinatePair("240.7, 46.6")).toBeNull();
    expect(parseCoordinatePair("abc, def")).toBeNull();
  });
});

describe("contact numbers", () => {
  it("counts every 10 digits as one number", () => {
    expect(contactNumbers("0501234567")).toEqual(["0501234567"]);
    expect(contactNumbers("05012345670507654321")).toEqual(["0501234567", "0507654321"]);
    expect(contactNumbers("050123456705076543210555")).toHaveLength(3);
    expect(contactNumbers("٠٥٠١٢٣٤٥٦٧")).toEqual(["0501234567"]);
    expect(contactNumbers("")).toEqual([]);
  });

  it("groups the input by 10 while typing and drops non-digits", () => {
    expect(formatContactNumbersInput("050-123 4567 0507")).toBe("0501234567 0507");
    expect(formatContactNumbersInput("abc")).toBe("");
  });

  it("caps the count at 10 numbers", () => {
    expect(contactNumbers("1".repeat(150))).toHaveLength(10);
  });

  it("flags an unfinished number and saves the complete ones joined", () => {
    expect(contactNumbersError("")).toBeNull();
    expect(contactNumbersError("0501234567")).toBeNull();
    expect(contactNumbersError("0501234567 05076")).toContain("الرقم 2");
    expect(contactNumbersForSave("")).toBeNull();
    expect(contactNumbersForSave("0501234567 0507654321")).toBe("0501234567، 0507654321");
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
