import { describe, expect, it } from "vitest";
import { formatGapAr, formatRelativeAr } from "../dashboard-metrics";

const MIN = 60_000;
const NOW = Date.UTC(2026, 8, 30, 12, 0, 0);

describe("formatRelativeAr", () => {
  it("counts minutes, then hours and minutes, inside the first day", () => {
    expect(formatRelativeAr(NOW, NOW)).toBe("الآن");
    expect(formatRelativeAr(NOW - 12 * MIN, NOW)).toBe("قبل 12 د");
    expect(formatRelativeAr(NOW - 125 * MIN, NOW)).toBe("قبل 2 س 5 د");
    expect(formatRelativeAr(NOW - 23 * 60 * MIN, NOW)).toBe("قبل 23 س");
  });

  it("switches to days from 24 hours on", () => {
    expect(formatRelativeAr(NOW - 24 * 60 * MIN, NOW)).toBe("قبل 1 ي");
    expect(formatRelativeAr(NOW - (957 * 60 + 55) * MIN, NOW)).toBe("قبل 39 ي");
  });
});

describe("formatGapAr", () => {
  it("keeps hours and minutes inside the first day", () => {
    expect(formatGapAr(45)).toBe("منذ 45 دقيقة");
    expect(formatGapAr(125)).toBe("منذ 2 ساعة و5 دقيقة");
  });

  it("switches to days and hours from 24 hours on", () => {
    expect(formatGapAr(48 * 60)).toBe("منذ 2 يوم");
    expect(formatGapAr(957 * 60 + 55)).toBe("منذ 39 يوم و21 ساعة");
  });
});
