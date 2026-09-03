"use client";

import { useMemo } from "react";
import {
  AppModal,
  cn,
  KpiBand,
  KpiCell,
  MobileKpiStatCards,
  Note,
  OperationalPanel,
  OperationalToolbarPrimaryButton,
  OperationalToolbarSearch,
  OperationalToolbarSelect,
  PageShell,
  PanelSkeleton,
  Spinner,
  StatusPill,
  Table,
  TableEmptyRow,
  TableFrame,
  TBody,
  Th,
  ThAction,
  THead,
  Tr,
} from "@platform/ui-kit";
import { displayPersonName } from "@platform/app-shared/app-data/person-display-name";
import {
  OPERATIONS_TASK_PRIORITY_COLORS,
  OPERATIONS_TASK_REMIND_LABELS,
  OPERATIONS_TASK_SCOPE_LABELS,
  OPERATIONS_TASK_STATUS_COLORS,
  OPERATIONS_TASK_STATUS_LABELS,
  formatTaskDueLabel,
  operationsTaskLinkLabel,
  operationsTaskPriorityLabel,
  operationsTaskReceiptLabel,
  operationsTaskScopeLabel,
  operationsTaskStatusLabel,
  operationsTaskTypeLabel,
  printOperationsTaskDelegationLetter,
  taskCountdown,
} from "../lib/app-data/operations-task-display";
import { resolveSlaTimerRatio } from "../lib/app-data/my-task-row";
import { GOVERNMENT_REVIEWER_FAILURE_RAISER } from "@failures/mfe/lib/failure-party-roles";
const FailureRaiseModal = dynamic(
  () =>
    import("../components/failures/FailureRaiseModal").then(
      (m) => m.FailureRaiseModal,
    ),
  { ssr: false },
);
import { agentInfoFromStaff } from "../lib/app-data/internal-delegation-letters";
import { OperationsTaskRow } from "./OperationsTaskRow";
import {
  ActiveQueueMobileCards,
  type ActiveQueueMobileCardItem,
} from "@platform/app-shared/components/ActiveQueueMobileCards";
import dynamic from "next/dynamic";

// Modal is ~934 lines and only shown on demand — do not mount it in the screen chunk (bundle-dynamic-imports).
const CreateOperationsTaskModal = dynamic(
  () =>
    import("../components/CreateOperationsTaskModal").then(
      (m) => m.CreateOperationsTaskModal,
    ),
  { ssr: false },
);
// Prefetch on hover of the create button — hides chunk fetch latency (bundle-preload).
const preloadCreateOperationsTaskModal = () =>
  void import("../components/CreateOperationsTaskModal");
import {
  TASKS_LIST_FOOTER,
  TasksKpiActiveIcon,
  TasksKpiCompletedIcon,
  TasksKpiCreatedIcon,
  TasksKpiInProgressIcon,
  TasksSectionNote,
  TasksShowAllEye,
  tasksDescClassName,
} from "../components/tasks/TasksHtmlPrimitives";
const ReassignOperationsTaskModal = dynamic(
  () =>
    import("../components/tasks/ReassignOperationsTaskModal").then(
      (m) => m.ReassignOperationsTaskModal,
    ),
  { ssr: false },
);
import {
  opsAttachBtn,
  opsBulk,
  opsBulkClear,
  opsBtnGhost,
  opsBtnPrimary,
  opsCdDot,
  opsCdTip,
  opsCdWrap,
  opsCmt,
  opsCmtAv,
  opsCmtBar,
  opsCmtBody,
  opsCmtComposer,
  opsCmtFiles,
  opsCmtH,
  opsCmtName,
  opsCmtRole,
  opsCmtText,
  opsCmtTextarea,
  opsCmtThread,
  opsCmtTime,
  opsCmtEvent,
  opsDueCd,
  opsDueCdOver,
  opsDotSep,
  opsFileSize,
  opsBulkCount,
  opsListCount,
  opsEventAv,
  opsFileChip,
  opsFileChipFx,
  opsFilters,
  opsHeadRow,
  opsIconBoxGold,
  opsLetterBodyPad,
  opsLetterCard,
  opsLetterHead,
  opsLetterMeta,
  opsLetterSub,
  opsLetterTitle,
  opsMutedHint,
  opsPpBadge,
  opsPpCell,
  opsPpCellK,
  opsPpCellV,
  opsPpHead,
  opsPpMeta,
  opsPpSummary,
  opsPpTitle,
  opsReceiptConfirmBtn,
  opsReceiptConfirmWrap,
  opsRemindBtn,
  opsRemindCard,
  opsShowAllBtn,
  opsShowAllBtnOn,
  opsStep,
  opsStepDot,
  opsStepDotActive,
  opsStepDotCancel,
  opsStepDotDone,
  opsStepDotIdle,
  opsStepFlow,
  opsStepLbl,
  opsStepLblOn,
  opsStepLine,
  opsStepLineOn,
  opsCheckInput,
  opsToolbar,
  opsTfActions,
  opsTfChip,
  opsTfLbl,
  opsTfSeg,
  opsTfSegActive,
  opsTfSegRow,
} from "../lib/app-data/ops-tasks-tw";
import {
  TypeIcon,
  BellIcon,
  CloseTaskModalBody,
  PauseModalBody,
  PriorityModalBody,
  PlusIcon,
  assigneeRoleLabel,
  TaskStatusPill,
  TaskStepper,
  TickingRemindCountdown,
  CommentThread,
  LetterTable,
} from "./OperationsTasksViewParts";
import {
  isActiveOperationsTask,
  isTerminalOperationsTask,
} from "../lib/app-data/operations-tasks-model";
import { useOperationsTasksWorkflow } from "./useOperationsTasksWorkflow";

