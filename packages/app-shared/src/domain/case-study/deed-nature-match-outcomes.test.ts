import { describe, expect, it } from "vitest";
import {
  DeedNatureMatchOutcomes,
  deedNatureMatchRequiresNotes,
  isDeedNatureMatchChosen,
  isDeedNatureMatchKnown,
  normalizeDeedNatureMatchOutcome,
} from "./deed-nature-match-outcomes";

describe("deed-nature-match-outcomes", () => {
  it("treats empty as known (draft) but not chosen (submit)", () => {
    expect(isDeedNatureMatchKnown("")).toBe(true);
    expect(isDeedNatureMatchKnown("  ")).toBe(true);
    expect(isDeedNatureMatchChosen("")).toBe(false);
  });

  it("accepts the three concrete outcomes", () => {
    for (const value of [
      DeedNatureMatchOutcomes.Matched,
      DeedNatureMatchOutcomes.Differences,
      DeedNatureMatchOutcomes.Impediment,
    ]) {
      expect(isDeedNatureMatchKnown(value)).toBe(true);
      expect(isDeedNatureMatchChosen(value)).toBe(true);
    }
  });

  it("rejects unknown vocabulary", () => {
    expect(isDeedNatureMatchKnown("mismatch")).toBe(false);
    expect(isDeedNatureMatchChosen("mismatch")).toBe(false);
  });

  it("requires notes for فروق / مرشح تعذر only", () => {
    expect(deedNatureMatchRequiresNotes(DeedNatureMatchOutcomes.Matched)).toBe(
      false,
    );
    expect(
      deedNatureMatchRequiresNotes(DeedNatureMatchOutcomes.Differences),
    ).toBe(true);
    expect(
      deedNatureMatchRequiresNotes(DeedNatureMatchOutcomes.Impediment),
    ).toBe(true);
    expect(
      deedNatureMatchRequiresNotes(
        normalizeDeedNatureMatchOutcome(" DIFFERENCES "),
      ),
    ).toBe(true);
  });
});
