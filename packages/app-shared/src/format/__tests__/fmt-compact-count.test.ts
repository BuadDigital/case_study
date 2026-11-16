import { describe, expect, it } from "vitest";
import { fmtCompactCount } from "../number";

describe("fmtCompactCount", () => {
  it("keeps counts under a thousand as they are", () => {
    expect(fmtCompactCount(0)).toBe("0");
    expect(fmtCompactCount(999)).toBe("999");
  });

  it("shortens thousands and millions for a small badge", () => {
    expect(fmtCompactCount(1000)).toBe("1 ألف");
    expect(fmtCompactCount(1234)).toBe("1.2 ألف");
    expect(fmtCompactCount(215_340)).toBe("215 ألف");
    expect(fmtCompactCount(1_300_000)).toBe("1.3 مليون");
  });
});
