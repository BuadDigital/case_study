import { describe, expect, it } from "vitest";
import type { CaseStudyInfoRolesMatrix } from "@settings/mfe/lib/prototype/case-study-info-roles-storage";
import { computePartyCaseStudyProgress } from "../case-study-party-progress";

describe("computePartyCaseStudyProgress", () => {
  const matrix: CaseStudyInfoRolesMatrix = {
    survey_0: { eng: "primary", insp: "primary" },
    survey_1: { eng: "primary", insp: "primary" },
    comp_0: { insp: "primary" },
  };

  it("counts specialist official answers toward party progress", () => {
    const rows = computePartyCaseStudyProgress(matrix, {
      specA: {
        survey_0: "A",
        survey_1: "A",
      },
      eng: {},
      insp: {},
    });

    expect(rows.find((r) => r.partyId === "eng")).toMatchObject({
      answered: 2,
      total: 2,
      pct: 100,
    });
  });

  it("shows partial inspector progress when specialist did not answer all", () => {
    const rows = computePartyCaseStudyProgress(matrix, {
      specA: {
        survey_0: "A",
      },
      insp: { comp_0: "B" },
    });

    expect(rows.find((r) => r.partyId === "insp")).toMatchObject({
      answered: 2,
      total: 3,
      pct: 67,
    });
  });
});
