/**
 * Injected appraisal extensions — implemented by `@evaluator/mfe`, consumed by
 * `@case-study/mfe` without a hard package dependency either way for this type.
 */

import type { RefObject, ReactNode } from "react";
import type { PartyTaskPageDef } from "../app-data/party-task-pages";
import type { PoPropertyIntake } from "../app-data/po-intake-property-model";
import type { WorkflowTask } from "../workflow/task-types";

export type PartyEvaluatorWorkHostRef = {
  submit?: () => Promise<boolean>;
  onSubmitted?: () => void;
  onSavingChange?: (saving: boolean) => void;
  focusEvaluatorNotes?: () => void;
};

export type PartyAppraisalPropertySummary = {
  deedNumber: string;
  poNumber: string;
  classification: string;
  cityDistrict: string;
  assignedAt: string;
  inspectionDone: boolean;
  property?: PoPropertyIntake | null;
  showDecree?: boolean;
  surveyTaskId?: string | null;
  inspectionTaskId?: string | null;
  appraisalTaskId?: string | null;
};

/** Injected from shell — appraiser menu and valuation upload form depend on the evaluator module. */
export type PartyAppraisalExtensions = {
  /** Queue config is owned by case-study; keep the shape opaque to avoid a package cycle. */
  patchQueueConfig: <T>(base: T, def: PartyTaskPageDef) => T;
  renderAppraisalWork: (props: {
    def: PartyTaskPageDef;
    childTask: WorkflowTask;
    hostRef: RefObject<PartyEvaluatorWorkHostRef | null>;
    propertySummary?: PartyAppraisalPropertySummary;
    deedLabel?: string;
    onBack?: () => void;
    /** Same property chrome as the case-study specialist (hero; without the timeline column). */
    embeddedInPropertyChrome?: boolean;
  }) => ReactNode;
  isEvaluatorLocked: (taskId: string, saving: boolean) => boolean;
};
