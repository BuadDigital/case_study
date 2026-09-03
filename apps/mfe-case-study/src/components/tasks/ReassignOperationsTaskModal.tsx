"use client";

import {
  AppModal,
  Note,
  Spinner,
} from "@platform/ui-kit";
import {
  opsBtnGhost,
  opsBtnPrimary,
  opsFldControl,
  opsFldTextarea,
  opsTfLbl,
} from "../../lib/app-data/ops-tasks-tw";
import type { DistributionAssignee } from "../../lib/app-data/distribution-parties";

function ArrowRightIcon() {
  return (
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
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/** Redirect and reassign an operations task — matches Case Study.html `openReassignModal`. */
export function ReassignOperationsTaskModal({
  open,
  currentAssigneeName,
  currentAssigneeRole,
  assignees,
  assigneeId,
  dueDate,
  dueTime,
  reason,
  error,
  busy,
  onAssigneeChange,
  onDueDateChange,
  onDueTimeChange,
  onReasonChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  currentAssigneeName: string;
  currentAssigneeRole?: string;
  assignees: DistributionAssignee[];
  assigneeId: string;
  dueDate: string;
  dueTime: string;
  reason: string;
  error: string | null;
  busy?: boolean;
  onAssigneeChange: (id: string, name: string) => void;
  onDueDateChange: (value: string) => void;
  onDueTimeChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <AppModal
      open={open}
      title="إعادة توجيه وإسناد المهمة"
      subtitle="أعد إسناد المهمة إلى منفّذ آخر مع ضبط موعد التسليم وذكر السبب"
      onClose={onClose}
      maxWidthPx={520}
      look="ops-html"
      footer={
        <div className="flex w-full justify-end gap-2.5">
          <button
            type="button"
            className={opsBtnGhost}
            onClick={onClose}
            disabled={busy}
          >
            إلغاء
          </button>
          <button
            type="button"
            className={opsBtnPrimary}
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={onSubmit}
          >
            {busy ? <Spinner /> : <ArrowRightIcon />}
            <span>{busy ? "جاري إعادة التوجيه…" : "إعادة التوجيه"}</span>
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-0">
        {error ? (
          <Note tone="danger" className="mb-3">
            {error}
          </Note>
        ) : null}

        <p className="mb-3 text-[12.5px] text-text-2">
          المنفّذ الحالي:{" "}
          <b className="font-bold text-heading">
            {currentAssigneeName.trim() || "—"}
          </b>
          {currentAssigneeRole?.trim() ? (
            <> — {currentAssigneeRole.trim()}</>
          ) : null}
        </p>

        <label className="block">
          <span className={opsTfLbl}>إسناد إلى *</span>
          <select
            className={opsFldControl}
            value={assigneeId}
            onChange={(e) => {
              const id = e.target.value;
              const name = assignees.find((a) => a.id === id)?.name ?? "";
              onAssigneeChange(id, name);
            }}
          >
            {assignees.length === 0 ? (
              <option value="">لا يوجد منفّذون</option>
            ) : (
              assignees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.subtitle ? ` — ${a.subtitle}` : ""}
                </option>
              ))
            )}
          </select>
        </label>

        <div className="mt-3.5">
          <span className={opsTfLbl}>موعد التسليم</span>
          <div className="flex flex-wrap gap-2.5">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => onDueDateChange(e.target.value)}
              className={`${opsFldControl} max-w-[180px]`}
            />
            <input
              type="time"
              value={dueTime}
              onChange={(e) => onDueTimeChange(e.target.value)}
              className={`${opsFldControl} max-w-[140px]`}
            />
          </div>
        </div>

        <label className="mt-3.5 block">
          <span className={opsTfLbl}>سبب التوجيه *</span>
          <textarea
            className={opsFldTextarea}
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            rows={2}
            placeholder="مثال: المنفّذ الحالي في مهمة عاجلة أخرى…"
          />
        </label>
      </div>
    </AppModal>
  );
}
