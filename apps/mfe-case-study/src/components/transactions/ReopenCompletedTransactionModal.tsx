"use client";

import { useState } from "react";
import { Note, Spinner, cn } from "@platform/ui-kit";
import { AppModal } from "../ui/AppModal";
import {
  opsBtnGhost,
  opsFldTextarea,
  opsTfLbl,
} from "../../lib/prototype/ops-tasks-tw";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";

function LockOpenIcon({ size = 20 }: { size?: number }) {
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
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  );
}

function WarnTriangleIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

/** إعادة فتح معاملة مكتملة — مطابقة Case Study.html `openReopenModal`. */
export function ReopenCompletedTransactionModal({
  open,
  task,
  deedLabel,
  onClose,
  onConfirm,
}: {
  open: boolean;
  task: WorkflowTask | null;
  /** رقم الصك المعروض في وصف المودال (من صف جميع المعاملات). */
  deedLabel?: string;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}) {
  if (!open || !task) return null;
  return (
    <ReopenCompletedTransactionForm
      task={task}
      deedLabel={deedLabel}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

function ReopenCompletedTransactionForm({
  task,
  deedLabel,
  onClose,
  onConfirm,
}: {
  task: WorkflowTask;
  deedLabel?: string;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  const deed = (deedLabel ?? "").trim();
  const subtitleNode = (
    <>
      إعادة فتح المعاملة المكتملة{" "}
      {deed ? (
        <span dir="ltr" className="font-bold text-gold-d">
          صك {deed}
        </span>
      ) : (
        <span className="font-bold text-heading">
          {task.title}
          {task.poNumber ? ` · ${task.poNumber}` : ""}
        </span>
      )}{" "}
      لإكمال بعض النواقص أو التعديل عليها. ستعود المعاملة إلى حالة «قيد العمل».
    </>
  );

  const submit = async () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError(true);
      return;
    }
    setBusy(true);
    try {
      await onConfirm(trimmed);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppModal
      open
      title="فتح المعاملة"
      subtitle={subtitleNode}
      headerIcon={
        <span className="grid size-10 place-items-center rounded-[10px] bg-[color-mix(in_srgb,#d9694f_14%,transparent)] text-[#c0553d]">
          <LockOpenIcon />
        </span>
      }
      onClose={onClose}
      maxWidthPx={470}
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
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={() => void submit()}
            className={cn(
              "inline-flex min-h-11 items-center gap-[7px] rounded-lg border-none bg-[#c0553d] px-4 py-2.5 font-[inherit] text-[13px] font-bold text-white transition-colors",
              "enabled:hover:bg-[#a5432e] disabled:cursor-not-allowed disabled:opacity-55",
            )}
          >
            {busy ? <Spinner /> : <LockOpenIcon size={16} />}
            <span>{busy ? "جاري الفتح…" : "فتح المعاملة"}</span>
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-0">
        <div className="flex items-start gap-[9px] rounded-[10px] bg-[color-mix(in_srgb,#d9a441_12%,transparent)] px-[13px] py-[11px]">
          <span className="mt-px shrink-0 text-[#a67c1a]">
            <WarnTriangleIcon />
          </span>
          <span className="text-[11.5px] font-semibold leading-[1.6] text-[#8a6a18]">
            هذا الإجراء يتطلب صلاحية من مستوى عالٍ (مشرف دراسة الحالة فأعلى)
            وسيُسجَّل في سجل التدقيق.
          </span>
        </div>

        <label className="mt-3.5 block">
          <span className={opsTfLbl}>سبب إعادة الفتح</span>
          <textarea
            className={cn(opsFldTextarea, error && "border-danger")}
            rows={2}
            value={reason}
            placeholder="مثال: استكمال صورة المعاينة المفقودة"
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(false);
            }}
          />
        </label>
        {error ? (
          <Note tone="danger" className="mt-2">
            سبب إعادة الفتح إلزامي.
          </Note>
        ) : null}
      </div>
    </AppModal>
  );
}
