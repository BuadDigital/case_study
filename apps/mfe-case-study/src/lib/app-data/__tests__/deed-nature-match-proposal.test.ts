import { describe, expect, it } from "vitest";
import { DeedNatureMatchOutcomes } from "@platform/app-shared/domain/case-study/deed-nature-match-outcomes";
import {
  inspectorBoundariesIndicateMismatch,
  proposeDeedNatureMatch,
} from "../deed-nature-match-proposal";

describe("proposeDeedNatureMatch", () => {
  it("treats a prior survey as already matched", () => {
    const hit = proposeDeedNatureMatch({
      hasPriorSurvey: true,
      engineeringAssigned: true,
      engineeringDeedMatchesNature: null,
      inspectorSubmitted: false,
      inspectorBoundaryMismatch: false,
    });
    expect(hit.source).toBe("prior-survey");
    expect(hit.suggested).toBe(DeedNatureMatchOutcomes.Matched);
    expect(hit.waiting).toBe(false);
  });

  it("uses the engineering office when it is assigned", () => {
    const hit = proposeDeedNatureMatch({
      hasPriorSurvey: false,
      engineeringAssigned: true,
      engineeringDeedMatchesNature: "no",
      inspectorSubmitted: true,
      inspectorBoundaryMismatch: false,
    });
    expect(hit.source).toBe("engineering-office");
    expect(hit.suggested).toBe(DeedNatureMatchOutcomes.Differences);
  });

  it("falls to the inspector when no engineering office is assigned", () => {
    const hit = proposeDeedNatureMatch({
      hasPriorSurvey: false,
      engineeringAssigned: false,
      engineeringDeedMatchesNature: null,
      inspectorSubmitted: true,
      inspectorBoundaryMismatch: true,
    });
    expect(hit.source).toBe("inspector");
    expect(hit.suggested).toBe(DeedNatureMatchOutcomes.Differences);
  });

  it("waits on the engineering office when it is assigned but has not answered", () => {
    const hit = proposeDeedNatureMatch({
      hasPriorSurvey: false,
      engineeringAssigned: true,
      engineeringDeedMatchesNature: null,
      inspectorSubmitted: true,
      inspectorBoundaryMismatch: false,
    });
    expect(hit.source).toBe("engineering-office");
    expect(hit.waiting).toBe(true);
    expect(hit.suggested).toBe("");
  });

  it("waits on the inspector when they have not submitted", () => {
    const hit = proposeDeedNatureMatch({
      hasPriorSurvey: false,
      engineeringAssigned: false,
      engineeringDeedMatchesNature: null,
      inspectorSubmitted: false,
      inspectorBoundaryMismatch: false,
    });
    expect(hit.waiting).toBe(true);
    expect(hit.suggested).toBe("");
  });
});

describe("inspectorBoundariesIndicateMismatch", () => {
  it("is true when any side does not match", () => {
    expect(
      inspectorBoundariesIndicateMismatch([
        { matches: true },
        { matches: false },
      ]),
    ).toBe(true);
    expect(inspectorBoundariesIndicateMismatch([{ matches: true }])).toBe(
      false,
    );
  });
});
