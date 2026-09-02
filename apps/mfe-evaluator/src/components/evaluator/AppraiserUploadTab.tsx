"use client";

import type { PartyTaskPageDef } from "@platform/app-shared/app-data/party-task-pages";
import type { WorkflowTask } from "@platform/app-shared/workflow/task-types";
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
  embeddedInPropertyChrome,
}: {
  def: PartyTaskPageDef;
  childTask: WorkflowTask;
  hostRef: EvaluatorWindowHostRefObject;
  propertySummary?: EvaluatorPropertySummary;
  deedLabel?: string;
  onBack?: () => void;
  embeddedInPropertyChrome?: boolean;
}) {
  const { data: tasks } = useWorkflowTasksQuery();
  const liveTask =
    tasks?.find((t) => t.id === childTask.id) ?? childTask;

  return (
    <EvaluatorWindow
      task={liveTask}
      tasks={tasks ?? []}
      hostRef={hostRef}
      propertySummary={propertySummary}
      deedLabel={deedLabel}
      onBack={onBack}
      embeddedInPropertyChrome={embeddedInPropertyChrome}
    />
  );
}
