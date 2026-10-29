import { describe, expect, it } from "vitest";
import type { BuildingInventoryLineDto } from "@platform/api-client";
import {
  builtUpSqmFromInventory,
  defaultMarketBasis,
  marketSubjectArea,
  marketSubjectAreaLabel,
  marketSubjectKind,
} from "../market-subject";

const line = (structureKind: string, areaSqm: string, sortOrder = 0) =>
  ({ structureKind, label: structureKind, areaSqm, sortOrder }) as BuildingInventoryLineDto;

describe("market subject (2026-10-29 ruling)", () => {
  it("compares a building as a whole property and land per m² of land", () => {
    const villa = marketSubjectKind({ costScopeKey: "land_and_building", propertyType: "فيلا" });
    expect(villa).toBe("building");
    expect(defaultMarketBasis(villa)).toBe("whole_property");
    expect(marketSubjectAreaLabel(villa)).toBe("مسطح البناء");

    const land = marketSubjectKind({ isLandPropertyType: true, propertyType: "أرض سكنية" });
    expect(land).toBe("land");
    expect(defaultMarketBasis(land)).toBe("price_per_sqm");
    expect(marketSubjectAreaLabel(land)).toBe("مساحة الأرض");

    const flat = marketSubjectKind({ propertyType: "شقة سكنية" });
    expect(flat).toBe("unit");
    expect(defaultMarketBasis(flat)).toBe("whole_property");
    expect(marketSubjectAreaLabel(flat)).toBe("مساحة الشقة");
  });

  it("lets the scope decide a land deed carrying a warehouse", () => {
    const withBuildings = { isLandPropertyType: true, propertyType: "أرض تجارية", builtUpSqm: 1000 };
    expect(marketSubjectKind({ ...withBuildings, costScopeKey: "land_and_building" })).toBe("building");
    expect(marketSubjectKind({ ...withBuildings, costScopeKey: "land_only" })).toBe("land");
    // A fence alone leaves no floor area: still land.
    expect(marketSubjectKind({ ...withBuildings, builtUpSqm: null, costScopeKey: "land_and_building" })).toBe("land");
  });

  it("measures a building by its floor area and never falls back to the land", () => {
    expect(marketSubjectArea("building", { deedArea: "600", builtUpSqm: 820 })).toBe("820");
    expect(marketSubjectArea("building", { deedArea: "600", builtUpSqm: null })).toBe("");
    expect(marketSubjectArea("land", { deedArea: "600", builtUpSqm: 820 })).toBe("600");
    expect(marketSubjectArea("unit", { deedArea: "180", builtUpSqm: null })).toBe("180");
  });

  it("sums the floors, annexes and basements of the inventory, not the fence", () => {
    expect(
      builtUpSqmFromInventory([
        line("floor", "420", 0),
        line("floor", "400", 1),
        line("fence", "90", 2),
      ]),
    ).toBe(820);
    expect(builtUpSqmFromInventory([line("fence", "90")])).toBeNull();
    expect(builtUpSqmFromInventory(null)).toBeNull();
  });
});
