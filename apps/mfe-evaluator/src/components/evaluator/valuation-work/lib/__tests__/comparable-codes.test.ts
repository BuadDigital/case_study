import { describe, expect, it } from "vitest";
import { splitComparableCodes } from "../comparable-codes";

describe("comparable codes in alert text (round 2 — phone wrapping)", () => {
  it("cuts the codes out so each stays on one line", () => {
    expect(splitComparableCodes("CMP-4B3629D8 ينحرف 64.07٪. CMP-77E7E900 ينحرف")).toEqual([
      { text: "CMP-4B3629D8", code: true },
      { text: " ينحرف 64.07٪. ", code: false },
      { text: "CMP-77E7E900", code: true },
      { text: " ينحرف", code: false },
    ]);
    expect(splitComparableCodes("المقارن CMP-2026-000123 —")[1]).toEqual({ text: "CMP-2026-000123", code: true });
    expect(splitComparableCodes("لا رموز")).toEqual([{ text: "لا رموز", code: false }]);
  });
});
