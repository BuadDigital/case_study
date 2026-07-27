"use client";

import type { PartyTaskPageDef } from "@platform/app-shared/prototype/party-task-pages";
import type { WorkflowTask } from "@case-study/mfe";
import { EvaluatorWindow } from "./EvaluatorWindow";
import type { EvaluatorWindowHostRefObject } from "../../lib/evaluator/evaluator-window-host";
import type { EvaluatorPropertySummary } from "./EvaluatorPropertyTab";
import { useWorkflowTasksQuery } from "../../query/evaluator-queries";

export function AppraiserUploadTab({
  def: _def,
  childTask,
  hostRef,
  propertySummary,
  deedLabel,
  onBack,
}: {
  def: PartyTaskPageDef;
  childTask: WorkflowTask;
  hostRef: EvaluatorWindowHostRefObject;
  propertySummary?: EvaluatorPropertySummary;
  deedLabel?: string;
  onBack?: () => void;
}) {
  const { data: tasks } = useWorkflowTasksQuery();

  return (
    <EvaluatorWindow
      task={childTask}
      tasks={tasks ?? []}
      hostRef={hostRef}
      propertySummary={propertySummary}
      deedLabel={deedLabel}
      onBack={onBack}
    />
  );
}
