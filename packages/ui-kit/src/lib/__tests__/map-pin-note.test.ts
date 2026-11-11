import { describe, expect, it } from "vitest";
import { mapPinNoteLines, placeMapPinNote } from "../map-pin-note";

/** Omar 2026-11-11: a quiet note over the pressed pin instead of Google's balloon. */
describe("the note over a pressed map pin", () => {
  it("keeps the lines that say something", () => {
    expect(mapPinNoteLines([" CMP-1 · فيلا ", "", null, undefined, "500 م²"])).toEqual([
      "CMP-1 · فيلا",
      "500 م²",
    ]);
  });

  const note = { mapWidth: 600, noteWidth: 200, noteHeight: 50, offsetPx: 12 };

  it("sits centred above the pin when there is room", () => {
    expect(placeMapPinNote({ ...note, x: 300, y: 200 })).toEqual({ dx: -100, dy: -68 });
  });

  it("stays inside the map beside either edge", () => {
    // Pin 20px from the left edge: the note starts 6px in, not 80px outside.
    expect(placeMapPinNote({ ...note, x: 20, y: 200 }).dx).toBe(-14);
    expect(placeMapPinNote({ ...note, x: 590, y: 200 }).dx).toBe(-196);
  });

  it("drops below the pin when there is no room above", () => {
    expect(placeMapPinNote({ ...note, x: 300, y: 40 }).dy).toBeGreaterThan(0);
  });

  it("centres in a map narrower than the note", () => {
    expect(placeMapPinNote({ ...note, mapWidth: 150, x: 30, y: 200 }).dx).toBe(-55);
  });
});
