import { DeedNatureMatchOutcomes } from "@platform/app-shared/domain/case-study/deed-nature-match-outcomes";

export type DeedNatureMatchSource =
  | "prior-survey"
  | "engineering-office"
  | "inspector"
  | "none";

export type DeedNatureMatchProposal = {
  source: DeedNatureMatchSource;
  suggested: typeof DeedNatureMatchOutcomes.Matched | typeof DeedNatureMatchOutcomes.Differences | "";
  waiting: boolean;
  sourceLabelAr: string;
};

export function inspectorBoundariesIndicateMismatch(
  matches: Iterable<{ matches: boolean }> | null | undefined,
): boolean {
  if (!matches) return false;
  for (const row of matches) {
    if (!row.matches) return true;
  }
  return false;
}

/**
 * Who owns the first deed↔nature verdict, and what they reported.
 * Prior survey ⇒ matched. Engineering office when assigned. Else inspector.
 */
export function proposeDeedNatureMatch(input: {
  hasPriorSurvey: boolean;
  engineeringAssigned: boolean;
  engineeringDeedMatchesNature: "yes" | "no" | null;
  inspectorSubmitted: boolean;
  inspectorBoundaryMismatch: boolean;
}): DeedNatureMatchProposal {
  if (input.hasPriorSurvey) {
    return {
      source: "prior-survey",
      suggested: DeedNatureMatchOutcomes.Matched,
      waiting: false,
      sourceLabelAr: "رفع مساحي سابق لنفس الصك — المعاملة مطابقة ما لم يُعدَّل.",
    };
  }

  if (input.engineeringAssigned) {
    if (input.engineeringDeedMatchesNature === "yes") {
      return {
        source: "engineering-office",
        suggested: DeedNatureMatchOutcomes.Matched,
        waiting: false,
        sourceLabelAr: "المكتب الهندسي: الصك مطابق للطبيعة.",
      };
    }
    if (input.engineeringDeedMatchesNature === "no") {
      return {
        source: "engineering-office",
        suggested: DeedNatureMatchOutcomes.Differences,
        waiting: false,
        sourceLabelAr: "المكتب الهندسي: الصك غير مطابق للطبيعة.",
      };
    }
    return {
      source: "engineering-office",
      suggested: "",
      waiting: true,
      sourceLabelAr: "بانتظار مطابقة المكتب الهندسي.",
    };
  }

  if (input.inspectorSubmitted) {
    if (input.inspectorBoundaryMismatch) {
      return {
        source: "inspector",
        suggested: DeedNatureMatchOutcomes.Differences,
        waiting: false,
        sourceLabelAr: "المعاين: حد واحد أو أكثر غير مطابق للصك.",
      };
    }
    return {
      source: "inspector",
      suggested: DeedNatureMatchOutcomes.Matched,
      waiting: false,
      sourceLabelAr: "المعاين: الحدود مطابقة للصك.",
    };
  }

  return {
    source: "inspector",
    suggested: "",
    waiting: true,
    sourceLabelAr: "لا مكتب هندسي على المعاملة — المطابقة مسؤولية المعاين. بانتظار رفعه.",
  };
}
