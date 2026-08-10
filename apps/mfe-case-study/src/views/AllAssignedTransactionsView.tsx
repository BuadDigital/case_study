"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { isPartyWorkflowRole } from "@platform/app-shared/prototype/party-task-pages";
import { PanelSkeleton, useToast } from "@platform/design-system";
import { CaseStudyTaskWork } from "./MyTaskWorkView";
import {
  ActiveTransactionQueueView,
  type ActiveTransactionQueueConfig,
} from "./ActiveTransactionQueueView";
import { filterOpenAssignedTransactions } from "../lib/prototype/assigned-transactions-filter";
import { isTaskOnSuspendedProperty } from "../lib/prototype/suspended-transactions-storage";
import {
  reopenCompletedTransaction,
  type WorkflowTask,
} from "../lib/prototype/tasks-storage";
import { ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT } from "../lib/case-study-engineering-survey-events";
import { EVALUATOR_SUBMISSION_CHANGED_EVENT } from "../lib/case-study-evaluator-events";
import { FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT } from "../lib/case-study-field-inspection-events";
import { useWorkflowTasksQuery } from "../query/case-study-queries";
import {
  allTransactionsPath,
  allTransactionsTaskPath,
  decodeTaskParam,
  partyTaskWorkspacePath,
} from "../lib/my-task-routes";
import {
  allTransactionsPhaseLabel,
  buildAllTransactionsRowMoreItems,
} from "../lib/prototype/all-transactions-queue";
import { ReopenCompletedTransactionModal } from "../components/transactions/ReopenCompletedTransactionModal";

const PARTY_QUEUE_REFRESH_EVENTS = [
  FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
  ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT,
  EVALUATOR_SUBMISSION_CHANGED_EVENT,
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
  const { showToast } = useToast();
  const [reopenTask, setReopenTask] = useState<WorkflowTask | null>(null);
  const [reopenDeedLabel, setReopenDeedLabel] = useState("");

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
      tableLayout: "all-transactions",
      emptyLine: "لا توجد معاملات مطابقة.",
      emptyHint: isPartyRole
        ? "تظهر هنا المعاملات المسندة إليك — صف واحد لكل صك مع آخر مرحلة وصل إليها."
        : "تظهر هنا المعاملات المسندة لك — صف واحد لكل صك مع آخر مرحلة وصل إليها (البيانات الأولية حتى الإكمال).",
      panelId: "all-assigned-transactions-panel",
      tableHint:
        "اضغط الصف لفتح المعاملة في مرحلتها الحالية — اضغط نفس الصف مرة أخرى للإغلاق.",
      partyAssignee: isPartyRole,
      assigneeRole: isPartyRole ? role : undefined,
      getBasePath: allTransactionsPath,
      getTaskPath: allTransactionsTaskPath,
      queueSort: "distributed-newest-first",
      includeAllStatuses: true,
      statusColumnLabel: "المرحلة",
      buildRowMoreItems: (ctx) =>
        buildAllTransactionsRowMoreItems({
          task: ctx.task,
          propertyId: ctx.propertyId,
          openTask: ctx.openTask,
          router: ctx.router,
          viewerRole: ctx.viewerRole,
          onReopenCompleted: () => {
            const record = ctx.poByNumber.get(ctx.task.poNumber.trim());
            const propId = ctx.propertyId ?? ctx.task.propertyId;
            const prop = propId
              ? record?.properties.find((p) => p.id === propId)
              : undefined;
            setReopenDeedLabel(prop?.deedNumber?.trim() ?? "");
            setReopenTask(ctx.task);
          },
        }),
      getTaskStatusBadge: (task) => {
        const label = allTransactionsPhaseLabel(task);
        const className =
          label === "مكتمل"
            ? "b-done"
            : label === "البورصة" || label === "تعذر"
              ? "b-fail"
              : label === "البيانات الأولية"
                ? "b-new"
                : "b-prog";
        return { label, className };
      },
      // Party workspaces for latest-stage party tasks; case-study stays panel.
      resolveFullPageTaskPath: partyTaskWorkspacePath,
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
    <>
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
      <ReopenCompletedTransactionModal
        open={reopenTask !== null}
        task={reopenTask}
        deedLabel={reopenDeedLabel}
        onClose={() => {
          setReopenTask(null);
          setReopenDeedLabel("");
        }}
        onConfirm={async (reason) => {
          if (!reopenTask) return;
          const result = await reopenCompletedTransaction(reopenTask.id, reason);
          if (!result.ok) {
            showToast(result.error, "error");
            return;
          }
          showToast("تمت إعادة فتح المعاملة", "success");
        }}
      />
    </>
  );
}
