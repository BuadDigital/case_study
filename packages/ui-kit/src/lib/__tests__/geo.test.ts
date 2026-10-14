import { describe, expect, it } from "vitest";
import {
  haversineKm,
  haversineMeters,
  parseCoordinate,
  parseCoordinatePair,
  parseLatLng,
} from "../geo";
import { toArabicDigits, toLatinDigits } from "../arabic-digits";

describe("toLatinDigits / toArabicDigits", () => {
  it.each([
    ["٠١٢٣٤٥٦٧٨٩", "0123456789"],
    ["۰۱۲۳۴۵۶۷۸۹", "0123456789"],
    ["رقم ١٢a", "رقم 12a"],
    ["", ""],
  ])("toLatinDigits(%j) → %j", (input, expected) => {
    expect(toLatinDigits(input)).toBe(expected);
  });

  it("toArabicDigits maps Latin digits only", () => {
    expect(toArabicDigits("1448/4/16 هـ")).toBe("١٤٤٨/٤/١٦ هـ");
  });
});

describe("parseCoordinate", () => {
  it.each<[string | number | null | undefined, "lat" | "lng" | undefined, number | null]>([
    ["21.5", "lat", 21.5],
    ["  -21.5 ", "lat", -21.5],
    ["+39.1", "lng", 39.1],
    ["٢١٫٥", "lat", 21.5],
    ["۲۱.۵", "lat", 21.5],
    ["\u200F21.5", "lat", 21.5],
    ["\u221221.5", "lat", -21.5],
    ["0", "lat", 0],
    [21.5, "lat", 21.5],
    ["21.5abc", "lat", null],
    ["21,5", "lat", null],
    ["21.", "lat", null],
    [".5", "lat", null],
    ["1e2", "lng", null],
    ["", "lat", null],
    ["   ", "lat", null],
    [null, "lat", null],
    [undefined, "lng", null],
    [Number.NaN, "lat", null],
    [Number.POSITIVE_INFINITY, "lng", null],
    ["90", "lat", 90],
    ["90.0001", "lat", null],
    ["-90.5", "lat", null],
    ["180", "lng", 180],
    ["180.5", "lng", null],
    ["120", undefined, 120],
    ["181", undefined, null],
  ])("parseCoordinate(%j, %s) → %s", (input, axis, expected) => {
    expect(parseCoordinate(input, axis)).toBe(expected);
  });
});

describe("parseLatLng", () => {
  it.each<[string | number | null | undefined, string | number | null | undefined, { lat: number; lng: number } | null]>([
    ["21.481", "39.1865", { lat: 21.481, lng: 39.1865 }],
    [21.481, 39.1865, { lat: 21.481, lng: 39.1865 }],
    ["٢١٫٤٨١", "٣٩٫١٨٦٥", { lat: 21.481, lng: 39.1865 }],
    ["0", "0", null],
    [0, 0, null],
    ["0", "39.1", { lat: 0, lng: 39.1 }],
    ["", "39.1", null],
    ["21.5abc", "39.1", null],
    ["91", "39.1", null],
    ["21.5", "181", null],
    [null, undefined, null],
  ])("parseLatLng(%j, %j) → %j", (lat, lng, expected) => {
    expect(parseLatLng(lat, lng)).toEqual(expected);
  });
});

describe("parseCoordinatePair", () => {
  it.each<[string | null | undefined, { lat: number; lng: number } | null]>([
    ["24.7136, 46.6753", { lat: 24.7136, lng: 46.6753 }],
    ["24.7136,46.6753", { lat: 24.7136, lng: 46.6753 }],
    ["24.7136،46.6753", { lat: 24.7136, lng: 46.6753 }],
    ["24.7136 ، 46.6753", { lat: 24.7136, lng: 46.6753 }],
    ["24.7136 46.6753", { lat: 24.7136, lng: 46.6753 }],
    ["  24.7136\t46.6753  ", { lat: 24.7136, lng: 46.6753 }],
    ["٢٤٫٧١٣٦، ٤٦٫٦٧٥٣", { lat: 24.7136, lng: 46.6753 }],
    ["-33.86, 151.2", { lat: -33.86, lng: 151.2 }],
    ["0, 0", null],
    ["0,0", null],
    ["", null],
    [null, null],
    ["24.7", null],
    ["24.7136,", null],
    ["24.7136, 4x", null],
    ["21.5abc, 39.1", null],
    ["(24.7, 46.6)", null],
    ["24.7, 46.6, 3", null],
    ["24.7,, 46.6", null],
    ["24.7; 46.6", null],
    ["124.7, 46.6", null],
    ["24.7, 246.6", null],
  ])("parseCoordinatePair(%j) → %j", (input, expected) => {
    expect(parseCoordinatePair(input)).toEqual(expected);
  });
});

describe("haversineKm", () => {
  const jeddah = { lat: 21.481, lng: 39.1865 };
  const riyadh = { lat: 24.7136, lng: 46.6753 };

  it("is zero for the same point and symmetric", () => {
    expect(haversineKm(jeddah, jeddah)).toBe(0);
    expect(haversineKm(jeddah, riyadh)).toBeCloseTo(haversineKm(riyadh, jeddah), 9);
  });

  it.each<[{ lat: number; lng: number }, { lat: number; lng: number }, number]>([
    [jeddah, riyadh, 846],
    [{ lat: 0, lng: 0 }, { lat: 0, lng: 1 }, 111.19],
    [{ lat: 0, lng: 0 }, { lat: 0, lng: 180 }, 20015.09],
    [{ lat: 90, lng: 0 }, { lat: -90, lng: 0 }, 20015.09],
  ])("haversineKm(%j, %j) ≈ %d", (a, b, km) => {
    expect(Math.abs(haversineKm(a, b) - km)).toBeLessThan(1);
  });

  it("haversineMeters is the same distance in metres", () => {
    const a = { lat: 21.48, lng: 39.19 };
    const b = { lat: 21.49, lng: 39.2 };
    expect(haversineMeters(a, b)).toBeCloseTo(haversineKm(a, b) * 1000, 6);
    expect(haversineMeters(a, b)).toBeGreaterThan(1000);
    expect(haversineMeters(a, b)).toBeLessThan(2000);
  });
});
