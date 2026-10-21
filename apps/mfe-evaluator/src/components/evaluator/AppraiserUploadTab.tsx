"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PanelSkeleton } from "@platform/ui-kit";
import type { PartyTaskPageDef } from "@platform/app-shared/app-data/party-task-pages";
import { holderAppraisalTaskFor, type WorkflowTask } from "@platform/app-shared/workflow/task-types";
import { propertyAppraisalWorkspacePath } from "@platform/app-shared/domain/po-routes";
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
  const router = useRouter();
  const { data: tasks } = useWorkflowTasksQuery();
  const liveTask =
    tasks?.find((t) => t.id === childTask.id) ?? childTask;

  // Phase 5 (decision 2026-10-19): one valuation per transaction. A deed folded into another
  // deed's valuation opens the holder deed's appraisal workspace instead of its own.
  const holderTask = holderAppraisalTaskFor(liveTask, tasks ?? []);
  useEffect(() => {
    if (!holderTask) return;
    router.replace(propertyAppraisalWorkspacePath(holderTask.id));
  }, [holderTask, router]);
  if (holderTask) return <PanelSkeleton />;

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