export function OperationsTasksView() {
  const {
    afterGovFailureRaised,
    allVisibleActiveChecked,
    applyPrioDueFromOffset,
    applyPriority,
    bulkRemind,
    bulkReminding,
    busy,
    canCreate,
    canRemind,
    cancelReason,
    closeFileInputRef,
    closeFiles,
    closeFormError,
    closeOpen,
    closeOutcome,
    closeText,
    commentFileInputRef,
    commentFiles,
    commentText,
    confirmCloseTask,
    confirmPauseTask,
    courtContacts,
    courtKind,
    courtOtherText,
    courtPerDeed,
    courtStatement,
    createOpen,
    createPrefill,
    creditAssigneeId,
    creditAssignees,
    detail,
    error,
    govFailureTarget,
    isAssignee,
    isDesktopViewport,
    isFetched,
    isFetching,
    kpis,
    now,
    openCloseModal,
    openGovFailureRaise,
    openKeysRegisterFromTask,
    openPauseModal,
    openPriorityModal,
    openReassign,
    openTask,
    openTaskDetail,
    pauseError,
    pauseOpen,
    pauseReason,
    poRecords,
    prioDueDate,
    prioDueTime,
    prioEditDue,
    prioOpen,
    prioValue,
    reassignAssigneeId,
    reassignAssignees,
    reassignDueDate,
    reassignDueTime,
    reassignError,
    reassignOpen,
    reassignReason,
    reassignTask,
    reassigning,
    refetch,
    remindTask,
    reviewerStaff,
    rowMenu,
    runStatus,
    scopeFilter,
    search,
    selAllRef,
    selectedCount,
    selectedId,
    sendComment,
    selectedIds,
    setBusy,
    setCancelReason,
    setCloseFiles,
    setCloseOpen,
    setCloseOutcome,
    setCloseText,
    setCommentFiles,
    setCommentText,
    setCourtContacts,
    setCourtKind,
    setCourtOtherText,
    setCourtPerDeed,
    setCourtStatement,
    setCreateOpen,
    setCreatePrefill,
    setCreditAssigneeId,
    setCreditAssigneeName,
    setDetailId,
    setError,
    setGovFailureTarget,
    setPauseOpen,
    setPauseReason,
    setPrioDueDate,
    setPrioDueTime,
    setPrioEditDue,
    setPrioOpen,
    setPrioValue,
    setReassignAssigneeId,
    setReassignAssigneeName,
    setReassignDueDate,
    setReassignDueTime,
    setReassignOpen,
    setReassignReason,
    setScopeFilter,
    setSearch,
    setSelectedId,
    setSelectedIds,
    setShowAll,
    setStatusFilter,
    showAll,
    showAllEyeBlink,
    showCreditPicker,
    showGovFailureRaise,
    staffLoadError,
    staffLoading,
    staffUsers,
    statusFilter,
    submitReassign,
    tasks,
    toggleShowAll,
    toggleTaskSelected,
    useIndependentQueue,
    visibleTasks,
  } = useOperationsTasksWorkflow();

  const mobileCardItems = useMemo((): ActiveQueueMobileCardItem[] => {
    if (isDesktopViewport === true) return [];
    return visibleTasks.map((task) => {
      const cd = taskCountdown(task.dueAt, task.status, now);
      const active = isActiveOperationsTask(task);
      const tone: ActiveQueueMobileCardItem["tone"] =
        task.status === "completed" || task.status === "cancelled"
          ? "done"
          : task.priority === "urgent" || task.priority === "high" || cd.over
            ? "returned"
            : task.status === "in_progress" || task.status === "paused"
              ? "pending"
              : "new";
      const statusColor =
        OPERATIONS_TASK_STATUS_COLORS[task.status] ?? "var(--ink)";
      const link = operationsTaskLinkLabel(task);
      const scope = operationsTaskScopeLabel(task.scope);
      const assignee = (task.assigneeName || task.assigneeId || "").trim();
      return {
        id: task.id,
        title: task.title,
        meta: [
          { text: task.displayId, kind: "po" as const },
          { text: operationsTaskTypeLabel(task.type), kind: "type" as const },
          assignee
            ? { text: assignee, kind: "place" as const }
            : link && link !== "—"
              ? { text: link, kind: "plain" as const }
              : { text: scope, kind: "plain" as const },
        ],
        statusLabel: operationsTaskStatusLabel(task.status),
        statusStyle: { base: statusColor, fg: statusColor },
        tone,
        timerLabel: active
          ? cd.over
            ? "متأخرة"
            : cd.txt !== "—" && cd.txt !== "متوقفة"
              ? cd.txt
              : undefined
          : undefined,
        timerTick: active
          ? (nowMs: number) => {
              const t = taskCountdown(task.dueAt, task.status, nowMs);
              if (t.txt === "—" || t.txt === "متوقفة") return null;
              return { label: t.over ? "متأخرة" : t.txt, overdue: t.over };
            }
          : undefined,
        timerOverdue: active ? cd.over : undefined,
        timerRatio: active
          ? resolveSlaTimerRatio(task.dueAt, task.createdAt ?? "", new Date(now))
          : undefined,
        moreItems: rowMenu(task),
        onOpen: () => {
          setSelectedId(task.id);
          setDetailId(task.id);
        },
        leading: active ? (
          <input
            type="checkbox"
            className={opsCheckInput}
            checked={Boolean(selectedIds[task.id])}
            onChange={(e) => {
              const on = e.target.checked;
              setSelectedIds((prev) => {
                const next = { ...prev };
                if (on) next[task.id] = true;
                else delete next[task.id];
                return next;
              });
            }}
            aria-label="تحديد المهمة"
          />
        ) : undefined,
      };
    });
  }, [isDesktopViewport, visibleTasks, now, rowMenu, selectedIds]);

  if (!isFetched && isFetching) {
    return <PanelSkeleton className="p-4" />;
  }

  if (detail) {
    const overdue =
      !isTerminalOperationsTask(detail) &&
      new Date(detail.dueAt).getTime() < now &&
      detail.status !== "paused";
    const prColor = OPERATIONS_TASK_PRIORITY_COLORS[detail.priority] ?? "#8a8d96";
    const nSent = detail.reminders?.length ?? 0;
    const linkChip =
      detail.scope === "general"
        ? "غير مرتبطة — مهمة مستقلة"
        : `${operationsTaskScopeLabel(detail.scope)} · ${operationsTaskLinkLabel(detail)}`;

    return (
      <PageShell
        variant="canvas"
        className="gap-0 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6"
      >
        {error ? <Note tone="danger">{error}</Note> : null}

        <div className={opsPpHead}>
          <h1 className={opsPpTitle}>
            <span className="inline-flex items-center gap-[9px]">
              <span className={opsIconBoxGold}>
                <TypeIcon type={detail.type} size={20} />
              </span>
              {detail.title}
            </span>
          </h1>
          <div className={opsPpMeta}>
            <span className={opsPpBadge}>{operationsTaskTypeLabel(detail.type)}</span>
            <span className={opsDotSep}>·</span>
            <TaskStatusPill status={detail.status} />
            <span className={opsDotSep}>·</span>
            <span dir="ltr">{detail.displayId}</span>
            {detail.reference ? (
              <>
                <span className={opsDotSep}>·</span>
                <span>خطاب {detail.reference}</span>
              </>
            ) : null}
          </div>
          <div className="mt-4">
            <TaskStepper status={detail.status} />
          </div>
          <div className={opsPpSummary}>
            <div className={opsPpCell}>
              <div className={opsPpCellK}>المنفّذ</div>
              <div className={opsPpCellV}>
                {detail.assigneeName || detail.assigneeId} —{" "}
                {assigneeRoleLabel(staffUsers, detail.assigneeId)}
              </div>
            </div>
            <div className={opsPpCell}>
              <div className={opsPpCellK}>المنشئ</div>
              <div className={opsPpCellV}>
                {displayPersonName(detail.createdByName, {
                  userId: detail.createdBy,
                  staffUsers,
                  fallback: "—",
                })}
              </div>
            </div>
            <div className={opsPpCell}>
              <div className={opsPpCellK}>النطاق / الربط</div>
              <div className={opsPpCellV}>{linkChip}</div>
            </div>
            <div className={opsPpCell}>
              <div className={opsPpCellK}>الأولوية</div>
              <div className={opsPpCellV}>
                <StatusPill
                  label={operationsTaskPriorityLabel(detail.priority)}
                  style={{ base: prColor, fg: prColor }}
                />
              </div>
            </div>
            <div className={opsPpCell}>
              <div className={opsPpCellK}>تاريخ الإنشاء</div>
              <div className={opsPpCellV}>{formatTaskDueLabel(detail.createdAt)}</div>
            </div>
            <div className={opsPpCell}>
              <div className={opsPpCellK}>موعد الاستحقاق</div>
              <div className={opsPpCellV} style={overdue ? { color: "#d9694f" } : undefined}>
                {overdue ? "متأخرة · " : ""}
                {formatTaskDueLabel(detail.dueAt)}
              </div>
            </div>
            {(() => {
              const receipt = operationsTaskReceiptLabel(detail);
              const canConfirmReceipt =
                detail.status === "created" && isAssignee;
              if (receipt === null && isTerminalOperationsTask(detail)) {
                return null;
              }
              if (canConfirmReceipt) {
                return (
                  <div className={opsReceiptConfirmWrap}>
                    <button
                      type="button"
                      className={opsReceiptConfirmBtn}
                      disabled={busy}
                      aria-busy={busy || undefined}
                      aria-label="تأكيد الاستلام"
                      onClick={() => void runStatus(detail.id, "in_progress")}
                    >
                      {busy ? <Spinner /> : null}
                      <span>
                        {busy ? "جاري التأكيد…" : "✓ تأكيد الاستلام"}
                      </span>
                    </button>
                  </div>
                );
              }
              if (!receipt) return null;
              return (
                <div
                  className={cn(
                    opsPpCell,
                    "max-lg:col-span-2 lg:ms-auto lg:border-s-0 lg:pe-0",
                  )}
                >
                  <div
                    className={opsPpCellV}
                    style={
                      receipt === "مؤكَّد" ? undefined : { color: "#b8860b" }
                    }
                  >
                    {receipt === "مؤكَّد" ? "✓ مؤكَّد" : receipt}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {detail.description ? (
          <div className={tasksDescClassName("plain")}>{detail.description}</div>
        ) : null}

        {isActiveOperationsTask(detail) ? (
          <div className={opsRemindCard}>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[10px] bg-[color-mix(in_srgb,var(--gold)_18%,transparent)] text-gold-d">
                <BellIcon size={19} />
              </span>
              <div className="min-w-0">
                <div className={opsLetterTitle}>التذكير التلقائي</div>
                <div className="mt-0.5 text-xs text-text-2">
                  أولوية{" "}
                  <b style={{ color: prColor }}>
                    {operationsTaskPriorityLabel(detail.priority)}
                  </b>{" "}
                  ·{" "}
                  {OPERATIONS_TASK_REMIND_LABELS[detail.priority] ??
                    OPERATIONS_TASK_REMIND_LABELS.medium}{" "}
                  — التذكير القادم خلال{" "}
                  <span className="font-bold text-heading" dir="ltr">
                    <TickingRemindCountdown task={detail} />
                  </span>
                  {nSent ? ` · أُرسل ${nSent} تذكير` : ""}
                </div>
              </div>
            </div>
            {canRemind || showGovFailureRaise ? (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 max-lg:w-full max-lg:flex-col max-lg:items-stretch">
                {canRemind ? (
                  <button
                    type="button"
                    className={opsRemindBtn}
                    disabled={busy}
                    aria-busy={busy || undefined}
                    onClick={() => void remindTask(detail)}
                  >
                    {busy ? <Spinner /> : <BellIcon size={15} />}
                    <span>{busy ? "جاري التذكير…" : "تذكير الآن"}</span>
                  </button>
                ) : null}
                {showGovFailureRaise ? (
                  <button
                    type="button"
                    className={cn(
                      opsBtnGhost,
                      "max-lg:min-h-11 max-lg:w-full max-lg:justify-center",
                    )}
                    disabled={busy}
                    onClick={openGovFailureRaise}
                  >
                    تعذر
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {detail.type === "court_visit" ? (
          <div className={cn(opsLetterCard, "mt-5")}>
            <div className={opsLetterHead}>
              <div className={opsHeadRow}>
                <span className={opsIconBoxGold}>
                  <TypeIcon type="court_visit" size={18} />
                </span>
                <div>
                  <div className={opsLetterTitle}>خطاب التفويض الداخلي</div>
                  <div className={opsLetterSub}>
                    مفتاح التجميع: المحكمة + الدائرة · لقطة (snapshot) عند الإصدار
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 max-lg:w-full max-lg:flex-col max-lg:items-stretch">
                <span className="text-xs font-bold text-text-2">
                  الرقم المرجعي:{" "}
                  <span dir="ltr" className="text-gold-d">
                    {detail.reference || "—"}
                  </span>
                </span>
                {detail.letterRows.length > 0 ? (
                  <button
                    type="button"
                    className={cn(
                      opsBtnGhost,
                      "min-h-9 px-3.5 py-2 text-[12.5px] max-lg:w-full max-lg:min-h-11 max-lg:justify-center",
                    )}
                    onClick={() =>
                      void printOperationsTaskDelegationLetter(
                        detail,
                        agentInfoFromStaff(reviewerStaff),
                      )
                    }
                  >
                    طباعة خطاب التفويض
                  </button>
                ) : null}
              </div>
            </div>
            <div className="px-3.5 py-3.5 sm:px-[18px] sm:py-4">
              <LetterTable rows={detail.letterRows} />
              <p className="mx-0.5 mt-3 text-[11.5px] leading-relaxed text-text-3">
                الترميز المرجعي الموحّد + snapshot للبيانات وقت الإصدار — يُطبع على
                الترويسة الرسمية.
              </p>
            </div>
          </div>
        ) : null}

        <div className={opsTfActions}>
          {(detail.status === "in_progress" && isAssignee) ||
          (canCreate &&
            (detail.status === "in_progress" ||
              detail.status === "paused" ||
              detail.status === "created")) ? (
            <button
              type="button"
              className={opsBtnPrimary}
              disabled={busy}
              onClick={() => openCloseModal(detail)}
            >
              إغلاق المهمة
            </button>
          ) : null}
          {canCreate &&
          (detail.status === "created" || detail.status === "in_progress") ? (
            <button
              type="button"
              className={opsBtnGhost}
              disabled={busy}
              onClick={() => openPauseModal(detail)}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
                className="-my-0.5 me-1.5"
              >
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
              إيقاف مؤقت
            </button>
          ) : null}
          {canCreate && detail.status === "paused" ? (
            <button
              type="button"
              className={opsBtnPrimary}
              disabled={busy}
              aria-busy={busy || undefined}
              onClick={() => void runStatus(detail.id, "in_progress")}
            >
              {busy ? <Spinner /> : null}
              <span>{busy ? "جاري الاستئناف…" : "استئناف المهمة"}</span>
            </button>
          ) : null}
          {canCreate && isActiveOperationsTask(detail) ? (
            <button
              type="button"
              className={opsBtnGhost}
              onClick={() => openReassign(detail)}
            >
              إعادة توجيه وإسناد
            </button>
          ) : null}
          {canCreate && isActiveOperationsTask(detail) ? (
            <button
              type="button"
              className={opsBtnGhost}
              onClick={() => openPriorityModal(detail)}
            >
              تغيير الأولوية
            </button>
          ) : null}
        </div>

        {detail.type === "court_visit" &&
        detail.courtVisitResult?.kind === "received" &&
        detail.status === "completed" &&
        !detail.linkedEnvelopeId ? (
          <div className="mt-4 flex w-full flex-col gap-3 rounded-[13px] border border-gold bg-gold-soft px-4 py-3.5 sm:flex-row sm:flex-wrap sm:items-center sm:px-[18px]">
            <span className="min-w-0 flex-1 text-[13px] font-bold leading-snug text-heading">
              استُلم ظرف مفاتيح في هذه الزيارة ولم يُسجَّل بعد — سجّله مربوطاً
              بالمهمة.
            </span>
            <button
              type="button"
              className={cn(
                opsBtnPrimary,
                "w-full shrink-0 max-lg:min-h-12 sm:ms-auto sm:w-auto",
              )}
              onClick={() => openKeysRegisterFromTask(detail)}
            >
              تسجيل الظرف الآن
            </button>
          </div>
        ) : null}

        <CommentThread
          task={detail}
          staffUsers={staffUsers}
          commentText={commentText}
          setCommentText={setCommentText}
          draftFiles={commentFiles}
          setDraftFiles={setCommentFiles}
          fileInputRef={commentFileInputRef}
          busy={busy}
          onSend={() => void sendComment(detail.id)}
        />

        <AppModal
          open={closeOpen}
          title={
            closeOutcome === "cancelled"
              ? "إلغاء المهمة"
              : "إغلاق المهمة — منجزة"
          }
          subtitle={
            closeOutcome === "cancelled"
              ? "صلاحية منشئ المهمة — يتطلب سبباً إلزامياً"
              : "يقوم المنفّذ بإغلاق المهمة بعد إتمام العمل المطلوب"
          }
          maxWidthPx={540}
          onClose={() => setCloseOpen(false)}
        >
          <CloseTaskModalBody
            taskType={detail.type}
            letterRows={detail.letterRows}
            closeOutcome={closeOutcome}
            setCloseOutcome={setCloseOutcome}
            canCancel={canCreate}
            allowCompleteOutcome={
              detail.status === "in_progress" || detail.status === "paused"
            }
            cancelReason={cancelReason}
            setCancelReason={setCancelReason}
            closeText={closeText}
            setCloseText={setCloseText}
            closeFiles={closeFiles}
            setCloseFiles={setCloseFiles}
            fileInputRef={closeFileInputRef}
            courtKind={courtKind}
            setCourtKind={setCourtKind}
            courtOtherText={courtOtherText}
            setCourtOtherText={setCourtOtherText}
            courtStatement={courtStatement}
            setCourtStatement={setCourtStatement}
            courtPerDeed={courtPerDeed}
            setCourtPerDeed={setCourtPerDeed}
            courtContacts={courtContacts}
            setCourtContacts={setCourtContacts}
            showCreditPicker={showCreditPicker}
            creditAssignees={creditAssignees}
            creditAssigneeId={creditAssigneeId}
            setCreditAssigneeId={setCreditAssigneeId}
            setCreditAssigneeName={setCreditAssigneeName}
            formError={closeFormError}
            busy={busy}
            onCancel={() => setCloseOpen(false)}
            onConfirm={() => confirmCloseTask(detail)}
          />
        </AppModal>

        {govFailureTarget ? (
          <FailureRaiseModal
            open
            onClose={() => setGovFailureTarget(null)}
            poNumber={govFailureTarget.poNumber}
            propertyId={govFailureTarget.propertyId}
            deedNumber={govFailureTarget.deedNumber}
            specialist={
              detail.assigneeName?.trim() || GOVERNMENT_REVIEWER_FAILURE_RAISER
            }
            raisedByRole={GOVERNMENT_REVIEWER_FAILURE_RAISER}
            onSubmitted={() => {
              void afterGovFailureRaised();
            }}
          />
        ) : null}

        <AppModal
          open={pauseOpen}
          title="إيقاف مؤقت"
          subtitle="دورة المعاملة قصيرة (4–5 أيام عمل) — حد الإيقاف يوم عمل واحد"
          maxWidthPx={460}
          onClose={() => setPauseOpen(false)}
        >
          <PauseModalBody
            pauseReason={pauseReason}
            setPauseReason={setPauseReason}
            pauseError={pauseError}
            busy={busy}
            onCancel={() => setPauseOpen(false)}
            onConfirm={() => void confirmPauseTask()}
          />
        </AppModal>

        <AppModal
          open={prioOpen}
          title="تغيير الأولوية"
          onClose={() => setPrioOpen(false)}
        >
          <PriorityModalBody
            task={detail}
            prioValue={prioValue}
            setPrioValue={setPrioValue}
            prioEditDue={prioEditDue}
            setPrioEditDue={setPrioEditDue}
            prioDueDate={prioDueDate}
            setPrioDueDate={setPrioDueDate}
            prioDueTime={prioDueTime}
            setPrioDueTime={setPrioDueTime}
            onFitPriorityDue={applyPrioDueFromOffset}
            busy={busy}
            onCancel={() => setPrioOpen(false)}
            onApply={() => void applyPriority(detail.id)}
          />
        </AppModal>

        {reassignOpen ? (
          <ReassignOperationsTaskModal
            open={reassignOpen}
            currentAssigneeName={detail.assigneeName}
            currentAssigneeRole={
              reassignAssignees.find((a) => a.id === detail.assigneeId)?.subtitle
            }
            assignees={reassignAssignees}
            assigneeId={reassignAssigneeId}
            dueDate={reassignDueDate}
            dueTime={reassignDueTime}
            reason={reassignReason}
            error={reassignError}
            busy={busy || reassigning}
            onAssigneeChange={(id, name) => {
              setReassignAssigneeId(id);
              setReassignAssigneeName(name);
            }}
            onDueDateChange={setReassignDueDate}
            onDueTimeChange={setReassignDueTime}
            onReasonChange={setReassignReason}
            onClose={() => setReassignOpen(false)}
            onSubmit={submitReassign}
          />
        ) : null}
      </PageShell>
    );
  }

  return (
    <PageShell variant="canvas" className="gap-3.5 p-4 sm:gap-3.5 sm:p-6">
      {/* Desktop: connected KPI band */}
      <KpiBand className="mb-0 hidden shrink-0 !rounded-[12px] lg:flex">
        <KpiCell
          first
          icon={<TasksKpiActiveIcon />}
          iconClass="bg-gold-soft text-gold-d"
          label="مهام نشطة"
          value={kpis.active}
          sub="قيد الإسناد والتنفيذ"
          dot
        />
        <KpiCell
          icon={<TasksKpiCreatedIcon />}
          iconClass="bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-ink"
          label="منشأة"
          value={kpis.created}
          sub="بانتظار البدء"
        />
        <KpiCell
          icon={<TasksKpiInProgressIcon />}
          iconClass="bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#8a5e14]"
          label="قيد التنفيذ"
          value={kpis.inProgress}
          sub="جارية الآن"
        />
        <KpiCell
          last
          icon={<TasksKpiCompletedIcon />}
          iconClass="bg-[color-mix(in_srgb,#3f8f5f_16%,transparent)] text-[#2f7a4d]"
          label="مكتملة"
          value={kpis.completed}
          sub="أُنجزت مؤخراً"
        />
      </KpiBand>

      {/* Mobile: property-inspection-style 2×2 stat cards */}
      <MobileKpiStatCards
        className="mb-0"
        items={[
          {
            key: "active",
            label: "مهام نشطة",
            sub: "قيد الإسناد والتنفيذ",
            value: kpis.active,
            icon: <TasksKpiActiveIcon />,
            iconClass: "bg-gold-soft text-gold-d",
            tone: "gold",
            valueClass: "!text-gold-d",
          },
          {
            key: "created",
            label: "منشأة",
            sub: "بانتظار البدء",
            value: kpis.created,
            icon: <TasksKpiCreatedIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-ink",
            tone: "ink",
          },
          {
            key: "inProgress",
            label: "قيد التنفيذ",
            sub: "جارية الآن",
            value: kpis.inProgress,
            icon: <TasksKpiInProgressIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#8a5e14]",
            tone: "gold",
            valueClass: "!text-gold-d",
          },
          {
            key: "completed",
            label: "مكتملة",
            sub: "أُنجزت مؤخراً",
            value: kpis.completed,
            icon: <TasksKpiCompletedIcon />,
            iconClass:
              "bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-ink",
            tone: "ink",
            valueClass: "!text-ink",
          },
        ]}
      />

      <div className={opsToolbar}>
        <div className={cn(opsFilters, "flex-1")}>
          <OperationalToolbarSearch
            type="search"
            placeholder="عنوان المهمة أو المنفّذ أو رقم الصك…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="بحث المهام"
          />
          <div className="flex flex-wrap items-center gap-2.5 max-lg:grid max-lg:w-full max-lg:grid-cols-2 lg:contents">
            <OperationalToolbarSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="تصفية الحالة"
            >
              <option value="">جميع الحالات</option>
              {Object.entries(OPERATIONS_TASK_STATUS_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </OperationalToolbarSelect>
            <OperationalToolbarSelect
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value)}
              aria-label="تصفية النطاق"
            >
              <option value="">كل النطاقات</option>
              {Object.entries(OPERATIONS_TASK_SCOPE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </OperationalToolbarSelect>
          </div>
          <div className="flex items-center gap-2 max-lg:w-full lg:contents">
            <button
              type="button"
              className={showAll ? opsShowAllBtnOn : opsShowAllBtn}
              onClick={() => setShowAll(toggleShowAll)}
            >
              <TasksShowAllEye open={showAll} blink={showAllEyeBlink} />
              <span>{showAll ? "النشطة فقط" : "إظهار جميع المهام"}</span>
            </button>
            <span className={opsListCount} aria-live="polite">
              {visibleTasks.length}
              <span>نتيجة</span>
            </span>
          </div>
        </div>
        {canCreate ? (
          <OperationalToolbarPrimaryButton
            className="ms-3 max-lg:ms-0"
            onClick={() => {
              setCreatePrefill(null);
              setCreateOpen(true);
            }}
            onMouseEnter={preloadCreateOperationsTaskModal}
            onFocus={preloadCreateOperationsTaskModal}
          >
            <PlusIcon />
            <span>إنشاء مهمة</span>
          </OperationalToolbarPrimaryButton>
        ) : null}
      </div>

      {selectedCount > 0 && canRemind ? (
        <div className={opsBulk}>
          <BellIcon size={16} />
          <span className={opsBulkCount}>{selectedCount} مهمة محددة</span>
          <button
            type="button"
            className={cn(opsRemindBtn, "ms-auto")}
            disabled={busy || bulkReminding}
            aria-busy={busy || bulkReminding || undefined}
            onClick={bulkRemind}
          >
            {busy || bulkReminding ? <Spinner /> : <BellIcon size={15} />}
            <span>
              {busy || bulkReminding
                ? "جاري التذكير…"
                : "تذكير المحدد دفعة واحدة"}
            </span>
          </button>
          <button
            type="button"
            className={opsBulkClear}
            onClick={() => setSelectedIds({})}
          >
            إلغاء التحديد
          </button>
        </div>
      ) : selectedCount > 0 ? (
        <div className={opsBulk}>
          <span className={opsBulkCount}>{selectedCount} مهمة محددة</span>
          <button
            type="button"
            className={opsBulkClear}
            onClick={() => setSelectedIds({})}
          >
            إلغاء التحديد
          </button>
        </div>
      ) : null}

      {error ? <Note tone="danger">{error}</Note> : null}

      <OperationalPanel className="min-h-0 flex-1 overflow-hidden !rounded-[12px] p-0 max-lg:border-0 max-lg:bg-transparent max-lg:!rounded-none max-lg:shadow-none">
        {/* Desktop table — after hydration mount only one tree (rendering). */}
        {isDesktopViewport === false ? null : (
          <TableFrame className="hidden lg:block">
            <Table wrapClassName="min-w-[900px]">
              <THead>
                <Tr hoverable={false}>
                  <ThAction aria-label="تحديد الكل" className="w-10">
                    <input
                      ref={selAllRef}
                      type="checkbox"
                      aria-label="تحديد الكل"
                      className="size-[17px] accent-gold-d"
                      checked={allVisibleActiveChecked}
                      onChange={(e) => {
                        const on = e.target.checked;
                        const next = { ...selectedIds };
                        for (const t of visibleTasks) {
                          if (!isActiveOperationsTask(t)) continue;
                          if (on) next[t.id] = true;
                          else delete next[t.id];
                        }
                        setSelectedIds(next);
                      }}
                    />
                  </ThAction>
                  <Th>المهمة</Th>
                  <Th>النطاق / الربط</Th>
                  <Th>المنفّذ</Th>
                  <Th>الاستحقاق</Th>
                  <Th className="text-center">الحالة</Th>
                  <ThAction aria-label="إجراءات" />
                </Tr>
              </THead>
              <TBody>
                {visibleTasks.length === 0 ? (
                  <TableEmptyRow colSpan={7}>
                    {useIndependentQueue
                      ? "لا توجد مهام مسندة إليك."
                      : "لا توجد مهام مطابقة."}
                  </TableEmptyRow>
                ) : (
                  visibleTasks.map((task) => (
                    <OperationsTaskRow
                      key={task.id}
                      task={task}
                      checked={Boolean(selectedIds[task.id])}
                      canRemind={canRemind}
                      staffUsers={staffUsers}
                      onOpen={openTask}
                      onOpenDetail={openTaskDetail}
                      onToggleSelect={toggleTaskSelected}
                      onRemind={remindTask}
                      rowMenu={rowMenu}
                    />
                  ))
                )}
              </TBody>
            </Table>
          </TableFrame>
        )}

        {/* Mobile card list */}
        {isDesktopViewport === true ? null : (
          <div className="px-3 pb-3 lg:hidden max-lg:px-0">
            <ActiveQueueMobileCards
              items={mobileCardItems}
              emptyMessage={
                useIndependentQueue
                  ? "لا توجد مهام مسندة إليك."
                  : "لا توجد مهام مطابقة."
              }
            />
          </div>
        )}
        <TasksSectionNote>{TASKS_LIST_FOOTER}</TasksSectionNote>
      </OperationalPanel>

      {/* Conditional mount — always-on mounting still fetched the chunk when opening the screen despite splitting. */}
      {createOpen ? (
        <CreateOperationsTaskModal
          open={createOpen}
          poRecords={poRecords}
          staffUsers={staffUsers}
          staffLoadError={staffLoadError}
          staffLoading={staffLoading}
          prefill={createPrefill}
          onClose={() => {
            setCreateOpen(false);
            setCreatePrefill(null);
          }}
          onCreated={(taskId) => {
            setSelectedId(taskId);
            setDetailId(taskId);
            void refetch();
          }}
        />
      ) : null}

      <AppModal
        open={closeOpen}
        title={
          closeOutcome === "cancelled"
            ? "إلغاء المهمة"
            : "إغلاق المهمة — منجزة"
        }
        subtitle={
          closeOutcome === "cancelled"
            ? "صلاحية منشئ المهمة — يتطلب سبباً إلزامياً"
            : "يقوم المنفّذ بإغلاق المهمة بعد إتمام العمل المطلوب"
        }
        maxWidthPx={540}
        onClose={() => setCloseOpen(false)}
      >
        <CloseTaskModalBody
          taskType={tasks.find((t) => t.id === selectedId)?.type}
          letterRows={tasks.find((t) => t.id === selectedId)?.letterRows}
          closeOutcome={closeOutcome}
          setCloseOutcome={setCloseOutcome}
          canCancel={canCreate}
          allowCompleteOutcome={(() => {
            const st = tasks.find((t) => t.id === selectedId)?.status;
            return st === "in_progress" || st === "paused";
          })()}
          cancelReason={cancelReason}
          setCancelReason={setCancelReason}
          closeText={closeText}
          setCloseText={setCloseText}
          closeFiles={closeFiles}
          setCloseFiles={setCloseFiles}
          fileInputRef={closeFileInputRef}
          courtKind={courtKind}
          setCourtKind={setCourtKind}
          courtOtherText={courtOtherText}
          setCourtOtherText={setCourtOtherText}
          courtStatement={courtStatement}
          setCourtStatement={setCourtStatement}
          courtPerDeed={courtPerDeed}
          setCourtPerDeed={setCourtPerDeed}
          courtContacts={courtContacts}
          setCourtContacts={setCourtContacts}
          showCreditPicker={showCreditPicker}
          creditAssignees={creditAssignees}
          creditAssigneeId={creditAssigneeId}
          setCreditAssigneeId={setCreditAssigneeId}
          setCreditAssigneeName={setCreditAssigneeName}
          formError={closeFormError}
          busy={busy}
          onCancel={() => setCloseOpen(false)}
          onConfirm={() => {
            const task = tasks.find((t) => t.id === selectedId);
            if (!task) return;
            confirmCloseTask(task);
          }}
        />
      </AppModal>

      <AppModal
        open={pauseOpen}
        title="إيقاف مؤقت"
        subtitle="دورة المعاملة قصيرة (4–5 أيام عمل) — حد الإيقاف يوم عمل واحد"
        maxWidthPx={460}
        onClose={() => setPauseOpen(false)}
      >
        <PauseModalBody
          pauseReason={pauseReason}
          setPauseReason={setPauseReason}
          pauseError={pauseError}
          busy={busy}
          onCancel={() => setPauseOpen(false)}
          onConfirm={() => void confirmPauseTask()}
        />
      </AppModal>

      <AppModal open={prioOpen} title="تغيير الأولوية" onClose={() => setPrioOpen(false)}>
        {selectedId && tasks.find((t) => t.id === selectedId) ? (
          <PriorityModalBody
            task={tasks.find((t) => t.id === selectedId)!}
            prioValue={prioValue}
            setPrioValue={setPrioValue}
            prioEditDue={prioEditDue}
            setPrioEditDue={setPrioEditDue}
            prioDueDate={prioDueDate}
            setPrioDueDate={setPrioDueDate}
            prioDueTime={prioDueTime}
            setPrioDueTime={setPrioDueTime}
            onFitPriorityDue={applyPrioDueFromOffset}
            busy={busy}
            onCancel={() => setPrioOpen(false)}
            onApply={() => {
              if (!selectedId) return;
              void applyPriority(selectedId);
            }}
          />
        ) : null}
      </AppModal>

      {reassignOpen ? (
        <ReassignOperationsTaskModal
          open={reassignOpen}
          currentAssigneeName={reassignTask?.assigneeName ?? ""}
          currentAssigneeRole={
            reassignTask
              ? reassignAssignees.find((a) => a.id === reassignTask.assigneeId)
                  ?.subtitle
              : undefined
          }
          assignees={reassignAssignees}
          assigneeId={reassignAssigneeId}
          dueDate={reassignDueDate}
          dueTime={reassignDueTime}
          reason={reassignReason}
          error={reassignError}
          busy={busy || reassigning}
          onAssigneeChange={(id, name) => {
            setReassignAssigneeId(id);
            setReassignAssigneeName(name);
          }}
          onDueDateChange={setReassignDueDate}
          onDueTimeChange={setReassignDueTime}
          onReasonChange={setReassignReason}
          onClose={() => setReassignOpen(false)}
          onSubmit={submitReassign}
        />
      ) : null}
    </PageShell>
  );
}
