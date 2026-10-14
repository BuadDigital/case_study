import { describe, expect, it } from "vitest";
import { DeedNatureMatchOutcomes } from "@platform/app-shared/domain/case-study/deed-nature-match-outcomes";
import { createInspectorWorkspaceDraft } from "../inspector-workspace-data";
import {
  inspectorBoundariesIndicateMismatch,
  inspectorMismatchNotesText,
  proposeDeedNatureMatch,
} from "../deed-nature-match-proposal";

function inspectorDraft(
  patch: Partial<ReturnType<typeof createInspectorWorkspaceDraft>> = {},
) {
  return {
    ...createInspectorWorkspaceDraft({ taskId: "t", propertyId: "p", poNumber: "PO" }),
    ...patch,
  };
}

const base = {
  hasPriorSurvey: false,
  engineeringAssigned: false,
  engineeringDeedMatchesNature: null,
} as const;

describe("proposeDeedNatureMatch", () => {
  it("waits for the inspector until the inspection is submitted", () => {
    const hit = proposeDeedNatureMatch({
      ...base,
      inspector: inspectorDraft({ deedMatchesNature: "yes" }),
      inspectorSubmitted: false,
    });
    expect(hit.source).toBe("inspector");
    expect(hit.waiting).toBe(true);
    expect(hit.suggested).toBe("");
  });

  it("an explicit «yes» proposes matched", () => {
    const hit = proposeDeedNatureMatch({
      ...base,
      inspector: inspectorDraft({ deedMatchesNature: "yes" }),
      inspectorSubmitted: true,
    });
    expect(hit.suggested).toBe(DeedNatureMatchOutcomes.Matched);
    expect(hit.waiting).toBe(false);
    expect(hit.inspectorMismatchNotes).toBe("");
  });

  it("an explicit «no» proposes differences and carries the per-side notes", () => {
    const draft = inspectorDraft({ deedMatchesNature: "no" });
    draft.boundaryMatches.north = { ...draft.boundaryMatches.north, matches: false, mismatchNote: "شارع بدل جار" };
    draft.boundaryMatches.west = { ...draft.boundaryMatches.west, matches: false, mismatchNote: " انحراف 2م " };
    draft.boundaryMatches.south = { ...draft.boundaryMatches.south, matches: true, mismatchNote: "تجاهل" };
    const hit = proposeDeedNatureMatch({ ...base, inspector: draft, inspectorSubmitted: true });
    expect(hit.suggested).toBe(DeedNatureMatchOutcomes.Differences);
    expect(hit.inspectorMismatchNotes).toBe("الحد الشمالي: شارع بدل جار\nالحد الغربي: انحراف 2م");
  });

  it("the explicit verdict wins over the sides", () => {
    const draft = inspectorDraft({ deedMatchesNature: "yes" });
    draft.boundaryMatches.north = { ...draft.boundaryMatches.north, matches: false, mismatchNote: "x" };
    const hit = proposeDeedNatureMatch({ ...base, inspector: draft, inspectorSubmitted: true });
    expect(hit.suggested).toBe(DeedNatureMatchOutcomes.Matched);
  });

  it("a legacy submitted payload without the verdict derives differences from a non-matching side", () => {
    const draft = inspectorDraft();
    draft.boundaryMatches.east = { ...draft.boundaryMatches.east, matches: false, mismatchNote: "فرق" };
    const hit = proposeDeedNatureMatch({ ...base, inspector: draft, inspectorSubmitted: true });
    expect(hit.suggested).toBe(DeedNatureMatchOutcomes.Differences);
  });

  it("a legacy submitted payload with every side explicitly matching derives matched", () => {
    const draft = inspectorDraft();
    for (const key of ["north", "south", "east", "west"] as const) {
      draft.boundaryMatches[key] = { ...draft.boundaryMatches[key], matches: true };
    }
    const hit = proposeDeedNatureMatch({ ...base, inspector: draft, inspectorSubmitted: true });
    expect(hit.suggested).toBe(DeedNatureMatchOutcomes.Matched);
  });

  it("never defaults to matched when the inspector said nothing explicit", () => {
    const hit = proposeDeedNatureMatch({
      ...base,
      inspector: inspectorDraft(),
      inspectorSubmitted: true,
    });
    expect(hit.suggested).toBe("");
    expect(hit.waiting).toBe(false);
    expect(hit.sourceLabelAr).toBe("لم يحدد المعاين صراحةً");
  });

  it("a prior survey and the engineering office are info lines, never the suggestion", () => {
    const hit = proposeDeedNatureMatch({
      hasPriorSurvey: true,
      engineeringAssigned: true,
      engineeringDeedMatchesNature: "yes",
      inspector: inspectorDraft(),
      inspectorSubmitted: true,
    });
    expect(hit.suggested).toBe("");
    expect(hit.source).toBe("inspector");
    expect(hit.infoLinesAr).toHaveLength(2);
    expect(hit.infoLinesAr[1]).toContain("مطابق للطبيعة");
  });

  it("keeps the info lines while the inspector has not submitted", () => {
    const hit = proposeDeedNatureMatch({
      hasPriorSurvey: false,
      engineeringAssigned: true,
      engineeringDeedMatchesNature: "no",
      inspector: null,
      inspectorSubmitted: false,
    });
    expect(hit.waiting).toBe(true);
    expect(hit.suggested).toBe("");
    expect(hit.infoLinesAr).toEqual(["المكتب الهندسي: الصك غير مطابق للطبيعة."]);
  });

  it("says the office has not ruled yet when assigned without a verdict", () => {
    const hit = proposeDeedNatureMatch({
      ...base,
      engineeringAssigned: true,
      inspector: null,
      inspectorSubmitted: false,
    });
    expect(hit.infoLinesAr).toEqual(["المكتب الهندسي: لم يُبدِ حكمه بعد."]);
  });
});

describe("inspectorBoundariesIndicateMismatch", () => {
  it("is true only for an explicit non-match (an untouched side is not a mismatch)", () => {
    expect(
      inspectorBoundariesIndicateMismatch([{ matches: true }, { matches: false }]),
    ).toBe(true);
    expect(inspectorBoundariesIndicateMismatch([{ matches: true }])).toBe(false);
    expect(inspectorBoundariesIndicateMismatch([{ matches: null }])).toBe(false);
    expect(inspectorBoundariesIndicateMismatch(null)).toBe(false);
  });
});

describe("inspectorMismatchNotesText", () => {
  it("skips matching sides and sides without a note", () => {
    expect(
      inspectorMismatchNotesText({
        north: { matches: false, mismatchNote: "" },
        south: { matches: true, mismatchNote: "x" },
        east: { matches: false, mismatchNote: "فرق" },
      }),
    ).toBe("الحد الشرقي: فرق");
    expect(inspectorMismatchNotesText(null)).toBe("");
  });
});
