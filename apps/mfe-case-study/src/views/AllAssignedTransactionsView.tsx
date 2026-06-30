"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { isPartyWorkflowRole } from "@platform/app-shared/prototype/party-task-pages";
import { PanelSkeleton } from "@platform/design-system";
import { CaseStudyTaskWork } from "./MyTaskWorkView";
import {
  ActiveTransactionQueueView,
  type ActiveTransactionQueueConfig,
} from "./ActiveTransactionQueueView";
import { filterOpenAssignedTransactions } from "../lib/prototype/assigned-transactions-filter";
import { isTaskOnSuspendedProperty } from "../lib/prototype/suspended-transactions-storage";
import { taskPhaseLabel, taskStatusLabel, type WorkflowTask } from "../lib/prototype/tasks-storage";
import { ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT } from "../lib/case-study-engineering-survey-events";
import { EVALUATOR_SUBMISSION_CHANGED_EVENT } from "../lib/case-study-evaluator-events";
import { FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT } from "../lib/case-study-field-inspection-events";
import { GOVERNMENT_REVIEW_SUBMISSION_CHANGED_EVENT } from "../lib/prototype/government-review-work-storage";
import { VALUATION_COORDINATION_SUBMISSION_CHANGED_EVENT } from "../lib/prototype/valuation-coordination-work-storage";
import { useWorkflowTasksQuery } from "../query/case-study-queries";
import {
  allTransactionsPath,
  allTransactionsTaskPath,
  decodeTaskParam,
  partyTaskWorkspacePath,
} from "../lib/my-task-routes";

const PARTY_QUEUE_REFRESH_EVENTS = [
  FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
  ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT,
  EVALUATOR_SUBMISSION_CHANGED_EVENT,
  VALUATION_COORDINATION_SUBMISSION_CHANGED_EVENT,
  GOVERNMENT_REVIEW_SUBMISSION_CHANGED_EVENT,
];

function assignedListedTasks(tasks: WorkflowTask[]): WorkflowTask[] {
  return tasks.filter((task) => !isTaskOnSuspendedProperty(task));
}

export function AllAssignedTransactionsView() {
  const { role, viewerDisplayName } = usePrototype();
  const router = useRouter();
  const searchParams = useSearchParams();
  const legacyTask = searchParams.get("task");
  const { data: tasks } = useWorkflowTasksQuery();

  const isPartyRole = isPartyWorkflowRole(role);

  useEffect(() => {
    if (!legacyTask) return;
    const taskId = decodeTaskParam(legacyTask);
    const task = tasks?.find((t) => t.id === taskId);
    if (!task) return;
    const workspacePath = partyTaskWorkspacePath(task);
    if (workspacePath) router.replace(workspacePath);
  }, [legacyTask, router, tasks]);

  const redirectingPartyTask = useMemo(() => {
    if (!legacyTask || !tasks?.length) return false;
    const taskId = decodeTaskParam(legacyTask);
    const task = tasks.find((t) => t.id === taskId);
    return Boolean(task && partyTaskWorkspacePath(task));
  }, [legacyTask, tasks]);

  const config = useMemo((): ActiveTransactionQueueConfig => {
    return {
      pageId: "all-transactions",
      pageTitle: "جميع المعاملات",
      hidePageTitle: true,
      emptyLine: "لا توجد معاملات مسندة إليك.",
      emptyHint: isPartyRole
        ? "تظهر هنا جميع المعاملات المسندة إليك من توزيع المعاملات — المفتوحة والمكتملة."
        : "تظهر هنا جميع المعاملات المسندة لك في كل المراحل — البيانات الأولية، البورصة، التوزيع، ودراسة الحالة — المفتوحة والمكتملة.",
      panelId: "all-assigned-transactions-panel",
      tableHint: isPartyRole
        ? "اضغط الصف لفتح المعاملة في صفحتها المخصصة."
        : "اضغط الصف لفتح المعاملة في مرحلتها الحالية — اضغط نفس الصف مرة أخرى للإغلاق.",
      partyAssignee: isPartyRole,
      assigneeRole: isPartyRole ? role : undefined,
      getBasePath: allTransactionsPath,
      getTaskPath: allTransactionsTaskPath,
      queueSort: "newest-first",
      includeAllStatuses: true,
      statusColumnLabel: isPartyRole ? "الحالة" : "المرحلة",
      getTaskStatusBadge: (task) => {
        if (task.status === "completed") {
          return {
            label: taskStatusLabel(task.status),
            className: "b-done",
          };
        }
        if (task.kind === "case-study-property") {
          return {
            label: taskPhaseLabel(task.phase),
            className: "b-prog",
          };
        }
        return null;
      },
      resolveFullPageTaskPath: isPartyRole ? partyTaskWorkspacePath : undefined,
      refreshOnWindowEvents: isPartyRole ? PARTY_QUEUE_REFRESH_EVENTS : undefined,
      filterListed: (mine, poByNumber) =>
        filterOpenAssignedTransactions(
          assignedListedTasks(mine),
          poByNumber,
          role,
          viewerDisplayName,
        ),
    };
  }, [isPartyRole, role, viewerDisplayName]);

  if (redirectingPartyTask) {
    return <PanelSkeleton className="p-4" />;
  }

  return (
    <ActiveTransactionQueueView
      config={config}
      renderPanel={
        isPartyRole
          ? undefined
          : ({ task, onRefresh, onClose }) => (
              <CaseStudyTaskWork
                key={task.id}
                task={task}
                onRefresh={onRefresh}
                layout="panel"
                onClose={onClose}
              />
            )
      }
    />
  );
}
