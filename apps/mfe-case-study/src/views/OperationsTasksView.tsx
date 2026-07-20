"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useSearchParams } from "next/navigation";
import {
  Input,
  KpiBand,
  KpiCell,
  Note,
  OperationalPanel,
  OperationalToolbarPrimaryButton,
  OperationalToolbarSearch,
  OperationalToolbarSelect,
  PageShell,
  PanelSkeleton,
  Select,
  StatusPill,
  Textarea,
  cn,
  useToast,
} from "@platform/design-system";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import type { StaffUser } from "@platform/app-shared/prototype/constants";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import { usePoRecordsQuery } from "../query/case-study-queries";
import { useOperationsTasksQuery } from "../query/operations-tasks-queries";
import {
  addOperationsTaskCommentRecord,
  isActiveOperationsTask,
  isTerminalOperationsTask,
  patchOperationsTaskRecord,
  reassignOperationsTaskRecord,
  remindOperationsTaskRecord,
  type OperationsTask,
} from "../lib/prototype/operations-tasks-storage";
import {
  OPERATIONS_TASK_PRIORITY_COLORS,
  OPERATIONS_TASK_PRIORITY_LABELS,
  OPERATIONS_TASK_REMIND_LABELS,
  OPERATIONS_TASK_SCOPE_LABELS,
  OPERATIONS_TASK_STATUS_COLORS,
  OPERATIONS_TASK_STATUS_LABELS,
  OPERATIONS_TASK_TYPE_ICON_PATHS,
  TASK_STEPPER_STEPS,
  formatTaskDueLabel,
  isTerminalOperationsTaskStatus,
  operationsTaskLinkLabel,
  operationsTaskPriorityLabel,
  operationsTaskScopeLabel,
  operationsTaskStatusLabel,
  operationsTaskTypeLabel,
  printOperationsTaskDelegationLetter,
  remindCountdownLabelForTask,
  taskCountdown,
  taskStepperIndex,
  taskUrgency,
} from "../lib/prototype/operations-task-display";
import {
  canManageOperationsTasks,
  canRemindOperationsTasks,
} from "../lib/prototype/operations-task-roles";
import { agentInfoFromStaff } from "../lib/prototype/internal-delegation-letters";
import {
  getFieldInspectors,
  getGovernmentAuditors,
  getValuators,
  partyAccountForRole,
  type DistributionAssignee,
} from "../lib/prototype/distribution-parties";
import { AppModal } from "../components/ui/AppModal";
import { RowMoreMenu } from "../components/ui/RowMoreMenu";
import type { RowMoreMenuItem } from "../components/ui/RowMoreMenu";
import {
  CreateOperationsTaskModal,
  type CreateOperationsTaskPrefill,
} from "../components/CreateOperationsTaskModal";
import {
  opsAttachBtn,
  opsBackLink,
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
  opsLetterRow,
  opsTdPo,
  opsTdDeed,
  opsTdPlain,
  opsTdCourt,
  opsThStart,
  opsTypeIconSm,
  opsRowTitle,
  opsRowMeta,
  opsEmptyHint,
  opsEventAv,
  opsFileChip,
  opsFileChipFx,
  opsFilters,
  opsGridRow,
  opsGridRowOn,
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
  opsRemindBtn,
  opsRemindCard,
  opsRemindMini,
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
  opsTaskDesc,
  opsTd,
  opsTdC,
  opsTh,
  opsThead,
  opsTkCheck,
  opsTkCheckInput,
  opsToolbar,
  opsTfActions,
  opsTfChip,
  opsTfLbl,
  opsTfSeg,
  opsTfSegActive,
  opsTfSegRow,
} from "../lib/prototype/ops-tasks-tw";
import "./operations-tasks-look.css";

const COLS =
  "40px minmax(170px,1.8fr) minmax(110px,1.1fr) minmax(120px,1.1fr) minmax(120px,1.2fr) minmax(84px,.85fr) 84px";

const LETTER_COLS =
  "44px minmax(84px,.9fr) minmax(120px,1.2fr) minmax(100px,1fr) minmax(78px,.8fr) minmax(160px,1.5fr)";

const PRIORITY_OFFSET_MS: Record<string, number> = {
  high: 4 * 3_600_000,
  medium: 12 * 3_600_000,
  low: 24 * 3_600_000,
};

function fmtFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type DraftFile = { name: string; size: string };

function filesFromList(list: FileList | null): DraftFile[] {
  if (!list) return [];
  return Array.from(list).map((f) => ({ name: f.name, size: fmtFileSize(f.size) }));
}

function TypeIcon({ type, size = 15 }: { type: string; size?: number }) {
  const paths =
    OPERATIONS_TASK_TYPE_ICON_PATHS[type] ?? OPERATIONS_TASK_TYPE_ICON_PATHS.general;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      dangerouslySetInnerHTML={{ __html: paths! }}
    />
  );
}

function BellIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function FlagIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
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
    >
      <path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3 3 0 0 1 4.24 4.24l-9.2 9.19a1 1 0 0 1-1.41-1.41l8.49-8.49" />
    </svg>
  );
}

