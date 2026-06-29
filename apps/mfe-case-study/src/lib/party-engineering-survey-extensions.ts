import type { RefObject, ReactNode } from "react";
import type { PartyTaskPageDef } from "@platform/app-shared/prototype/party-task-pages";
import type { ActiveTransactionQueueConfig } from "../views/ActiveTransactionQueueView";
import type { WorkflowTask } from "./prototype/tasks-storage";

export type PartyEngineeringSurveyWorkHostRef = {
  submit?: () => Promise<boolean>;
  onSubmitted?: () => void;
  onSavingChange?: (saving: boolean) => void;
};

/** حقن من shell — قائمة المكتب الهندسي ونموذج الرفع المساحي. */
export type PartyEngineeringSurveyExtensions = {
  patchQueueConfig: (
    base: ActiveTransactionQueueConfig,
    def: PartyTaskPageDef,
  ) => ActiveTransactionQueueConfig;
  renderSurveyWork: (props: {
    def: PartyTaskPageDef;
    childTask: WorkflowTask;
    hostRef: RefObject<PartyEngineeringSurveyWorkHostRef | null>;
    deedNumber: string;
    onFailureSubmitted?: () => void;
    variant?: "workspace" | "entry";
  }) => ReactNode;
  isSurveyLocked: (taskId: string, saving: boolean) => boolean;
};
