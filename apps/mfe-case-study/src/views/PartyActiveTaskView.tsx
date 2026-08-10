"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PanelSkeleton } from "@platform/design-system";
import { ActiveTransactionQueueView, type ActiveTransactionQueueConfig } from "./ActiveTransactionQueueView";
import { PartyActiveTaskWorkPanel } from "./PartyActiveTaskWorkPanel";
import { filterTasksForPartyKind } from "@platform/app-shared/prototype/party-task-pages";
import {
  partyTaskPageDef,
  type PartyTaskPageDef,
} from "@platform/app-shared/prototype/party-task-pages";
import {
  activeSurveyWorkspacePath,
  decodeTaskParam,
  partyTaskPath,
  partyTaskTaskPath,
  propertyAppraisalWorkspacePath,
  fieldInspectionWorkspacePath,
} from "../lib/my-task-routes";
import type { PageId } from "@platform/types";
import type { PoIntakeRecord } from "../lib/prototype/po-intake-data";
import type { WorkflowTask } from "../lib/prototype/tasks-storage";
import type { PartyAppraisalExtensions } from "../lib/party-appraisal-extensions";
import type { PartyEngineeringSurveyExtensions } from "../lib/party-engineering-survey-extensions";
import {
  FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
} from "../lib/case-study-field-inspection-events";
import { fieldInspectionTaskStatusBadge } from "../lib/prototype/field-inspection-work-queue";

function queueConfig(
  def: PartyTaskPageDef,
  appraisalExtensions?: PartyAppraisalExtensions,
  engineeringSurveyExtensions?: PartyEngineeringSurveyExtensions,
): ActiveTransactionQueueConfig {
  const baseFilter = (
    mine: WorkflowTask[],
    poByNumber: Map<string, PoIntakeRecord>,
  ) => filterTasksForPartyKind(mine, def.kind);

  const base: ActiveTransactionQueueConfig = {
    pageId: def.pageId,
    pageTitle: def.pageTitle,
    emptyLine: def.emptyLine,
    emptyHint: def.emptyHint,
    panelId: `${def.pageId}-panel`,
    tableHint: def.tableHint,
    partyAssignee: true,
    assigneeRole: def.roleId,
    queueSort: "distributed-newest-first",
    getBasePath: () => partyTaskPath(def.pageId),
    getTaskPath: (taskId) => partyTaskTaskPath(def.pageId, taskId),
    filterListed: baseFilter,
  };

  if (def.kind === "property-appraisal" && appraisalExtensions) {
    return appraisalExtensions.patchQueueConfig(base, def);
  }

  if (def.kind === "engineering-survey" && engineeringSurveyExtensions) {
    return engineeringSurveyExtensions.patchQueueConfig(base, def);
  }

  if (def.kind === "field-inspection") {
    return {
      ...base,
      hidePageTitle: true,
      tableHint: "اضغط الصف لفتح نموذج المعاينة في صفحة مستقلة.",
      fullPageTaskPath: (taskId) =>
        fieldInspectionWorkspacePath(def.pageId, taskId),
      statusColumnLabel: "الحالة",
      getTaskStatusBadge: (task) =>
        fieldInspectionTaskStatusBadge(task.id, task.status),
      refreshOnWindowEvents: [FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT],
    };
  }

  return base;
}

export function PartyActiveTaskView({
  pageId,
  appraisalExtensions,
  engineeringSurveyExtensions,
}: {
  pageId: PageId;
  appraisalExtensions?: PartyAppraisalExtensions;
  engineeringSurveyExtensions?: PartyEngineeringSurveyExtensions;
}) {
  return (
    <PartyActiveTaskViewBody
      pageId={pageId}
      appraisalExtensions={appraisalExtensions}
      engineeringSurveyExtensions={engineeringSurveyExtensions}
    />
  );
}

function PartyActiveTaskViewBody({
  pageId,
  appraisalExtensions,
  engineeringSurveyExtensions,
}: {
  pageId: PageId;
  appraisalExtensions?: PartyAppraisalExtensions;
  engineeringSurveyExtensions?: PartyEngineeringSurveyExtensions;
}) {
  const def = partyTaskPageDef(pageId);
  const router = useRouter();
  const searchParams = useSearchParams();
  const legacyTask = searchParams.get("task");

  useEffect(() => {
    if (!legacyTask) return;
    const taskId = decodeTaskParam(legacyTask);
    if (def?.kind === "engineering-survey") {
      router.replace(activeSurveyWorkspacePath(taskId));
      return;
    }
    if (def?.kind === "property-appraisal") {
      router.replace(propertyAppraisalWorkspacePath(taskId));
      return;
    }
    if (def?.kind === "field-inspection") {
      router.replace(fieldInspectionWorkspacePath(def.pageId, taskId));
    }
  }, [def?.kind, def?.pageId, legacyTask, router]);

  if (def?.kind === "engineering-survey" && legacyTask) {
    return <PanelSkeleton className="p-4" />;
  }

  if (def?.kind === "property-appraisal" && legacyTask) {
    return <PanelSkeleton className="p-4" />;
  }

  if (def?.kind === "field-inspection" && legacyTask) {
    return <PanelSkeleton className="p-4" />;
  }

  if (!def) {
    return (
      <p className="p-4 text-xs text-text-3">صفحة المهمة غير معرّفة.</p>
    );
  }

  const config = queueConfig(
    def,
    appraisalExtensions,
    engineeringSurveyExtensions,
  );

  const useFullPage = Boolean(config.fullPageTaskPath);

  return (
    <ActiveTransactionQueueView
      config={config}
      renderPanel={
        useFullPage
          ? undefined
          : ({ task, onRefresh, onClose }) => (
              <PartyActiveTaskWorkPanel
                key={task.id}
                def={def}
                task={task}
                onRefreshAction={onRefresh}
                layout="panel"
                onCloseAction={onClose}
                appraisalExtensions={appraisalExtensions}
                engineeringSurveyExtensions={engineeringSurveyExtensions}
              />
            )
      }
    />
  );
}
