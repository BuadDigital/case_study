import { describe, expect, it } from "vitest";
import { NAV, PAGE_TITLES } from "../constants";

describe("main menu labels (plan 2026-11-05, phase 6)", () => {
  it("names every menu row exactly as its page title", () => {
    const mismatched = NAV.filter((item) => PAGE_TITLES[item.id] !== item.label).map(
      (item) => `${item.id}: «${item.label}» ≠ «${PAGE_TITLES[item.id]}»`,
    );
    expect(mismatched).toEqual([]);
  });
});
