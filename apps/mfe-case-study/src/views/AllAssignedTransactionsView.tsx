"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { isPartyWorkflowRole } from "@platform/app-shared/app-data/party-task-pages";
import {
  PanelSkeleton,
  preloadableLazy,
  useToast,
  whenIdle,
} from "@platform/ui-kit";
import { CaseStudyTaskWork } from "./MyTaskWorkView";
import {
  ActiveTransactionQueueView,
  type ActiveTransactionQueueConfig,
} from "./ActiveTransactionQueueView";
import { filterOpenAssignedTransactions } from "../lib/app-data/assigned-transactions-filter";
import { isTaskOnSuspendedProperty } from "../lib/app-data/suspended-transactions-model";
import {
  reopenCompletedTransaction,
  type WorkflowTask,
} from "../lib/app-data/tasks";
import { useWorkflowTasksQuery } from "../query/case-study-queries";
import { useTransactionGeneralActions } from "../components/po-intake/useTransactionGeneralActions";
import { withTransactionGeneralItems } from "../lib/app-data/transaction-general-actions";
import {
  allTransactionsPath,
  allTransactionsTaskPath,
  decodeTaskParam,
  partyTaskWorkspacePath,
} from "../lib/my-task-routes";
import {
  allTransactionsPhaseLabel,
  buildAllTransactionsRowMoreItems,
  canReopenCompletedTransaction,
} from "../lib/app-data/all-transactions-queue";
import { canReopenCaseStudyReport } from "../lib/app-data/po-roles";
import { reopenCaseStudyReportDraft } from "../lib/app-data/case-study-report-commands";
import { caseStudyReopenSuccessMessage } from "../lib/app-data/case-study-report-issue-errors";
import {
  ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT,
  EVALUATOR_SUBMISSION_CHANGED_EVENT,
  FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
} from "@platform/app-shared/events/app-events";
// Row-menu reopen dialogs: code warmed on idle for the roles that may reopen, so
// the dialog opens on the click (preloadableLazy skips the suspense reveal delay).
const reopenCompletedModal = preloadableLazy(() =>
  import("../components/transactions/ReopenCompletedTransactionModal").then(
    (m) => m.ReopenCompletedTransactionModal,
  ),
);
const ReopenCompletedTransactionModal = reopenCompletedModal.Component;

const caseStudyReopenDialog = preloadableLazy(() =>
  import("../components/case-study/CaseStudyReportReopenDialog").then(
    (m) => m.CaseStudyReportReopenDialog,
  ),
);
const CaseStudyReportReopenDialog = caseStudyReopenDialog.Component;

const PARTY_QUEUE_REFRESH_EVENTS = [
  FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
  ENGINEERING_SURVEY_SUBMISSION_CHANGED_EVENT,
  EVALUATOR_SUBMISSION_CHANGED_EVENT,
];

function assignedListedTasks(tasks: WorkflowTask[]): WorkflowTask[] {
  return tasks.filter((task) => !isTaskOnSuspendedProperty(task));
}

