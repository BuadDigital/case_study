import { describe, expect, it } from "vitest";
import { fmtSar } from "../number";

describe("fmtSar", () => {
  it("shows — with no suffix for an absent amount", () => {
    expect(fmtSar(null)).toBe("—");
    expect(fmtSar(undefined)).toBe("—");
    expect(fmtSar(Number.NaN)).toBe("—");
    expect(fmtSar(null, { trim: true })).toBe("—");
  });

  it("fixes two decimals by default, Latin digits and « ر.س»", () => {
    expect(fmtSar(1234.5)).toBe("1,234.50 ر.س");
    expect(fmtSar(0)).toBe("0.00 ر.س");
  });

  it("takes a plain digit count", () => {
    expect(fmtSar(1250000, 0)).toBe("1,250,000 ر.س");
    expect(fmtSar(1234.567, 0)).toBe("1,235 ر.س");
  });

  it("trim: true keeps up to digits with no trailing zeros", () => {
    expect(fmtSar(1234.5, { trim: true })).toBe("1,234.5 ر.س");
    expect(fmtSar(1234, { trim: true })).toBe("1,234 ر.س");
    expect(fmtSar(1.239, { trim: true })).toBe("1.24 ر.س");
    expect(fmtSar(1.2345, { digits: 3, trim: true })).toBe("1.235 ر.س");
    expect(fmtSar(0, { trim: true })).toBe("0 ر.س");
  });

  it('trim: "whole" drops the fraction only for whole amounts', () => {
    expect(fmtSar(1500, { trim: "whole" })).toBe("1,500 ر.س");
    expect(fmtSar(1500.5, { trim: "whole" })).toBe("1,500.50 ر.س");
  });

  it("never prints Arabic-Indic digits, «ريال» or a SAR prefix", () => {
    const out = fmtSar(987654.32, { trim: true });
    expect(out).not.toMatch(/[٠-٩]|ريال|SAR/);
  });
});
