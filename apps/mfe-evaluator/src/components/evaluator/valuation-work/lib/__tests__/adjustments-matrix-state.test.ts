import { describe, expect, it } from "vitest";
import { addableFactorOptions } from "../adjustments-matrix-state";

describe("addableFactorOptions", () => {
  it("returns a deleted default difference factor so it can be added again", () => {
    const options = addableFactorOptions(undefined, [
      "ideal_area",
      "attraction",
      "access",
      "street_count",
      "street_lengths",
    ]);
    expect(options.map((f) => f.factorKey)).toContain("location");
    expect(options.map((f) => f.factorKey)).not.toContain("attraction");
    expect(options.map((f) => f.factorKey)).not.toContain("area");
    expect(options.map((f) => f.factorKey)).not.toContain("market");
  });

  it("keeps extra catalog factors and prefers the catalog label", () => {
    const options = addableFactorOptions(
      [
        { factorKey: "location", labelAr: "الموقع (كتالوج)" },
        { factorKey: "view", labelAr: "الإطلالة" },
      ],
      [],
    );
    expect(options).toEqual(
      expect.arrayContaining([
        { factorKey: "location", labelAr: "الموقع (كتالوج)" },
        { factorKey: "view", labelAr: "الإطلالة" },
      ]),
    );
  });
});
