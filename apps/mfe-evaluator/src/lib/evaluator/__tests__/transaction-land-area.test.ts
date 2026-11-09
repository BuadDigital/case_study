import { describe, expect, it } from "vitest";
import { transactionLandArea } from "../transaction-land-area";

describe("transactionLandArea (A→Z #38)", () => {
  it("adds up the land of every deed of a merged transaction", () => {
    expect(transactionLandArea("450", [{ area: "450" }, { area: "300" }])).toBe("750");
    expect(transactionLandArea("450", [{ area: "٤٥٠٫٥" }, { area: "1,300" }])).toBe("1750.5");
  });

  it("keeps the deed's own area for a single deed or an unreadable deed area", () => {
    expect(transactionLandArea("450", [])).toBe("450");
    expect(transactionLandArea("450", [{ area: "450" }])).toBe("450");
    expect(transactionLandArea("450", [{ area: "450" }, { area: "" }])).toBe("450");
    expect(transactionLandArea(null, [])).toBeNull();
  });
});
