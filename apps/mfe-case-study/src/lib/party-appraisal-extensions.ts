import type { RefObject, ReactNode } from "react";
import type { PartyTaskPageDef } from "@platform/app-shared/prototype/party-task-pages";
import type { ActiveTransactionQueueConfig } from "../views/ActiveTransactionQueueView";
import type { PoPropertyIntake } from "./prototype/po-intake-data";
import type { WorkflowTask } from "./prototype/tasks-storage";

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

/** حقن من shell — قائمة المقيم ونموذج رفع التقييم يعتمدان على وحدة المُقيّم. */
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
  }) => ReactNode;
  isEvaluatorLocked: (taskId: string, saving: boolean) => boolean;
};
