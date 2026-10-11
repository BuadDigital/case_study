import { describe, expect, it } from "vitest";
import { shouldUseJeddahDefaultCoords } from "../jeddah-default-coords";

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
