"use client";

/**
 * Operations-tasks detail page — header, summary cells, reminder card, the
 * court-visit letter, action buttons, envelope banner and the comment thread.
 * The action modals are mounted by `OperationsTasksModals` from the view.
 */

import dynamic from "next/dynamic";
import { cn, Note, PageShell, Spinner, StatusPill } from "@platform/ui-kit";
import { displayPersonName } from "@platform/app-shared/app-data/person-display-name";
import { GOVERNMENT_REVIEWER_FAILURE_RAISER } from "@failures/mfe/lib/failure-party-roles";
import type { OperationsTask } from "../lib/app-data/operations-tasks-model";
import { isActiveOperationsTask } from "../lib/app-data/operations-tasks-model";
import {
  OPERATIONS_TASK_PRIORITY_COLORS,
  OPERATIONS_TASK_REMIND_LABELS,
  formatTaskDueLabel,
  operationsTaskPriorityLabel,
  operationsTaskTypeLabel,
  printOperationsTaskDelegationLetter,
} from "../lib/app-data/operations-task-display";
import { agentInfoFromStaff } from "../lib/app-data/internal-delegation-letters";
import { tasksDescClassName } from "../components/tasks/TasksHtmlPrimitives";
import {
  opsBtnGhost,
  opsBtnPrimary,
  opsDotSep,
  opsHeadRow,
  opsIconBoxGold,
  opsLetterCard,
  opsLetterHead,
  opsLetterSub,
  opsLetterTitle,
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
  opsTfActions,
} from "../lib/app-data/ops-tasks-tw";
import {
  isOperationsTaskOverdue,
  needsEnvelopeRegistration,
  operationsTaskDetailActions,
  operationsTaskLinkChip,
  operationsTaskReceiptCell,
} from "./operations-tasks-view-state";
import {
  BellIcon,
  PauseIcon,
  TaskStatusPill,
  TaskStepper,
  TickingRemindCountdown,
  TypeIcon,
  assigneeRoleLabel,
  type OperationsTasksWorkflow,
} from "./OperationsTasksViewShared";
import { CommentThread } from "./OperationsTasksCommentThread";
import { LetterTable } from "./OperationsTasksLetterTable";

const FailureRaiseModal = dynamic(
  () =>
    import("../components/failures/FailureRaiseModal").then(
      (m) => m.FailureRaiseModal,
    ),
  { ssr: false },
);

export type OperationsTasksDetailPanelProps = Pick<
  OperationsTasksWorkflow,
  | "afterGovFailureRaised"
  | "busy"
  | "canCreate"
  | "canRemind"
  | "commentFileInputRef"
  | "commentFiles"
  | "commentText"
  | "error"
  | "govFailureTarget"
  | "isAssignee"
  | "now"
  | "openCloseModal"
  | "openGovFailureRaise"
  | "openKeysRegisterFromTask"
  | "openPauseModal"
  | "openPriorityModal"
  | "openReassign"
  | "remindTask"
  | "reviewerStaff"
  | "runStatus"
  | "sendComment"
  | "setCommentFiles"
  | "setCommentText"
  | "setGovFailureTarget"
  | "showGovFailureRaise"
  | "staffUsers"
> & {
  detail: OperationsTask;
  /** The action modals, rendered inside the page shell. */
  children?: React.ReactNode;
};

function ReceiptCell({
  detail,
  isAssignee,
  busy,
  runStatus,
}: Pick<OperationsTasksDetailPanelProps, "detail" | "isAssignee" | "busy" | "runStatus">) {
  const cell = operationsTaskReceiptCell(detail, isAssignee);
  if (cell.kind === "hidden") return null;
  if (cell.kind === "confirm") {
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
  return (
    <div
      className={cn(
        opsPpCell,
        "max-lg:col-span-2 lg:ms-auto lg:border-s-0 lg:pe-0",
      )}
    >
      <div
        className={opsPpCellV}
        style={cell.confirmed ? undefined : { color: "#b8860b" }}
      >
        {cell.text}
      </div>
    </div>
  );
}

export function OperationsTasksDetailPanel({
  afterGovFailureRaised,
  busy,
  canCreate,
  canRemind,
  commentFileInputRef,
  commentFiles,
  commentText,
  detail,
  error,
  govFailureTarget,
  isAssignee,
  now,
  openCloseModal,
  openGovFailureRaise,
  openKeysRegisterFromTask,
  openPauseModal,
  openPriorityModal,
  openReassign,
  remindTask,
  reviewerStaff,
  runStatus,
  sendComment,
  setCommentFiles,
  setCommentText,
  setGovFailureTarget,
  showGovFailureRaise,
  staffUsers,
  children,
}: OperationsTasksDetailPanelProps) {
  const overdue = isOperationsTaskOverdue(detail, now);
  const prColor = OPERATIONS_TASK_PRIORITY_COLORS[detail.priority] ?? "#8a8d96";
  const nSent = detail.reminders?.length ?? 0;
  const linkChip = operationsTaskLinkChip(detail);
  const actions = operationsTaskDetailActions(detail, { isAssignee, canCreate });

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
          <ReceiptCell
            detail={detail}
            isAssignee={isAssignee}
            busy={busy}
            runStatus={runStatus}
          />
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
        {actions.close ? (
          <button
            type="button"
            className={opsBtnPrimary}
            disabled={busy}
            onClick={() => openCloseModal(detail)}
          >
            إغلاق المهمة
          </button>
        ) : null}
        {actions.pause ? (
          <button
            type="button"
            className={opsBtnGhost}
            disabled={busy}
            onClick={() => openPauseModal(detail)}
          >
            <PauseIcon />
            إيقاف مؤقت
          </button>
        ) : null}
        {actions.resume ? (
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
        {actions.reassign ? (
          <button
            type="button"
            className={opsBtnGhost}
            onClick={() => openReassign(detail)}
          >
            إعادة توجيه وإسناد
          </button>
        ) : null}
        {actions.changePriority ? (
          <button
            type="button"
            className={opsBtnGhost}
            onClick={() => openPriorityModal(detail)}
          >
            تغيير الأولوية
          </button>
        ) : null}
      </div>

      {needsEnvelopeRegistration(detail) ? (
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

      {children}

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
    </PageShell>
  );
}