export function AllAssignedTransactionsView() {
  const { role, access, viewerDisplayName } = useAppAccess();
  const router = useRouter();
  const searchParams = useSearchParams();
  const legacyTask = searchParams.get("task");
  const { data: tasks } = useWorkflowTasksQuery();
  const { showToast } = useToast();
  const [reopenTask, setReopenTask] = useState<WorkflowTask | null>(null);
  const [reopenDeedLabel, setReopenDeedLabel] = useState("");
  // «المعاملات النشطة» rows offer the general actions too (failure, final failure, cancellation).
  const { itemsFor: generalItemsFor, dialogs: generalDialogs } =
    useTransactionGeneralActions();

  const isPartyRole = isPartyWorkflowRole(role);

  const mayReopenReport = canReopenCaseStudyReport(access);
  const mayReopenCompleted = canReopenCompletedTransaction(role);
  useEffect(() => {
    if (!mayReopenReport && !mayReopenCompleted) return;
    return whenIdle(() => {
      if (mayReopenReport) void caseStudyReopenDialog.preload();
      if (mayReopenCompleted) void reopenCompletedModal.preload();
    });
  }, [mayReopenReport, mayReopenCompleted]);

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
      pageTitle: "المعاملات النشطة",
      hidePageTitle: true,
      tableLayout: "all-transactions",
      emptyLine: "لا توجد معاملات مطابقة.",
      emptyHint: isPartyRole
        ? "تظهر هنا المعاملات المسندة إليك — صف واحد لكل صك مع آخر مرحلة وصل إليها."
        : "تظهر هنا كل معاملة حية — صف واحد لكل صك: أين وصلت ومن تنتظر. المرفوعة على إنفاذ والملغاة لا تظهر؛ ابحث عنها من الشريط العلوي.",
      panelId: "all-assigned-transactions-panel",
      tableHint: "اضغط الصف للفتح أو الإغلاق.",
      partyAssignee: isPartyRole,
      assigneeRole: isPartyRole ? role : undefined,
      getBasePath: allTransactionsPath,
      getTaskPath: allTransactionsTaskPath,
      queueSort: "distributed-newest-first",
      includeAllStatuses: true,
      statusColumnLabel: "المرحلة",
      buildRowMoreItems: (ctx) => {
        const propId = ctx.propertyId ?? ctx.task.propertyId;
        const property = propId
          ? ctx.poByNumber
              .get(ctx.task.poNumber.trim())
              ?.properties.find((p) => p.id === propId)
          : undefined;
        const stageItems = buildAllTransactionsRowMoreItems({
          task: ctx.task,
          propertyId: ctx.propertyId,
          openTask: ctx.openTask,
          router: ctx.router,
          viewerRole: ctx.viewerRole,
          viewerAccess: ctx.viewerAccess,
          onReopenCompleted: () => {
            setReopenDeedLabel(property?.deedNumber?.trim() ?? "");
            setReopenTask(ctx.task);
          },
        });
        // Party roles keep their own menu; the staff get the general actions after it.
        return property && !isPartyRole
          ? withTransactionGeneralItems(
              stageItems,
              generalItemsFor({ poNumber: ctx.task.poNumber, property }),
            )
          : stageItems;
      },
      getTaskStatusBadge: (task) => {
        const label = allTransactionsPhaseLabel(task);
        const className =
          label === "مكتمل"
            ? "b-done"
            : label === "البورصة" || label === "تعذّر"
              ? "b-fail"
              : label === "البيانات الأولية"
                ? "b-new"
                : "b-prog";
        return { label, className };
      },
      // Party workspaces for latest-stage party tasks; case-study stays panel.
      resolveFullPageTaskPath: partyTaskWorkspacePath,
      refreshOnWindowEvents: isPartyRole
        ? PARTY_QUEUE_REFRESH_EVENTS
        : undefined,
      filterListed: (mine, poByNumber) =>
        filterOpenAssignedTransactions(
          assignedListedTasks(mine),
          poByNumber,
          role,
          viewerDisplayName,
        ),
    };
  }, [isPartyRole, role, viewerDisplayName, generalItemsFor]);

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
      {generalDialogs}
      <Suspense fallback={null}>
        {reopenTask !== null && reopenTask.kind === "case-study-property" ? (
          // A case-study parent reopens through its issued report (the server refuses the generic reopen).
          <CaseStudyReportReopenDialog
            open
            deedLabel={reopenDeedLabel}
            onClose={() => {
              setReopenTask(null);
              setReopenDeedLabel("");
            }}
            onReopen={async (reason, clearEnfazHandover) => {
              const result = await reopenCaseStudyReportDraft(
                reopenTask.id,
                reason,
                clearEnfazHandover,
              );
              if (!result.ok) return result;
              showToast(
                caseStudyReopenSuccessMessage(result.appraiserSubmitted),
                "success",
              );
              return { ok: true };
            }}
          />
        ) : null}
        {reopenTask !== null && reopenTask.kind !== "case-study-property" ? (
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
              const result = await reopenCompletedTransaction(
                reopenTask.id,
                reason,
              );
              if (!result.ok) {
                showToast(result.error, "error");
                return;
              }
              showToast("تمت إعادة فتح المعاملة", "success");
            }}
          />
        ) : null}
      </Suspense>
    </>
  );
}
