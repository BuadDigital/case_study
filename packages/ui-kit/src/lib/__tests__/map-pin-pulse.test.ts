import { describe, expect, it } from "vitest";
import {
  MAP_PIN_EMPHASIS_SCALE,
  MAP_PIN_PULSE_MS,
  MAP_PIN_STILL_RING,
  mapPinPulseFrame,
} from "../map-pin-pulse";

/** Omar 2026-11-11: the subject property blinks on the comparables map. */
describe("mapPinPulseFrame", () => {
  it("starts on the dot, fully visible, and fades as it grows", () => {
    const start = mapPinPulseFrame(0);
    const middle = mapPinPulseFrame(MAP_PIN_PULSE_MS / 2);
    const late = mapPinPulseFrame(MAP_PIN_PULSE_MS - 1);
    expect(start.scale).toBe(MAP_PIN_EMPHASIS_SCALE);
    expect(middle.scale).toBeGreaterThan(start.scale);
    expect(late.scale).toBeGreaterThan(middle.scale);
    expect(start.opacity).toBeGreaterThan(middle.opacity);
    expect(late.opacity).toBeLessThan(0.01);
  });

  it("repeats every pulse", () => {
    expect(mapPinPulseFrame(MAP_PIN_PULSE_MS + 400)).toEqual(mapPinPulseFrame(400));
  });

  it("reads a bad time as the start of the pulse", () => {
    expect(mapPinPulseFrame(-5)).toEqual(mapPinPulseFrame(0));
    expect(mapPinPulseFrame(Number.NaN)).toEqual(mapPinPulseFrame(0));
  });

  it("keeps a still ring outside the dot for reduced motion", () => {
    expect(MAP_PIN_STILL_RING.scale).toBeGreaterThan(MAP_PIN_EMPHASIS_SCALE);
    expect(MAP_PIN_STILL_RING.opacity).toBeGreaterThan(0);
  });
});
