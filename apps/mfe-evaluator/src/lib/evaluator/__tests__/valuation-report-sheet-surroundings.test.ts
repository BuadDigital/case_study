import { describe, expect, it } from "vitest";
import { mapSurroundings } from "../valuation-report-sheet-facts";

describe("mapSurroundings — «المحيط» cells", () => {
  it("prints «—» in every cell when the inspector picked nothing (unknown, not absent)", () => {
    for (const none of [undefined, []]) {
      const out = mapSurroundings(none);
      expect(out["جامع"]).toBe("—");
      expect(out["مرفق طبي"]).toBe("—");
      expect(Object.values(out).some((v) => v === "لا يوجد")).toBe(false);
      expect(out["أخرى"]).toBe("");
    }
  });

  it("prints «يوجد» for the picked ones and «لا يوجد» for the rest once anything was picked", () => {
    const out = mapSurroundings(["مساجد", "مدارس"]);
    expect(out["جامع"]).toBe("يوجد");
    expect(out["مرفق تعليمي"]).toBe("يوجد");
    expect(out["مرفق طبي"]).toBe("لا يوجد");
  });

  it("an unknown pick alone still counts as an answer and goes to «أخرى»", () => {
    const out = mapSurroundings(["محطة وقود"]);
    expect(out["أخرى"]).toBe("محطة وقود");
    expect(out["جامع"]).toBe("لا يوجد");
  });
});
