import { describe, expect, it } from "vitest";
import { isGentleLoadingCopy } from "../gentle-loading-copy";

describe("isGentleLoadingCopy", () => {
  it("matches in-progress load copy", () => {
    expect(isGentleLoadingCopy("جاري التحميل…")).toBe(true);
    expect(isGentleLoadingCopy("جاري تحميل الإعدادات…")).toBe(true);
    expect(isGentleLoadingCopy("  جاري فتح دراسة العقار…")).toBe(true);
  });

  it("leaves other copy alone", () => {
    expect(isGentleLoadingCopy("لا توجد معاملات")).toBe(false);
    expect(isGentleLoadingCopy("جاريالحفظ")).toBe(false);
    expect(isGentleLoadingCopy(null)).toBe(false);
  });
});
