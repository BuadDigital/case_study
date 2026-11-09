import { describe, expect, it } from "vitest";
import {
  isJeddahPlaceholderPin,
  jeddahPlaceholderPinError,
  shouldUseJeddahDefaultCoords,
} from "../jeddah-default-coords";

describe("shouldUseJeddahDefaultCoords", () => {
  it.each([
    ["", "", true],
    ["21.5433", "39.1728", true], // legacy Red Sea sample
    ["21.543300", "39.172800", true],
    ["21.5", "", true],
    ["abc", "39.1", true],
    ["21.5abc", "39.1", true],
    ["0", "0", true],
    ["40.7", "-74.0", true], // outside Saudi bounds
    ["21.481000", "39.186500", false],
    [" 24.7136 ", " 46.6753 ", false],
    ["٢١٫٤٨١", "٣٩٫١٨٦٥", false],
  ])("(%j, %j) → %s", (lat, lng, expected) => {
    expect(shouldUseJeddahDefaultCoords(lat, lng)).toBe(expected);
  });
});

describe("jeddahPlaceholderPinError (A→Z 2026-11-02 #42)", () => {
  it("refuses the untouched Jeddah placeholder for a property outside Jeddah", () => {
    expect(jeddahPlaceholderPinError("21.481000", "39.186500", "الرياض")).toContain("الرياض");
    expect(jeddahPlaceholderPinError("21.48100", "39.18650", "")).toBeTruthy();
  });

  it("lets a Jeddah property, or a moved pin, be pinned", () => {
    expect(jeddahPlaceholderPinError("21.481000", "39.186500", "جدة")).toBeNull();
    expect(jeddahPlaceholderPinError("21.481000", "39.186500", " جده ")).toBeNull();
    expect(jeddahPlaceholderPinError("24.71360", "46.67530", "الرياض")).toBeNull();
    expect(jeddahPlaceholderPinError("", "", "الرياض")).toBeNull();
  });

  it("recognises the placeholder in any digit system", () => {
    expect(isJeddahPlaceholderPin("٢١٫٤٨١", "٣٩٫١٨٦٥")).toBe(true);
    expect(isJeddahPlaceholderPin("21.4812", "39.1865")).toBe(false);
  });
});
