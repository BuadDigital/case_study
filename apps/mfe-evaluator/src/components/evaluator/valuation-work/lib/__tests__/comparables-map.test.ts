import { describe, expect, it } from "vitest";
import type { ComparablePropertyDto } from "@platform/api-client";
import { isVacantLandComparable } from "../bank-ranking";
import { comparableFilterOptions, filterMapComparables, mapPickerPool } from "../comparables-map";

const comp = (id: string, type: string, usage = ""): ComparablePropertyDto =>
  ({ id, comparablePropertyType: type, usage }) as unknown as ComparablePropertyDto;

const BANK = [
  comp("land-res", "أرض", "سكني"),
  comp("land-com", "أرض", "تجاري"),
  comp("villa", "فيلا", "سكني"),
  comp("shop", "محل تجاري", "تجاري"),
];

describe("what the «إضافة مقارن» map draws", () => {
  it("lists the table's own comparables first, then the bank's, each once", () => {
    const pool = mapPickerPool({ own: [comp("villa", "فيلا", "سكني")], bank: BANK });
    expect(pool.map((c) => c.id)).toEqual(["villa", "land-res", "land-com", "shop"]);
  });

  it("the land table draws the bank's lands only, and keeps an own building", () => {
    const pool = mapPickerPool({
      own: [comp("own-villa", "فيلا")],
      bank: BANK,
      keep: (c) => isVacantLandComparable(c.comparablePropertyType),
    });
    expect(pool.map((c) => c.id)).toEqual(["own-villa", "land-res", "land-com"]);
  });

  it("offers the types and the usages present, each once", () => {
    const options = comparableFilterOptions(BANK);
    expect([...options.types].sort()).toEqual(["أرض", "فيلا", "محل تجاري"].sort());
    expect([...options.usages].sort()).toEqual(["تجاري", "سكني"].sort());
  });

  it("filters by type and by usage together", () => {
    const ids = (filters: Parameters<typeof filterMapComparables>[1]) =>
      filterMapComparables(BANK, filters).map((c) => c.id);
    expect(ids({})).toHaveLength(4);
    expect(ids({ type: "أرض" })).toEqual(["land-res", "land-com"]);
    expect(ids({ usage: "تجاري" })).toEqual(["land-com", "shop"]);
    expect(ids({ type: "أرض", usage: "تجاري" })).toEqual(["land-com"]);
  });

  it("never hides the table's own comparables behind a filter", () => {
    const ids = filterMapComparables(BANK, { type: "أرض", alwaysIds: new Set(["villa"]) }).map(
      (c) => c.id,
    );
    expect(ids).toEqual(["land-res", "land-com", "villa"]);
  });
});
