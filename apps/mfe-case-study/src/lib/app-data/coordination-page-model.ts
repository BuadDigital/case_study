/**
 * The coordinator's page (Omar 2026-11-08) — one page per transaction, in the work page's design, for
 * coordination's whole share: the intake (primary data → bourse → distribution) and the parties'
 * follow-up (the inspector, the engineering office, external parties, linked tasks), closed by
 * «إرسال المعاملة للدراسة». Pure: no React.
 */
import type { WorkflowTask } from "./tasks";

export type CoordinationSectionId =
  | "intake"
  | "bourse"
  | "distribution"
  | "inspector"
  | "survey"
  | "external"
  | "linked";

export type CoordinationSectionDef = {
  id: CoordinationSectionId;
  title: string;
  step: number;
};

/** The follow-up step: every party section is worked together, then the send. */
export const FOLLOW_UP_STEP = 3;
/** Sent to the study (or no longer live): every section is done. */
export const COORDINATION_DONE_STEP = 4;

export const COORDINATION_SECTIONS: readonly CoordinationSectionDef[] = [
  { id: "intake", title: "البيانات الأولية", step: 0 },
  { id: "bourse", title: "استعلام البورصة والملاك", step: 1 },
  { id: "distribution", title: "التوزيع على الأطراف", step: 2 },
  { id: "inspector", title: "المعاين الميداني", step: FOLLOW_UP_STEP },
  { id: "survey", title: "المكتب الهندسي", step: FOLLOW_UP_STEP },
  { id: "external", title: "الأطراف الخارجية", step: FOLLOW_UP_STEP },
  { id: "linked", title: "المهام المرتبطة", step: FOLLOW_UP_STEP },
];

const PHASE_STEP: Partial<Record<WorkflowTask["phase"], number>> = {
  enfath: 0,
  bourse: 1,
  distribution: 2,
};

/**
 * Where the transaction stands on the coordinator's page, from its case-study task.
 *
 * How it works: primary data / bourse / distribution by phase (a failure stands at the phase it
 * stopped); in the case-study phase until it is sent to the study → the follow-up; anything after
 * (sent, issued, handed over) or cancelled → done.
 * Edge cases: no task loaded → the first step.
 */
export function coordinationStep(task: WorkflowTask | null | undefined): number {
  if (!task) return 0;
  if (task.status === "cancelled") return COORDINATION_DONE_STEP;
  const byPhase =
    PHASE_STEP[
      task.phase === "obstruction"
        ? (task.obstructionPriorPhase ?? "enfath")
        : task.phase
    ];
  if (byPhase !== undefined) return byPhase;
  if (task.phase === "case-study" && task.transactionReceived !== true)
    return FOLLOW_UP_STEP;
  return COORDINATION_DONE_STEP;
}
