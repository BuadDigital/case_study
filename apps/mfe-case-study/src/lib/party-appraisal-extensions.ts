import type { RefObject, ReactNode } from "react";
import type { PartyTaskPageDef } from "@platform/app-shared/app-data/party-task-pages";
import type { ActiveTransactionQueueConfig } from "../views/ActiveTransactionQueueView";
import type { PoPropertyIntake } from "./app-data/po-intake-data";
import type { WorkflowTask } from "./app-data/tasks-storage";

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
  patchQueueConfig: (
    base: ActiveTransactionQueueConfig,
    def: PartyTaskPageDef,
  ) => ActiveTransactionQueueConfig;
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
