"use client";

/**
 * Operations-tasks screen — the small parts every region shares: icons, draft
 * attachment helpers, status pill, due countdown cell and the stepper. Region
 * files (`OperationsTasksDetailPanel`, `OperationsTasksTable`, the modals…)
 * compose these; nothing here owns workflow.
 */

import { type RefObject } from "react";
import { StatusPill, cn } from "@platform/ui-kit";
import { pad2 } from "@platform/app-shared/format/date";
import { useTickingNow } from "@platform/app-shared/hooks/use-ticking-now";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import {
  isActiveOperationsTask,
  type OperationsTask,
} from "../lib/app-data/operations-tasks-model";
import {
  OPERATIONS_TASK_STATUS_COLORS,
  OPERATIONS_TASK_TYPE_ICON_PATHS,
  TASK_STEPPER_STEPS,
  formatTaskDueLabel,
  operationsTaskStatusLabel,
  remindCountdownLabelForTask,
  taskCountdown,
  taskStepperIndex,
  taskUrgency,
} from "../lib/app-data/operations-task-display";
import { type DistributionAssignee } from "../lib/app-data/distribution-parties";
import { assigneesForOperationsTaskType } from "../lib/app-data/operations-task-assignees";
import { uploadTaskScopedAttachment } from "@platform/app-shared/app-data/task-attachments-api";
import {
  opsCdDot,
  opsCdTip,
  opsCdWrap,
  opsCmtFiles,
  opsDueCd,
  opsDueCdOver,
  opsFileSize,
  opsFileChip,
  opsFileChipFx,
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
} from "../lib/app-data/ops-tasks-tw";
import type { useOperationsTasksWorkflow } from "./useOperationsTasksWorkflow";

/** The bag `useOperationsTasksWorkflow` returns — region components `Pick` from it. */
export type OperationsTasksWorkflow = ReturnType<typeof useOperationsTasksWorkflow>;

export const PRIORITY_OFFSET_MS: Record<string, number> = {
  high: 4 * 3_600_000,
  medium: 12 * 3_600_000,
  low: 24 * 3_600_000,
};

function fmtFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type DraftFile = {
  name: string;
  size: string;
  file?: File;
  attachmentId?: string;
  contentType?: string;
};

export function filesFromList(list: FileList | null): DraftFile[] {
  if (!list) return [];
  return Array.from(list).map((f) => ({ name: f.name, size: fmtFileSize(f.size), file: f }));
}

const OPS_COMMENT_ATTACHMENT_SCOPE = "operations-task-comment";

/** Uploads any draft files that still hold a raw File (not yet persisted) and
 * returns the plain attachment payload to send with the comment. */
export async function uploadDraftFiles(
  taskId: string,
  files: DraftFile[],
): Promise<{ name: string; size: string; attachmentId?: string | null; contentType?: string | null }[]> {
  return Promise.all(
    files.map(async (f) => {
      if (f.attachmentId || !f.file) {
        return {
          name: f.name,
          size: f.size,
          attachmentId: f.attachmentId ?? null,
          contentType: f.contentType ?? null,
        };
      }
      const scopeKey = `${taskId}:${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      const uploaded = await uploadTaskScopedAttachment(OPS_COMMENT_ATTACHMENT_SCOPE, scopeKey, f.file);
      return {
        name: f.name,
        size: f.size,
        attachmentId: uploaded?.attachmentId ?? null,
        contentType: uploaded?.mimeType ?? f.file.type ?? null,
      };
    }),
  );
}

export function TypeIcon({ type, size = 15 }: { type: string; size?: number }) {
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

export function BellIcon({ size = 16 }: { size?: number }) {
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

export function FlagIcon({ size = 15 }: { size?: number }) {
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

export function PaperclipIcon() {
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

export function PlusIcon() {
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

export function PauseIcon() {
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
      className="-my-0.5 me-1.5"
    >
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

export function DraftFileChips({
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

/** Hidden `<input type="file">` bound to a ref — the attach buttons click it. */
export function DraftFileInput({
  fileInputRef,
  setFiles,
}: {
  fileInputRef: RefObject<HTMLInputElement | null>;
  setFiles: (v: DraftFile[] | ((prev: DraftFile[]) => DraftFile[])) => void;
}) {
  return (
    <input
      ref={fileInputRef}
      type="file"
      multiple
      hidden
      onChange={(e) => {
        const next = filesFromList(e.target.files);
        if (next.length) setFiles((prev) => [...prev, ...next]);
        e.target.value = "";
      }}
    />
  );
}

export function toLocalDateValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function toLocalTimeValue(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function assigneesForType(
  type: string,
  staffUsers: StaffUser[],
): DistributionAssignee[] {
  return assigneesForOperationsTaskType(type, staffUsers);
}

export function assigneeRoleLabel(staffUsers: StaffUser[], assigneeId: string): string {
  const id = assigneeId.trim();
  if (!id) return "منفّذ";
  const u = staffUsers.find((s) => s.distributionAssigneeId?.trim() === id);
  return u?.role?.trim() || "منفّذ";
}

function statusPillStyle(status: string) {
  const color = OPERATIONS_TASK_STATUS_COLORS[status] ?? "#8a8d96";
  return { base: color, fg: color };
}

export function TaskStatusPill({ status }: { status: string }) {
  return (
    <StatusPill
      label={operationsTaskStatusLabel(status)}
      style={statusPillStyle(status)}
    />
  );
}

// Timer subscribes to the clock itself — the screen rebuilds at minute precision only (rerender-defer-reads).
export function DueCell({ task }: { task: OperationsTask }) {
  const now = useTickingNow();
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
        className={cn(
          opsCdDot,
          urgency?.pulse &&
            "animate-[ops-pulse-fade_1.4s_ease-in-out_infinite] after:absolute after:inset-0 after:animate-[ops-pulse-ring_1.6s_ease-out_infinite] after:rounded-full after:bg-inherit motion-reduce:animate-none motion-reduce:after:animate-none",
        )}
        style={{ background: urgency?.color ?? "#3f8f5f" }}
        aria-hidden
      />
      {/* Keep Arabic overdue labels in one LTR-neutral run so the marker stays
          flush with the start edge of the column (matches header). */}
      <span className={cd.over ? opsDueCdOver : opsDueCd}>{cd.txt}</span>
      <span className={opsCdTip}>
        <span
          className="absolute top-full start-3.5 border-[5px] border-solid border-transparent border-t-ink"
          aria-hidden
        />
        الاستحقاق: {formatTaskDueLabel(task.dueAt)}
      </span>
    </div>
  );
}

/** «Next reminder in …» countdown — sheet subscribes to the clock instead of refreshing the whole detail panel every second. */
export function TickingRemindCountdown({ task }: { task: OperationsTask }) {
  const now = useTickingNow();
  return <>{remindCountdownLabelForTask(task, now)}</>;
}

export function TaskStepper({ status }: { status: string }) {
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
  const allDone = status === "completed";
  return (
    <div className={opsStepFlow}>
      {TASK_STEPPER_STEPS.map((step, i) => {
        const done = allDone || (idx != null && i < idx);
        const current = !allDone && idx != null && i === idx;
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
