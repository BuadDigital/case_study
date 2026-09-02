import type { RefObject, ReactNode } from "react";
import type { PartyTaskPageDef } from "@platform/app-shared/app-data/party-task-pages";
import type { ActiveTransactionQueueConfig } from "../views/ActiveTransactionQueueView";
import type { WorkflowTask } from "./app-data/tasks-storage";

export type PartyEngineeringSurveyWorkHostRef = {
  submit?: () => Promise<boolean>;
  onSubmitted?: () => void;
  onSavingChange?: (saving: boolean) => void;
};

/** Injected from shell — engineering-office queue and survey upload form. */
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
    onBack?: () => void;
    onFailureSubmitted?: () => void;
    variant?: "workspace" | "entry";
    forceReadOnly?: boolean;
  }) => ReactNode;
  isSurveyLocked: (taskId: string, saving: boolean) => boolean;
};
