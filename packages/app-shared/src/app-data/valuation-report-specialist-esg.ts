/** Shared ESG constants and types — filled by the appraiser in final review. */

export type SpecialistEsgGroup = {
  none: boolean;
  selected: string[];
  notes: string;
};

export type SpecialistEsgInputs = {
  esgEnv: SpecialistEsgGroup;
  esgSoc: SpecialistEsgGroup;
  esgGov: SpecialistEsgGroup;
};

export const ESG_NONE_NOTES = {
  env: "لا يوجد تأثير للعوامل البيئية على القيمة التقديرية للعقار.",
  soc: "لا يوجد تأثير للعوامل الاجتماعية على القيمة التقديرية للعقار.",
  gov: "لا يوجد تأثير لعوامل الحوكمة على القيمة التقديرية للعقار.",
} as const;

/** When «يوجد تأثير» is on, notes must be a real impact description (not blank / none text). */
function esgImpactDescriptionMissing(
  group: SpecialistEsgGroup | null | undefined,
  noneNotes: string,
): boolean {
  if (!group || group.none) return false;
  const notes = (group.notes ?? "").trim();
  if (!notes) return true;
  return notes === noneNotes.trim();
}

export function esgGroupsMissingImpactDescription(
  groups: SpecialistEsgInputs | null | undefined,
): Array<"env" | "soc" | "gov"> {
  if (!groups) return [];
  const missing: Array<"env" | "soc" | "gov"> = [];
  if (esgImpactDescriptionMissing(groups.esgEnv, ESG_NONE_NOTES.env)) {
    missing.push("env");
  }
  if (esgImpactDescriptionMissing(groups.esgSoc, ESG_NONE_NOTES.soc)) {
    missing.push("soc");
  }
  if (esgImpactDescriptionMissing(groups.esgGov, ESG_NONE_NOTES.gov)) {
    missing.push("gov");
  }
  return missing;
}
