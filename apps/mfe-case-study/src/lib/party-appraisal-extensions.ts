import type { RefObject, ReactNode } from "react";
import type { PartyTaskPageDef } from "@platform/app-shared/prototype/party-task-pages";
import type { ActiveTransactionQueueConfig } from "../views/ActiveTransactionQueueView";
import type { WorkflowTask } from "./prototype/tasks-storage";

export type PartyEvaluatorWorkHostRef = {
  submit?: () => Promise<boolean>;
  onSubmitted?: () => void;
  onSavingChange?: (saving: boolean) => void;
  focusEvaluatorNotes?: () => void;
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
  }) => ReactNode;
  isEvaluatorLocked: (taskId: string, saving: boolean) => boolean;
};
