import type { PoPropertyIntake } from "./po-intake-data";

/**
 * The property header's «اكتمال الدراسة» ring: the share of the study's stages that are done.
 *
 * How it works: each applicable stage weighs 1 when done, 0.5 while in progress (inspection, survey, case
 * study) and 0 before it starts; the percentage is the weights' sum over the stage count. The stages are
 * primary data, documents, inspection, survey (only when a survey task exists), keys (only on the court path,
 * where the request number is), valuation, the case study and the Enfaz upload. A transaction handed over to
 * Enfaz is complete: every stage counts done.
 *
 * Edge cases: fixed A→Z 2026-11-02 #12 — a fully handed-over transaction showed 67%: the Enfaz stage was never
 * marked done, the retired government-review stage always counted 0, and a property with no survey (none
 * needed) or no keys lost those stages too. Inapplicable stages are now left out instead of counting 0.
 */
export function estimateCaseStudyCompletion(args: {
  property: Pick<PoPropertyIntake, "deedNumber">;
  hasCaseStudyTask: boolean;
  caseStudyDone: boolean;
  hasInspection: boolean;
  inspectionDone: boolean;
  hasSurvey: boolean;
  surveyDone: boolean;
  hasAppraisal: boolean;
  appraisalDone: boolean;
  hasKeysHint: boolean;
  enfathDone: boolean;
}): { pct: number; done: number; total: number } {
  const stage = (has: boolean, done: boolean, partialWhenHas = true) => {
    if (done) return 1;
    if (has && partialWhenHas) return 0.5;
    return 0;
  };

  const stages: number[] = [
    1, // Primary data — always complete in the display
    args.property.deedNumber.trim() ? 1 : 0.5, // Property documents
    stage(args.hasInspection, args.inspectionDone), // Property inspection
    ...(args.hasSurvey ? [stage(true, args.surveyDone)] : []), // Survey report — only when one was given
    ...(args.hasKeysHint ? [1] : []), // Property keys — court path only
    stage(args.hasAppraisal, args.appraisalDone, false), // Property valuation
    stage(args.hasCaseStudyTask, args.caseStudyDone), // Property case study
    args.enfathDone ? 1 : 0, // Upload to Infath
  ];
  const total = stages.length;
  // Handed over to Enfaz: the whole study is behind it.
  if (args.enfathDone) return { pct: 100, done: total, total };
  const sum = stages.reduce((a, b) => a + b, 0);
  const done = stages.filter((s) => s === 1).length;
  return {
    pct: Math.round((sum / total) * 100),
    done,
    total,
  };
}