function DraftFileChips({
  files,
  onRemove,
}: {
  files: DraftFile[];
  onRemove?: (index: number) => void;
}) {
  if (files.length === 0) return null;
  return (
    <div className={opsCmtFiles}>
      {files.map((f, i) => (
        <span key={`${f.name}-${i}`} className={opsFileChip}>
          <span>{f.name}</span>
          <span className={opsFileSize}>{f.size}</span>
          {onRemove ? (
            <button
              type="button"
              className={opsFileChipFx}
              aria-label="إزالة المرفق"
              onClick={() => onRemove(i)}
            >
              ×
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}

function CloseTaskModalBody({
  closeText,
  setCloseText,
  closeFiles,
  setCloseFiles,
  fileInputRef,
  busy,
  onCancel,
  onConfirm,
}: {
  closeText: string;
  setCloseText: (v: string) => void;
  closeFiles: DraftFile[];
  setCloseFiles: (v: DraftFile[] | ((prev: DraftFile[]) => DraftFile[])) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className={opsMutedHint}>
        أضف تعليق الإنجاز مع إمكانية إرفاق المستندات الداعمة
      </p>
      <Note tone="success" className="text-[12.5px]">
        سيتم تحويل حالة المهمة إلى <b className="text-[#2f7a4d]">مكتملة</b> وإشعار
        المنشئ.
      </Note>
      <label className="flex flex-col gap-1.5">
        <span className={opsTfLbl}>تعليق الإغلاق</span>
        <Textarea
          value={closeText}
          onChange={(e) => setCloseText(e.target.value)}
          placeholder="لخّص ما تم إنجازه…"
          rows={3}
        />
      </label>
      <DraftFileChips
        files={closeFiles}
        onRemove={(index) =>
          setCloseFiles((prev) => prev.filter((_, i) => i !== index))
        }
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          const next = filesFromList(e.target.files);
          if (next.length) setCloseFiles((prev) => [...prev, ...next]);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        className={cn(opsAttachBtn, "self-start")}
        disabled={busy}
        onClick={() => fileInputRef.current?.click()}
      >
        <PaperclipIcon />
        <span>إرفاق مستند</span>
      </button>
      <div className="flex justify-end gap-2">
        <button type="button" className={opsBtnGhost} onClick={onCancel}>
          إلغاء
        </button>
        <button
          type="button"
          className={opsBtnPrimary}
          disabled={busy}
          onClick={onConfirm}
        >
          إغلاق المهمة
        </button>
      </div>
    </div>
  );
}

function PriorityModalBody({
  task,
  prioValue,
  setPrioValue,
  prioEditDue,
  setPrioEditDue,
  prioDueDate,
  setPrioDueDate,
  prioDueTime,
  setPrioDueTime,
  onFitPriorityDue,
  busy,
  onCancel,
  onApply,
}: {
  task: OperationsTask;
  prioValue: string;
  setPrioValue: (v: string) => void;
  prioEditDue: boolean;
  setPrioEditDue: (v: boolean) => void;
  prioDueDate: string;
  setPrioDueDate: (v: string) => void;
  prioDueTime: string;
  setPrioDueTime: (v: string) => void;
  onFitPriorityDue: () => void;
  busy: boolean;
  onCancel: () => void;
  onApply: () => void;
}) {
  const prColor = OPERATIONS_TASK_PRIORITY_COLORS[task.priority] ?? "#8a8d96";
  return (
    <div className="flex flex-col gap-3">
      <p className={opsMutedHint}>
        طرأ ما يستعجل الإنجاز؟ صعّد الأولوية — يُحدَّث تواتر التذكير تلقائياً
      </p>
      <div className="text-[12.5px] text-text-2">
        الأولوية الحالية:{" "}
        <b style={{ color: prColor }}>{operationsTaskPriorityLabel(task.priority)}</b>
      </div>
      <div>
        <span className={opsTfLbl}>الأولوية الجديدة</span>
        <div className={opsTfSegRow}>
          {Object.entries(OPERATIONS_TASK_PRIORITY_LABELS).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={prioValue === id ? opsTfSegActive : opsTfSeg}
              onClick={() => setPrioValue(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-[9px] text-[11.5px] text-text-3">
          تذكير تلقائي{" "}
          {OPERATIONS_TASK_REMIND_LABELS[prioValue] ?? OPERATIONS_TASK_REMIND_LABELS.medium}
        </div>
      </div>
      <label className="flex cursor-pointer items-center gap-[9px] text-[12.5px] text-text-2">
        <input
          type="checkbox"
          className="h-4 w-4 shrink-0 accent-gold-d"
          checked={prioEditDue}
          onChange={(e) => setPrioEditDue(e.target.checked)}
        />
        <span>تعديل موعد الاستحقاق</span>
      </label>
      {prioEditDue ? (
        <div>
          <div className="mb-2.5 flex flex-wrap gap-2">
            <button type="button" className={opsTfChip} onClick={onFitPriorityDue}>
              ضبط حسب الأولوية الجديدة
            </button>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Input
              type="date"
              value={prioDueDate}
              onChange={(e) => setPrioDueDate(e.target.value)}
              className="max-w-[180px]"
            />
            <Input
              type="time"
              value={prioDueTime}
              onChange={(e) => setPrioDueTime(e.target.value)}
              className="max-w-[140px]"
            />
          </div>
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        <button type="button" className={opsBtnGhost} onClick={onCancel}>
          إلغاء
        </button>
        <button
          type="button"
          className={opsBtnPrimary}
          disabled={busy}
          onClick={onApply}
        >
          تطبيق
        </button>
      </div>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function EyeIcon({ open, blink }: { open: boolean; blink?: boolean }) {
  return (
    <svg
      className={cn("show-all-eye", open && "is-open", blink && "is-blink")}
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <g className="show-all-eye-ball">
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle className="show-all-eye-pupil" cx="12" cy="12" r="3" />
      </g>
      <path className="show-all-eye-lid" d="M3 12h18" />
    </svg>
  );
}

function BackChevron() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toLocalDateValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toLocalTimeValue(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function assigneesForType(
  type: string,
  staffUsers: StaffUser[],
): DistributionAssignee[] {
  if (type === "court_visit") return getGovernmentAuditors(staffUsers);
  if (type === "reshoot" || type === "field_visit") {
    return getFieldInspectors(staffUsers);
  }
  const seen = new Set<string>();
  const list: DistributionAssignee[] = [];
  for (const a of [
    ...getGovernmentAuditors(staffUsers),
    ...getFieldInspectors(staffUsers),
    ...getValuators(staffUsers),
  ]) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    list.push(a);
  }
  return list;
}

function assigneeRoleLabel(staffUsers: StaffUser[], assigneeId: string): string {
  const id = assigneeId.trim();
  if (!id) return "منفّذ";
  const u = staffUsers.find((s) => s.distributionAssigneeId?.trim() === id);
  return u?.role?.trim() || "منفّذ";
}

function statusPillStyle(status: string) {
  const color = OPERATIONS_TASK_STATUS_COLORS[status] ?? "#8a8d96";
  return { base: color, fg: color };
}

function TaskStatusPill({ status }: { status: string }) {
  return (
    <StatusPill
      label={operationsTaskStatusLabel(status)}
      style={statusPillStyle(status)}
    />
  );
}

function DueCell({ task, now }: { task: OperationsTask; now: number }) {
  const cd = taskCountdown(task.dueAt, task.status, now);
  const urgency = taskUrgency(task.dueAt, task.status, now);
  if (!isActiveOperationsTask(task)) {
    return (
      <span className="text-[12.5px] text-text-3">
        {task.status === "paused" ? "متوقفة" : "—"}
      </span>
    );
  }
  return (
    <div className={opsCdWrap}>
      <span
        className={cn(opsCdDot, urgency?.pulse && "ops-cd-dot-live")}
        style={{ background: urgency?.color ?? "#3f8f5f" }}
      />
      <span
        className={cd.over ? opsDueCdOver : opsDueCd}
        dir="ltr"
      >
        {cd.txt}
      </span>
      <span className={opsCdTip}>الاستحقاق: {formatTaskDueLabel(task.dueAt)}</span>
    </div>
  );
}

function TaskStepper({ status }: { status: string }) {
  if (status === "cancelled") {
    return (
      <div className={opsStepFlow}>
        <div className={opsStep}>
          <span className={cn(opsStepDot, opsStepDotDone)}>✓</span>
          <span className={opsStepLblOn}>منشأة</span>
        </div>
        <div className={opsStepLine} />
        <div className={opsStep}>
          <span className={cn(opsStepDot, opsStepDotCancel)}>✕</span>
          <span className={opsStepLblOn}>ملغاة</span>
        </div>
      </div>
    );
  }
  const idx = taskStepperIndex(status);
  return (
    <div className={opsStepFlow}>
      {TASK_STEPPER_STEPS.map((step, i) => {
        const done = idx != null && i < idx;
        const current = idx != null && i === idx;
        return (
          <div key={step.id} className="contents">
            <div className={opsStep}>
              <span
                className={cn(
                  opsStepDot,
                  done
                    ? opsStepDotDone
                    : current
                      ? opsStepDotActive
                      : opsStepDotIdle,
                )}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className={done || current ? opsStepLblOn : opsStepLbl}>
                {step.label}
              </span>
            </div>
            {i < TASK_STEPPER_STEPS.length - 1 ? (
              <div className={done ? opsStepLineOn : opsStepLine} />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function CommentThread({
  task,
  staffUsers,
  commentText,
  setCommentText,
  draftFiles,
  setDraftFiles,
  fileInputRef,
  busy,
  onSend,
}: {
  task: OperationsTask;
  staffUsers: StaffUser[];
  commentText: string;
  setCommentText: (v: string) => void;
  draftFiles: DraftFile[];
  setDraftFiles: (v: DraftFile[] | ((prev: DraftFile[]) => DraftFile[])) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  busy: boolean;
  onSend: () => void;
}) {
  const assigneeRole = assigneeRoleLabel(staffUsers, task.assigneeId);
  const comments = task.comments;
  const canSend = Boolean(commentText.trim() || draftFiles.length);
  return (
    <div className={cn(opsLetterCard, "mt-5")}>
      <div className={opsLetterHead}>
        <div className={opsHeadRow}>
          <span className={opsIconBoxGold}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </span>
          <div>
            <div className={opsLetterTitle}>التحديثات والاستفسارات</div>
            <div className={opsLetterSub}>
              سجل التواصل بين المنشئ والمنفّذ — مع إرفاق المستندات من الطرفين
            </div>
          </div>
        </div>
        <span className={opsLetterMeta}>{comments.length} تحديث</span>
      </div>
      <div className={opsLetterBodyPad}>
        <div className={opsCmtThread}>
          {comments.length === 0 ? (
            <div className={opsEmptyHint}>
              لا توجد تحديثات بعد — أضف أول تحديث أو استفسار على المهمة.
            </div>
          ) : (
            comments.map((c, i) => {
              if (c.kind === "reminder" || c.kind === "update") {
                return (
                  <div key={`${c.at}-${i}`} className={opsCmtEvent}>
                    <span className={opsEventAv}>
                      {c.kind === "update" ? <FlagIcon size={15} /> : <BellIcon size={15} />}
                    </span>
                    <div className={cn(opsCmtBody, "flex flex-wrap items-center gap-[9px]")}>
                      <span className="text-[12.5px] font-semibold text-text-2">
                        {c.text}
                      </span>
                      <span className={opsCmtTime}>{formatTaskDueLabel(c.at)}</span>
                    </div>
                  </div>
                );
              }
              const isC = c.who === "creator";
              const name = isC
                ? task.createdByName || "المنشئ"
                : task.assigneeName || "المنفّذ";
              const role = isC ? "منشئ المهمة" : assigneeRole;
              const col = isC ? "var(--ink)" : "var(--gold-d)";
              return (
                <div key={`${c.at}-${i}`} className={opsCmt}>
                  <span className={opsCmtAv} style={{ background: col }}>
                    {name.charAt(0)}
                  </span>
                  <div className={opsCmtBody}>
                    <div className={opsCmtH}>
                      <span className={opsCmtName}>{name}</span>
                      <span
                        className={opsCmtRole}
                        style={{
                          background: `color-mix(in srgb, ${col} 13%, transparent)`,
                          color: col,
                        }}
                      >
                        {role}
                      </span>
                      {c.kind === "close" ? (
                        <span
                          className={opsCmtRole}
                          style={{
                            background: "color-mix(in srgb, #3f8f5f 15%, transparent)",
                            color: "#2f7a4d",
                          }}
                        >
                          تعليق إغلاق
                        </span>
                      ) : null}
                      <span className={opsCmtTime}>{formatTaskDueLabel(c.at)}</span>
                    </div>
                    {c.text ? <div className={opsCmtText}>{c.text}</div> : null}
                    {c.files && c.files.length > 0 ? (
                      <div className={opsCmtFiles}>
                        {c.files.map((f, fi) => (
                          <span key={`${f.name}-${fi}`} className={opsFileChip}>
                            <span>{f.name}</span>
                            <span className={opsFileSize}>{f.size}</span>
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
        {task.status !== "cancelled" ? (
          <div className={opsCmtComposer}>
            <textarea
              className={opsCmtTextarea}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="أضف تحديثاً أو استفساراً على المهمة…"
              rows={3}
            />
            <DraftFileChips
              files={draftFiles}
              onRemove={(index) =>
                setDraftFiles((prev) => prev.filter((_, i) => i !== index))
              }
            />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                const next = filesFromList(e.target.files);
                if (next.length) setDraftFiles((prev) => [...prev, ...next]);
                e.target.value = "";
              }}
            />
            <div className={opsCmtBar}>
              <button
                type="button"
                className={opsAttachBtn}
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                <PaperclipIcon />
                <span>إرفاق مستند</span>
              </button>
              <button
                type="button"
                className={opsBtnPrimary}
                className="ms-auto"
                disabled={busy || !canSend}
                onClick={onSend}
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="m22 2-7 20-4-9-9-4Z" />
                  <path d="M22 2 11 13" />
                </svg>
                <span>إرسال</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LetterTable({ rows }: { rows: OperationsTask["letterRows"] }) {
  if (rows.length === 0) {
    return (
      <div className="p-6 text-center text-[12.5px] text-text-3">
        اختر الصكوك المرتبطة لعرض معاينة الخطاب.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-[12px] border border-border bg-surface shadow-card">
      <div className="min-w-[720px]">
        <div className={opsThead} style={{ gridTemplateColumns: LETTER_COLS }}>
          {["م", "أمر العمل", "رقم الصك", "المالك", "رقم الطلب", "المحكمة / الدائرة"].map(
            (h, i) => (
              <div
                key={h}
                className={i === 0 ? cn(opsTh, opsTdC) : opsThStart}
              >
                {h}
              </div>
            ),
          )}
        </div>
        {rows.map((row, i) => (
          <div
            key={`${row.po}-${row.deed}-${i}`}
            className={opsLetterRow}
            style={{ gridTemplateColumns: LETTER_COLS }}
          >
            <div className={cn(opsTd, opsTdC, "text-text-2")}>{i + 1}</div>
            <div className={opsTdPo} dir="ltr">
              {row.po}
            </div>
            <div className={opsTdDeed} dir="ltr">
              صك {row.deed}
            </div>
            <div className={opsTdPlain}>{row.owner}</div>
            <div className={opsTdPlain} dir="ltr">
              {row.request}
            </div>
            <div className={opsTdCourt}>
              <span className="font-semibold text-text">{row.court}</span>{" "}
              <span className="text-text-3">· {row.circuit}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OperationsTasksView() {
  const searchParams = useSearchParams();
  const deepLinkTaskId = searchParams.get("task")?.trim() || null;
  const createFlag = searchParams.get("create");
  const prefillPo = searchParams.get("po")?.trim() || undefined;
  const prefillType = searchParams.get("type")?.trim() || undefined;
  const prefillScope = searchParams.get("scope")?.trim() || undefined;
  const prefillDeed = searchParams.get("deed")?.trim() || undefined;
  const { showToast } = useToast();

  const { role } = usePrototype();
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = useMemo(() => staffResult?.users ?? [], [staffResult?.users]);
  const { data: poRecords = [] } = usePoRecordsQuery();

  const canCreate = canManageOperationsTasks(role);
  const canRemind = canRemindOperationsTasks(role);

  const reviewerAccount = useMemo(
    () => partyAccountForRole(role, staffUsers),
    [role, staffUsers],
  );

  const { data: tasks = [], isFetched, refetch, isFetching } = useOperationsTasksQuery({
    live: true,
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [scopeFilter, setScopeFilter] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [eyeBlink, setEyeBlink] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(deepLinkTaskId);
  const [detailId, setDetailId] = useState<string | null>(deepLinkTaskId);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [createPrefill, setCreatePrefill] = useState<CreateOperationsTaskPrefill | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [commentFiles, setCommentFiles] = useState<DraftFile[]>([]);
  const [closeText, setCloseText] = useState("");
  const [closeFiles, setCloseFiles] = useState<DraftFile[]>([]);
  const [closeOpen, setCloseOpen] = useState(false);
  const [prioOpen, setPrioOpen] = useState(false);
  const [prioValue, setPrioValue] = useState("medium");
  const [prioEditDue, setPrioEditDue] = useState(false);
  const [prioDueDate, setPrioDueDate] = useState("");
  const [prioDueTime, setPrioDueTime] = useState("12:00");
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignAssigneeId, setReassignAssigneeId] = useState("");
  const [reassignAssigneeName, setReassignAssigneeName] = useState("");
  const [reassignDueDate, setReassignDueDate] = useState("");
  const [reassignDueTime, setReassignDueTime] = useState("12:00");
  const [reassignReason, setReassignReason] = useState("");
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const commentFileInputRef = useRef<HTMLInputElement>(null);
  const closeFileInputRef = useRef<HTMLInputElement>(null);
  const selAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!deepLinkTaskId) return;
    setSelectedId(deepLinkTaskId);
    setDetailId(deepLinkTaskId);
    setShowAll(true);
  }, [deepLinkTaskId]);

  useEffect(() => {
    if (!canCreate) return;
    if (createFlag !== "1" && createFlag !== "true") return;
    setCreatePrefill({
      type: prefillType || "court_visit",
      scope: prefillScope || (prefillType === "court_visit" || !prefillType ? "work_order" : "transaction"),
      poNumber: prefillPo,
      deed: prefillDeed,
    });
    setCreateOpen(true);
  }, [canCreate, createFlag, prefillPo, prefillType, prefillScope, prefillDeed]);

  const kpis = useMemo(() => {
    const created = tasks.filter((t) => t.status === "created").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    return {
      active: created + inProgress,
      created,
      inProgress,
      completed,
    };
  }, [tasks]);

  const visibleTasks = useMemo(() => {
    const q = search.trim();
    const list = tasks.filter((t) => {
      const hay = `${t.title} ${t.assigneeName} ${t.displayId} ${t.poNumber ?? ""} ${t.deeds.join(" ")}`;
      const okQ = !q || hay.includes(q);
      const okS = !statusFilter || t.status === statusFilter;
      const okC = !scopeFilter || t.scope === scopeFilter;
      const okShow = showAll || Boolean(statusFilter) || isActiveOperationsTask(t);
      return okQ && okS && okC && okShow;
    });
    return [...list].sort((a, b) => {
      const rank = (s: string) =>
        s === "paused" ? 1 : isTerminalOperationsTaskStatus(s) ? 2 : 0;
      const ra = rank(a.status);
      const rb = rank(b.status);
      if (ra !== rb) return ra - rb;
      if (ra === 2) return new Date(b.dueAt).getTime() - new Date(a.dueAt).getTime();
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    });
  }, [tasks, search, statusFilter, scopeFilter, showAll]);

  const detail = useMemo(
    () => (detailId ? tasks.find((t) => t.id === detailId) ?? null : null),
    [tasks, detailId],
  );

  const reviewerStaff = useMemo(() => {
    const id = reviewerAccount?.assigneeId?.trim();
    if (!id) return null;
    return staffUsers.find((u) => u.distributionAssigneeId?.trim() === id) ?? null;
  }, [reviewerAccount, staffUsers]);

  const selectedCount = useMemo(
    () => Object.values(selectedIds).filter(Boolean).length,
    [selectedIds],
  );

  const allVisibleActiveChecked = useMemo(() => {
    const active = visibleTasks.filter(isActiveOperationsTask);
    if (active.length === 0) return false;
    return active.every((t) => selectedIds[t.id]);
  }, [visibleTasks, selectedIds]);

  const activeVisible = useMemo(
    () => visibleTasks.filter(isActiveOperationsTask),
    [visibleTasks],
  );
  const selectedActiveCount = useMemo(
    () => activeVisible.filter((t) => selectedIds[t.id]).length,
    [activeVisible, selectedIds],
  );

  useEffect(() => {
    if (!selAllRef.current) return;
    selAllRef.current.indeterminate =
      selectedActiveCount > 0 && selectedActiveCount < activeVisible.length;
  }, [selectedActiveCount, activeVisible.length]);

  const openPriorityModal = useCallback((task: OperationsTask) => {
    setSelectedId(task.id);
    setDetailId(task.id);
    setPrioValue(task.priority);
    setPrioEditDue(false);
    const due = task.dueAt ? new Date(task.dueAt) : null;
    if (due && !Number.isNaN(due.getTime())) {
      setPrioDueDate(toLocalDateValue(due));
      setPrioDueTime(toLocalTimeValue(due));
    } else {
      setPrioDueDate("");
      setPrioDueTime("12:00");
    }
    setPrioOpen(true);
  }, []);

  const openCloseModal = useCallback((task: OperationsTask) => {
    setSelectedId(task.id);
    setDetailId(task.id);
    setCloseText("");
    setCloseFiles([]);
    setCloseOpen(true);
  }, []);

  const applyPrioDueFromOffset = useCallback(() => {
    const ms = PRIORITY_OFFSET_MS[prioValue] ?? PRIORITY_OFFSET_MS.medium;
    const due = new Date(Date.now() + ms!);
    setPrioDueDate(toLocalDateValue(due));
    setPrioDueTime(toLocalTimeValue(due));
  }, [prioValue]);

  const runPatch = useCallback(
    async (id: string, body: Parameters<typeof patchOperationsTaskRecord>[1]) => {
      setBusy(true);
      setError(null);
      const patch = await patchOperationsTaskRecord(id, body);
      if (!patch.ok) {
        setError(patch.error);
        setBusy(false);
        return false;
      }
      await refetch();
      setBusy(false);
      return true;
    },
    [refetch],
  );

  const runStatus = useCallback(
    async (
      id: string,
      status: string,
      closeComment?: string,
      files?: DraftFile[],
    ) => {
      if (
        status === "completed" &&
        (closeComment?.trim() || (files && files.length > 0))
      ) {
        setBusy(true);
        const commentRes = await addOperationsTaskCommentRecord(
          id,
          closeComment?.trim() ?? "",
          "close",
          files,
        );
        if (!commentRes.ok) {
          setError(commentRes.error);
          setBusy(false);
          return;
        }
      }
      const ok = await runPatch(id, { status });
      if (!ok) return;
      setCloseOpen(false);
      setCloseText("");
      setCloseFiles([]);
    },
    [runPatch],
  );

  const applyPriority = useCallback(
    async (id: string) => {
      const body: Parameters<typeof patchOperationsTaskRecord>[1] = {
        priority: prioValue,
      };
      if (prioEditDue && prioDueDate.trim()) {
        const [y, mo, da] = prioDueDate.split("-").map(Number);
        const [hh, mm] = (prioDueTime || "12:00").split(":").map(Number);
        const dueAt = new Date(y!, (mo ?? 1) - 1, da ?? 1, hh ?? 12, mm ?? 0);
        body.dueAtUtc = dueAt.toISOString();
      }
      const ok = await runPatch(id, body);
      if (ok) {
        setPrioOpen(false);
        setPrioEditDue(false);
        showToast("تم تحديث المهمة", "success");
      }
    },
    [prioValue, prioEditDue, prioDueDate, prioDueTime, runPatch, showToast],
  );

  const remindTask = useCallback(
    async (task: OperationsTask) => {
      if (!isActiveOperationsTask(task)) return;
      setBusy(true);
      const res = await remindOperationsTaskRecord(task.id);
      setBusy(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      showToast(`أُرسل تذكير إلى ${task.assigneeName || "المنفّذ"}`, "info");
      await refetch();
    },
    [showToast, refetch],
  );

  const bulkRemind = useCallback(async () => {
    const ids = Object.entries(selectedIds)
      .filter(([, on]) => on)
      .map(([id]) => id);
    let n = 0;
    setBusy(true);
    for (const id of ids) {
      const task = tasks.find((t) => t.id === id);
      if (!task || !isActiveOperationsTask(task)) continue;
      const res = await remindOperationsTaskRecord(id);
      if (res.ok) n += 1;
    }
    setBusy(false);
    setSelectedIds({});
    showToast(n ? `تم تذكير ${n} مهمة` : "لا مهام قابلة للتذكير", "info");
    await refetch();
  }, [selectedIds, tasks, showToast, refetch]);

  const openReassign = useCallback((task: OperationsTask) => {
    setSelectedId(task.id);
    setDetailId(task.id);
    setReassignAssigneeId(task.assigneeId || "");
    setReassignAssigneeName(task.assigneeName || "");
    const due = task.dueAt ? new Date(task.dueAt) : null;
    if (due && !Number.isNaN(due.getTime())) {
      setReassignDueDate(toLocalDateValue(due));
      setReassignDueTime(toLocalTimeValue(due));
    } else {
      setReassignDueDate("");
      setReassignDueTime("12:00");
    }
    setReassignReason("");
    setReassignError(null);
    setReassignOpen(true);
  }, []);

  const submitReassign = useCallback(async () => {
    const taskId = selectedId ?? detailId;
    if (!taskId) return;
    if (!reassignAssigneeId.trim()) {
      setReassignError("اختر المنفّذ.");
      return;
    }
    if (!reassignReason.trim()) {
      setReassignError("سبب إعادة التوجيه مطلوب.");
      return;
    }
    if (!reassignDueDate.trim()) {
      setReassignError("حدد موعد الاستحقاق.");
      return;
    }
    const [y, mo, da] = reassignDueDate.split("-").map(Number);
    const [hh, mm] = (reassignDueTime || "12:00").split(":").map(Number);
    const due = new Date(y, (mo ?? 1) - 1, da ?? 1, hh ?? 12, mm ?? 0, 0, 0);
    setBusy(true);
    setReassignError(null);
    const res = await reassignOperationsTaskRecord(taskId, {
      assigneeId: reassignAssigneeId.trim(),
      assigneeName: reassignAssigneeName.trim() || undefined,
      dueAtUtc: due.toISOString(),
      reason: reassignReason.trim(),
    });
    setBusy(false);
    if (!res.ok) {
      setReassignError(res.error);
      return;
    }
    setReassignOpen(false);
    setReassignReason("");
    showToast("تم إعادة التوجيه والإسناد", "success");
    await refetch();
  }, [
    selectedId,
    detailId,
    reassignAssigneeId,
    reassignAssigneeName,
    reassignDueDate,
    reassignDueTime,
    reassignReason,
    showToast,
    refetch,
  ]);

  const reassignTask = useMemo(() => {
    const id = selectedId ?? detailId;
    return id ? tasks.find((t) => t.id === id) ?? null : null;
  }, [tasks, selectedId, detailId]);

  const reassignAssignees = useMemo(
    () =>
      reassignTask
        ? assigneesForType(reassignTask.type, staffUsers)
        : [],
    [reassignTask, staffUsers],
  );

  const rowMenu = useCallback(
    (task: OperationsTask): RowMoreMenuItem[] => {
      const items: RowMoreMenuItem[] = [
        {
          id: "detail",
          label: "عرض التفاصيل",
          onClick: () => setDetailId(task.id),
        },
      ];
      if (task.status === "created") {
        items.push({
          id: "start",
          label: "بدء التنفيذ",
          onClick: () => void runStatus(task.id, "in_progress"),
        });
      }
      if (task.status === "in_progress") {
        items.push({
          id: "complete",
          label: "إغلاق المهمة (إكمال)",
          onClick: () => openCloseModal(task),
        });
      }
      if (canCreate && (task.status === "created" || task.status === "in_progress")) {
        items.push({
          id: "pause",
          label: "إيقاف مؤقت",
          onClick: () => void runStatus(task.id, "paused"),
        });
      }
      if (canCreate && task.status === "paused") {
        items.push({
          id: "resume",
          label: "استئناف المهمة",
          onClick: () => void runStatus(task.id, "in_progress"),
        });
      }
      if (task.type === "court_visit" && task.letterRows.length > 0) {
        items.push({
          id: "letter",
          label: "عرض خطاب التفويض",
          onClick: () => setDetailId(task.id),
        });
      }
      if (canRemind && isActiveOperationsTask(task)) {
        items.push({
          id: "remind",
          label: "تذكير المنفّذ",
          onClick: () => void remindTask(task),
        });
        if (canCreate) {
          items.push({
            id: "reassign",
            label: "إعادة توجيه وإسناد",
            onClick: () => openReassign(task),
          });
          items.push({
            id: "prio",
            label: "تغيير الأولوية",
            onClick: () => openPriorityModal(task),
          });
        }
      } else if (canCreate && isActiveOperationsTask(task)) {
        items.push({
          id: "reassign",
          label: "إعادة توجيه وإسناد",
          onClick: () => openReassign(task),
        });
        items.push({
          id: "prio",
          label: "تغيير الأولوية",
          onClick: () => openPriorityModal(task),
        });
      }
      if (canCreate && !isTerminalOperationsTask(task)) {
        items.push({
          id: "cancel",
          label: "إلغاء المهمة",
          danger: true,
          onClick: () => void runStatus(task.id, "cancelled"),
        });
      }
      return items;
    },
    [canCreate, canRemind, runStatus, remindTask, openReassign, openCloseModal, openPriorityModal],
  );

  const isAssignee =
    Boolean(detail) &&
    (canCreate || detail?.assigneeId === reviewerAccount?.assigneeId);

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
      <PageShell variant="canvas" className="gap-0 p-4 sm:p-6">
        <button
          type="button"
          className={opsBackLink}
          onClick={() => setDetailId(null)}
        >
          <BackChevron />
          <span>المهام</span>
        </button>

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
              <div className={opsPpCellV}>{detail.createdByName || detail.createdBy}</div>
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
                <span dir="ltr" className="font-bold">
                  {taskCountdown(detail.dueAt, detail.status, now).txt}
                </span>
                <span className="mt-0.5 block text-[11px] font-medium text-text-3">
                  {formatTaskDueLabel(detail.dueAt)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {detail.description ? (
          <div className={opsTaskDesc}>{detail.description}</div>
        ) : null}

        {isActiveOperationsTask(detail) ? (
          <div className={opsRemindCard}>
            <div className="flex items-center gap-3">
              <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[10px] bg-[color-mix(in_srgb,var(--gold)_18%,transparent)] text-gold-d">
                <BellIcon size={19} />
              </span>
              <div>
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
                    {remindCountdownLabelForTask(detail, now)}
                  </span>
                  {nSent ? ` · أُرسل ${nSent} تذكير` : ""}
                </div>
              </div>
            </div>
            {canRemind ? (
            <button
              type="button"
              className={opsRemindBtn}
              disabled={busy}
              onClick={() => void remindTask(detail)}
            >
              <BellIcon size={15} />
              <span>تذكير الآن</span>
            </button>
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
              <span className="text-xs font-bold text-text-2">
                الرقم المرجعي:{" "}
                <span dir="ltr" className="text-gold-d">
                  {detail.reference || "—"}
                </span>
              </span>
            </div>
            <div className="px-[18px] py-4">
              <LetterTable rows={detail.letterRows} />
              <p className="mx-0.5 mt-3 text-[11.5px] text-text-3">
                الترميز المرجعي الموحّد + snapshot للبيانات وقت الإصدار — يُطبع على
                الترويسة الرسمية.
              </p>
            </div>
          </div>
        ) : null}

        <div className={opsTfActions}>
          {detail.status === "created" && isAssignee ? (
            <button
              type="button"
              className={opsBtnPrimary}
              disabled={busy}
              onClick={() => void runStatus(detail.id, "in_progress")}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>بدء التنفيذ</span>
            </button>
          ) : null}
          {detail.status === "in_progress" && isAssignee ? (
            <button
              type="button"
              className={opsBtnPrimary}
              disabled={busy}
              onClick={() => openCloseModal(detail)}
            >
              إغلاق المهمة (إكمال)
            </button>
          ) : null}
          {canCreate &&
          (detail.status === "created" || detail.status === "in_progress") ? (
            <button
              type="button"
              className={opsBtnGhost}
              disabled={busy}
              onClick={() => void runStatus(detail.id, "paused")}
            >
              إيقاف مؤقت
            </button>
          ) : null}
          {canCreate && detail.status === "paused" ? (
            <button
              type="button"
              className={opsBtnPrimary}
              disabled={busy}
              onClick={() => void runStatus(detail.id, "in_progress")}
            >
              استئناف المهمة
            </button>
          ) : null}
          {detail.type === "court_visit" && detail.letterRows.length > 0 ? (
            <button
              type="button"
              className={opsBtnGhost}
              onClick={() =>
                printOperationsTaskDelegationLetter(
                  detail,
                  agentInfoFromStaff(reviewerStaff),
                )
              }
            >
              طباعة خطاب التفويض
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
          {canCreate && !isTerminalOperationsTask(detail) ? (
            <button
              type="button"
              className={opsBtnGhost}
              className="text-[#c0553d]"
              disabled={busy}
              onClick={() => void runStatus(detail.id, "cancelled")}
            >
              إلغاء المهمة
            </button>
          ) : null}
        </div>

        <CommentThread
          task={detail}
          staffUsers={staffUsers}
          commentText={commentText}
          setCommentText={setCommentText}
          draftFiles={commentFiles}
          setDraftFiles={setCommentFiles}
          fileInputRef={commentFileInputRef}
          busy={busy}
          onSend={() => {
            void (async () => {
              if (!commentText.trim() && commentFiles.length === 0) return;
              setBusy(true);
              const res = await addOperationsTaskCommentRecord(
                detail.id,
                commentText.trim(),
                undefined,
                commentFiles.length ? commentFiles : undefined,
              );
              setBusy(false);
              if (!res.ok) {
                setError(res.error);
                return;
              }
              setCommentText("");
              setCommentFiles([]);
              await refetch();
            })();
          }}
        />

        <AppModal open={closeOpen} title="إغلاق المهمة" onClose={() => setCloseOpen(false)}>
          <CloseTaskModalBody
            closeText={closeText}
            setCloseText={setCloseText}
            closeFiles={closeFiles}
            setCloseFiles={setCloseFiles}
            fileInputRef={closeFileInputRef}
            busy={busy}
            onCancel={() => setCloseOpen(false)}
            onConfirm={() =>
              void runStatus(detail.id, "completed", closeText, closeFiles)
            }
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

        <AppModal
          open={reassignOpen}
          title="إعادة توجيه وإسناد"
          wide
          onClose={() => setReassignOpen(false)}
        >
          <div className="flex flex-col gap-3.5">
            {reassignError ? <Note tone="danger">{reassignError}</Note> : null}
            <label className="flex flex-col gap-1.5">
              <span className={opsTfLbl}>مُسندة إلى *</span>
              <Select
                value={reassignAssigneeId}
                onChange={(e) => {
                  const id = e.target.value;
                  setReassignAssigneeId(id);
                  setReassignAssigneeName(
                    reassignAssignees.find((a) => a.id === id)?.name ?? "",
                  );
                }}
              >
                {reassignAssignees.length === 0 ? (
                  <option value="">لا يوجد منفّذون</option>
                ) : (
                  reassignAssignees.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.subtitle ? ` — ${a.subtitle}` : ""}
                    </option>
                  ))
                )}
              </Select>
            </label>
            <div>
              <span className={opsTfLbl}>
                موعد الاستحقاق *{" "}
                <span className="font-medium text-text-3">(يوم + ساعة)</span>
              </span>
              <div className="mt-1.5 flex flex-wrap gap-2.5">
                <Input
                  type="date"
                  value={reassignDueDate}
                  onChange={(e) => setReassignDueDate(e.target.value)}
                  className="max-w-[190px]"
                />
                <Input
                  type="time"
                  value={reassignDueTime}
                  onChange={(e) => setReassignDueTime(e.target.value)}
                  className="max-w-[150px]"
                />
              </div>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className={opsTfLbl}>سبب إعادة التوجيه *</span>
              <Textarea
                value={reassignReason}
                onChange={(e) => setReassignReason(e.target.value)}
                rows={3}
                placeholder="اذكر سبب إعادة التوجيه والإسناد…"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={opsBtnGhost}
                onClick={() => setReassignOpen(false)}
              >
                إلغاء
              </button>
              <button
                type="button"
                className={opsBtnPrimary}
                disabled={busy}
                onClick={() => void submitReassign()}
              >
                حفظ
              </button>
            </div>
          </div>
        </AppModal>
      </PageShell>
    );
  }

  return (
    <PageShell variant="canvas" className="gap-3.5 p-4 sm:gap-3.5 sm:p-6">
      <KpiBand className="mb-0 shrink-0 !rounded-[12px]">
        <KpiCell
          first
          icon={<TypeIcon type="general" size={17} />}
          iconClass="bg-gold-soft text-gold-d"
          label="مهام نشطة"
          value={kpis.active}
          sub="قيد الإسناد والتنفيذ"
          dot
        />
        <KpiCell
          icon={
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4" />
            </svg>
          }
          iconClass="bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] text-ink"
          label="منشأة"
          value={kpis.created}
          sub="بانتظار البدء"
        />
        <KpiCell
          icon={
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          }
          iconClass="bg-[color-mix(in_srgb,#d9a441_20%,transparent)] text-[#8a5e14]"
          label="قيد التنفيذ"
          value={kpis.inProgress}
          sub="جارية الآن"
        />
        <KpiCell
          last
          icon={
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <path d="m9 11 3 3L22 4" />
            </svg>
          }
          iconClass="bg-[color-mix(in_srgb,#3f8f5f_16%,transparent)] text-[#2f7a4d]"
          label="مكتملة"
          value={kpis.completed}
          sub="أُنجزت مؤخراً"
        />
      </KpiBand>

      <div className={opsToolbar}>
        <div className={cn(opsFilters, "flex-1")}>
          <OperationalToolbarSearch
            type="search"
            placeholder="عنوان المهمة أو المنفّذ أو رقم الصك…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="بحث المهام"
          />
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
          <button
            type="button"
            className={cn(
              showAll ? opsShowAllBtnOn : opsShowAllBtn,
              "show-all-btn-motion",
            )}
            onClick={() => {
              setShowAll((v) => {
                const next = !v;
                if (next) {
                  setEyeBlink(true);
                  window.setTimeout(() => setEyeBlink(false), 420);
                }
                return next;
              });
            }}
          >
            <EyeIcon open={showAll} blink={eyeBlink} />
            <span>{showAll ? "النشطة فقط" : "إظهار جميع المهام"}</span>
          </button>
          <span className={opsListCount}>
            {visibleTasks.length} مهمة
          </span>
        </div>
        {canCreate ? (
          <OperationalToolbarPrimaryButton
            className="ms-3"
            onClick={() => {
              setCreatePrefill(null);
              setCreateOpen(true);
            }}
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
            disabled={busy}
            onClick={() => void bulkRemind()}
          >
            <BellIcon size={15} />
            <span>تذكير المحدد دفعة واحدة</span>
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

      <OperationalPanel className="min-h-0 flex-1 overflow-hidden !rounded-[12px] p-0">
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div className={opsThead} style={{ gridTemplateColumns: COLS }}>
              <div className={cn(opsTh, opsTdC)}>
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
              </div>
              {[
                "المهمة",
                "النطاق / الربط",
                "المنفّذ",
                "الاستحقاق",
                "الحالة",
                "إجراءات",
              ].map((h) => (
                <div key={h} className={cn(opsTh, h === "إجراءات" && opsTdC)}>
                  {h}
                </div>
              ))}
            </div>

            {visibleTasks.length === 0 ? (
              <div className="px-4 py-11 text-center text-[13.5px] text-text-3">
                <div>لا توجد مهام مطابقة.</div>
              </div>
            ) : (
              visibleTasks.map((task) => {
                const prColor =
                  OPERATIONS_TASK_PRIORITY_COLORS[task.priority] ?? "#8a8d96";
                return (
                  <div
                    key={task.id}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      opsGridRow,
                      selectedId === task.id && opsGridRowOn,
                    )}
                    style={{ gridTemplateColumns: COLS }}
                    onClick={() => {
                      setSelectedId(task.id);
                      setDetailId(task.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setDetailId(task.id);
                      }
                    }}
                  >
                    <div
                      className={cn(opsTd, opsTdC)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isActiveOperationsTask(task) ? (
                        <label className={opsTkCheck}>
                          <input
                            type="checkbox"
                            className={opsTkCheckInput}
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
                          />
                        </label>
                      ) : null}
                    </div>
                    <div className={opsTd}>
                      <div className="flex min-w-0 items-center gap-[11px]">
                        <span className={opsTypeIconSm}>
                          <TypeIcon type={task.type} size={15} />
                        </span>
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className={opsRowTitle}>{task.title}</span>
                          <span className={opsRowMeta}>
                            <span dir="ltr">{task.displayId}</span>
                            <span>·</span>
                            <span>{operationsTaskTypeLabel(task.type)}</span>
                            <span>·</span>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                                color: prColor,
                                fontWeight: 700,
                              }}
                            >
                              <span
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: "50%",
                                  background: prColor,
                                }}
                              />
                              {operationsTaskPriorityLabel(task.priority)}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className={opsTd}>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-[13px] font-semibold text-text">
                          {operationsTaskScopeLabel(task.scope)}
                        </span>
                        <span dir="ltr" className="text-[11.5px] text-text-3">
                          {operationsTaskLinkLabel(task)}
                        </span>
                      </div>
                    </div>
                    <div className={opsTd}>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-[13px] font-semibold text-heading">
                          {task.assigneeName || task.assigneeId}
                        </span>
                        <span className="text-[11.5px] text-text-3">
                          {assigneeRoleLabel(staffUsers, task.assigneeId)}
                        </span>
                      </div>
                    </div>
                    <div className={opsTd}>
                      <DueCell task={task} now={now} />
                    </div>
                    <div className={opsTd}>
                      <TaskStatusPill status={task.status} />
                    </div>
                    <div
                      className={opsTd}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex w-full items-center justify-center gap-0.5">
                        {canRemind && isActiveOperationsTask(task) ? (
                          <button
                            type="button"
                            className={opsRemindMini}
                            title="تذكير المنفّذ"
                            aria-label="تذكير"
                            onClick={() => void remindTask(task)}
                          >
                            <BellIcon size={16} />
                          </button>
                        ) : null}
                        <RowMoreMenu items={rowMenu(task)} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="border-t border-border px-4 py-[11px] text-xs text-text-3">
          اضغط الصف لعرض تفاصيل المهمة. المراجعة الحكومية وخطاب التفويض حالتان من
          هذه الطبقة.
        </div>
      </OperationalPanel>

      <CreateOperationsTaskModal
        open={createOpen}
        poRecords={poRecords}
        staffUsers={staffUsers}
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

      <AppModal open={closeOpen} title="إغلاق المهمة" onClose={() => setCloseOpen(false)}>
        <CloseTaskModalBody
          closeText={closeText}
          setCloseText={setCloseText}
          closeFiles={closeFiles}
          setCloseFiles={setCloseFiles}
          fileInputRef={closeFileInputRef}
          busy={busy}
          onCancel={() => setCloseOpen(false)}
          onConfirm={() => {
            if (!selectedId) return;
            void runStatus(selectedId, "completed", closeText, closeFiles);
          }}
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

      <AppModal
        open={reassignOpen}
        title="إعادة توجيه وإسناد"
        wide
        onClose={() => setReassignOpen(false)}
      >
        <div className="flex flex-col gap-3.5">
          {reassignError ? <Note tone="danger">{reassignError}</Note> : null}
          <label className="flex flex-col gap-1.5">
            <span className={opsTfLbl}>مُسندة إلى *</span>
            <Select
              value={reassignAssigneeId}
              onChange={(e) => {
                const id = e.target.value;
                setReassignAssigneeId(id);
                setReassignAssigneeName(
                  reassignAssignees.find((a) => a.id === id)?.name ?? "",
                );
              }}
            >
              {reassignAssignees.length === 0 ? (
                <option value="">لا يوجد منفّذون</option>
              ) : (
                reassignAssignees.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.subtitle ? ` — ${a.subtitle}` : ""}
                  </option>
                ))
              )}
            </Select>
          </label>
          <div>
            <span className={opsTfLbl}>
              موعد الاستحقاق *{" "}
              <span className="font-medium text-text-3">(يوم + ساعة)</span>
            </span>
            <div className="mt-1.5 flex flex-wrap gap-2.5">
              <Input
                type="date"
                value={reassignDueDate}
                onChange={(e) => setReassignDueDate(e.target.value)}
                className="max-w-[190px]"
              />
              <Input
                type="time"
                value={reassignDueTime}
                onChange={(e) => setReassignDueTime(e.target.value)}
                className="max-w-[150px]"
              />
            </div>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className={opsTfLbl}>سبب إعادة التوجيه *</span>
            <Textarea
              value={reassignReason}
              onChange={(e) => setReassignReason(e.target.value)}
              rows={3}
              placeholder="اذكر سبب إعادة التوجيه والإسناد…"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={opsBtnGhost}
              onClick={() => setReassignOpen(false)}
            >
              إلغاء
            </button>
            <button
              type="button"
              className={opsBtnPrimary}
              disabled={busy}
              onClick={() => void submitReassign()}
            >
              حفظ
            </button>
          </div>
        </div>
      </AppModal>
    </PageShell>
  );
}
