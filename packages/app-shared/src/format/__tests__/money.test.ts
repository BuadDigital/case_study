import { describe, expect, it } from "vitest";
import { roundHalfAwayFromZero, roundSar, sumSar, toHalalas, vatSar } from "../money";

describe("roundHalfAwayFromZero", () => {
  it("rounds halves away from zero, like C# MidpointRounding.AwayFromZero", () => {
    expect(roundHalfAwayFromZero(2.5)).toBe(3);
    expect(roundHalfAwayFromZero(-2.5)).toBe(-3);
    expect(roundHalfAwayFromZero(2.675, 2)).toBe(2.68);
    expect(roundHalfAwayFromZero(1.005, 2)).toBe(1.01);
    expect(roundHalfAwayFromZero(-1.005, 2)).toBe(-1.01);
    expect(roundHalfAwayFromZero(-0.4)).toBe(0);
    expect(Object.is(roundHalfAwayFromZero(-0.4), -0)).toBe(false);
  });

  it("rounds to tens/hundreds with negative digits, ignoring float noise", () => {
    expect(roundHalfAwayFromZero(1365849.9999999998, -2)).toBe(1365900);
    expect(roundHalfAwayFromZero(1365849.9, -2)).toBe(1365800);
    expect(roundHalfAwayFromZero(-1365850, -2)).toBe(-1365900);
    expect(roundHalfAwayFromZero(3672142.5)).toBe(3672143);
  });
});

describe("money in halalas", () => {
  it("rounds amounts to 2 decimals half away from zero", () => {
    expect(toHalalas(3500.5)).toBe(350050);
    expect(toHalalas(1.005)).toBe(101);
    expect(roundSar(100.125)).toBe(100.13);
    expect(roundSar(Number.NaN)).toBe(0);
  });

  it("sums exactly", () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sumSar(0.1, 0.2)).toBe(0.3);
    expect(sumSar(3500.5, 525.08, 100)).toBe(4125.58);
  });
});

describe("vatSar", () => {
  it("matches the server's Math.Round(taxable × 0.15, 2, AwayFromZero)", () => {
    expect(Math.round(3500.5 * 0.15 * 100) / 100).toBe(525.07); // the old, wrong screen value
    expect(vatSar(3500.5)).toBe(525.08);
    expect(vatSar(12345.5)).toBe(1851.83);
    expect(vatSar(950.5)).toBe(142.58);
    expect(vatSar(201)).toBe(30.15);
    expect(vatSar(1.5)).toBe(0.23);
  });

  it("whole riyals and zero", () => {
    expect(vatSar(1000)).toBe(150);
    expect(vatSar(3500)).toBe(525);
    expect(vatSar(0)).toBe(0);
  });

  it("takes another rate", () => {
    expect(vatSar(100.5, 0.05)).toBe(5.03);
  });
});
