import type {
  CaseStudyInfoPartyId,
  CaseStudyInfoRoleType,
} from "./case-study-info-roles-data";

type Row = Partial<Record<CaseStudyInfoPartyId, CaseStudyInfoRoleType>>;

export type DefaultCaseStudyInfoRolesMatrix = Record<string, Row>;

function row(...entries: [CaseStudyInfoPartyId, CaseStudyInfoRoleType][]): Row {
  return Object.fromEntries(entries) as Row;
}

/**
 * Canonical matrix from docs/case-study-info-roles.md (37 questions).
 * Used as baseline when API config is empty or partial.
 */
export function defaultCaseStudyInfoRolesMatrix(): DefaultCaseStudyInfoRolesMatrix {
  return {
    deed_0: row(["specA", "verify"]),
    deed_1: row(["insp", "secondary"], ["specA", "verify"]),
    deed_2: row(["insp", "secondary"], ["specA", "verify"]),
    deed_3: row(["gov", "verify"]),
    deed_4: row(
      ["specA", "primary"],
      ["insp", "secondary"],
      ["val", "secondary"],
      ["gov", "secondary"],
      ["sup", "verify"],
    ),
    deed_5: row(
      ["specA", "verify"],
      ["insp", "secondary"],
      ["gov", "secondary"],
      ["sup", "verify"],
    ),
    deed_6: row(["specA", "primary"], ["gov", "secondary"], ["sup", "verify"]),
    deed_7: row(
      ["specA", "primary"],
      ["insp", "secondary"],
      ["val", "verify"],
      ["gov", "secondary"],
      ["eng", "verify"],
      ["sup", "verify"],
    ),
    deed_8: row(["specA", "verify"]),
    deed_9: row(["specA", "verify"], ["val", "secondary"]),
    deed_10: row(["specA", "verify"]),
    survey_0: row(["eng", "verify"]),
    survey_1: row(["eng", "verify"]),
    survey_2: row(["eng", "primary"]),
    survey_3: row(["eng", "primary"], ["insp", "primary"]),
    survey_4: row(["eng", "primary"], ["insp", "primary"]),
    survey_5: row(["eng", "primary"], ["insp", "primary"]),
    survey_6: row(["eng", "primary"]),
    comp_0: row(["insp", "primary"]),
    comp_1: row(["insp", "primary"]),
    comp_2: row(["insp", "primary"]),
    comp_3: row(["insp", "primary"]),
    comp_4: row(["insp", "primary"]),
    comp_5: row(["insp", "primary"]),
    comp_6: row(["insp", "primary"]),
    comp_7: row(["insp", "primary"]),
    comp_8: row(["insp", "primary"]),
    occ_0: row(["insp", "primary"]),
    occ_1: row(["insp", "primary"]),
    occ_2: row(["insp", "primary"]),
    occ_3: row(["insp", "primary"]),
    occ_4: row(["insp", "primary"]),
    occ_5: row(["insp", "primary"]),
    extra_0: row(["specA", "primary"]),
    extra_1: row(["insp", "primary"]),
    extra_2: row(["eng", "primary"], ["insp", "primary"]),
    extra_3: row(["insp", "primary"]),
  };
}
