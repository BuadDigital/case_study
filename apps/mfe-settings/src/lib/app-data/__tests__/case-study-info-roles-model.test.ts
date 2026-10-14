import { describe, expect, it } from "vitest";
import {
  CASE_STUDY_INFO_PARTIES,
  CASE_STUDY_QUESTION_CATALOG,
} from "../case-study-info-roles-data";
import {
  isCaseStudyQuestionVisibleToSpecialist,
  isStoredCaseStudyInfoRolesMatrixEmpty,
  mergeConfig,
  seedConfigFromDefaults,
  type CaseStudyInfoRolesMatrix,
} from "../case-study-info-roles-model";
import { defaultCaseStudyInfoRolesMatrix } from "../default-case-study-info-roles-matrix";

/** The pre-2026-10-04 live row: the government reviewer held question 4 alone. */
function legacyMatrixWithGovernment(): CaseStudyInfoRolesMatrix {
  const matrix = defaultCaseStudyInfoRolesMatrix();
  return {
    ...matrix,
    deed_3: { gov: "verify" },
    deed_4: { ...matrix.deed_4, gov: "secondary" },
    deed_5: { ...matrix.deed_5, gov: "secondary" },
  } as unknown as CaseStudyInfoRolesMatrix;
}

function mergeLegacy(matrix: CaseStudyInfoRolesMatrix) {
  return mergeConfig({
    matrix,
    notes: {},
    updatedAt: "2026-10-04T00:00:00Z",
  });
}

describe("case-study info roles: government reviewer removal", () => {
  it("is no longer a party", () => {
    expect(CASE_STUDY_INFO_PARTIES.map((p) => p.id)).toEqual([
      "specA",
      "insp",
      "val",
      "eng",
      "sup",
    ]);
  });

  it("defaults carry no government role anywhere", () => {
    const matrix = defaultCaseStudyInfoRolesMatrix();
    for (const row of Object.values(matrix)) {
      expect(Object.keys(row)).not.toContain("gov");
    }
  });

  it("defaults give the specialist «أصيل» on question 4 and keep Q5-Q8 specialist roles", () => {
    const matrix = defaultCaseStudyInfoRolesMatrix();
    expect(matrix.deed_3).toEqual({ specA: "primary" });
    expect(matrix.deed_4?.specA).toBe("primary");
    expect(matrix.deed_5).toEqual({
      specA: "verify",
      insp: "secondary",
      sup: "verify",
    });
    expect(matrix.deed_6?.specA).toBe("primary");
    expect(matrix.deed_7?.specA).toBe("primary");
  });

  it("every default question is still visible to the specialist or another party", () => {
    const matrix = seedConfigFromDefaults().matrix;
    const unassigned = CASE_STUDY_QUESTION_CATALOG.filter(
      (q) =>
        !CASE_STUDY_INFO_PARTIES.some((p) => Boolean(matrix[q.key]?.[p.id])),
    );
    expect(unassigned).toEqual([]);
    expect(isCaseStudyQuestionVisibleToSpecialist(matrix, "deed_3")).toBe(true);
  });

  it("drops stored government roles and hands question 4 to the specialist", () => {
    const merged = mergeLegacy(legacyMatrixWithGovernment());

    for (const row of Object.values(merged.matrix)) {
      expect(Object.keys(row)).not.toContain("gov");
    }
    expect(merged.matrix.deed_3).toEqual({ specA: "primary" });
    // question 6 keeps its specialist + supervisor «verify» roles, minus gov
    expect(merged.matrix.deed_5).toEqual({
      specA: "verify",
      insp: "secondary",
      sup: "verify",
    });
    expect(isCaseStudyQuestionVisibleToSpecialist(merged.matrix, "deed_3")).toBe(
      true,
    );
  });

  it("does not override a question 4 row that still has someone", () => {
    const matrix = legacyMatrixWithGovernment();
    matrix.deed_3 = { gov: "verify", insp: "secondary" } as unknown as CaseStudyInfoRolesMatrix[string];

    const merged = mergeLegacy(matrix);

    expect(merged.matrix.deed_3).toEqual({ insp: "secondary" });
  });

  it("is idempotent", () => {
    const once = mergeLegacy(legacyMatrixWithGovernment());
    const twice = mergeLegacy(once.matrix);

    expect(twice.matrix).toEqual(once.matrix);
  });

  it("treats a matrix holding only government roles as empty (so the defaults seed)", () => {
    const onlyGov = { deed_3: { gov: "verify" } } as unknown as CaseStudyInfoRolesMatrix;

    expect(isStoredCaseStudyInfoRolesMatrixEmpty(onlyGov)).toBe(true);
    expect(mergeLegacy(onlyGov).matrix.deed_3).toEqual({ specA: "primary" });
    expect(mergeLegacy(onlyGov).matrix.deed_0).toEqual({ specA: "verify" });
  });
});
