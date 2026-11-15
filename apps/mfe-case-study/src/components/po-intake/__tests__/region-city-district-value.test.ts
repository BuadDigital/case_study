import { describe, expect, it } from "vitest";
import { shownDistrictValue, STORED_DISTRICT_PREFIX } from "../RegionCitySelects";

// 2026-11-15: a saved district showed an empty field after a reload — the server keeps the name only.
describe("shownDistrictValue", () => {
  const list = [{ id: "d-1", nameAr: "العليا" }];

  it("keeps the id the field holds", () => {
    expect(shownDistrictValue("d-9", "اراضي بدر", list)).toBe("d-9");
  });

  it("matches a stored name against the city's districts", () => {
    expect(shownDistrictValue("", "العليا", list)).toBe("d-1");
  });

  it("shows a stored name the list does not hold as its own option", () => {
    expect(shownDistrictValue("", "اراضي بدر", list)).toBe(`${STORED_DISTRICT_PREFIX}اراضي بدر`);
  });

  it("is empty with no id and no name", () => {
    expect(shownDistrictValue("", "", list)).toBe("");
  });
});
