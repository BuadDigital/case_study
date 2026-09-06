"use client";

/** Operations-tasks pause and change-priority modal bodies. */

import { Input, Note, Spinner, Textarea } from "@platform/ui-kit";
import type { OperationsTask } from "../lib/app-data/operations-tasks-model";
import {
  OPERATIONS_TASK_PRIORITY_COLORS,
  OPERATIONS_TASK_PRIORITY_LABELS,
  OPERATIONS_TASK_REMIND_LABELS,
  operationsTaskPriorityLabel,
} from "../lib/app-data/operations-task-display";
import {
  opsBtnGhost,
  opsBtnPrimary,
  opsMutedHint,
  opsTfChip,
  opsTfLbl,
  opsTfSeg,
  opsTfSegActive,
  opsTfSegRow,
} from "../lib/app-data/ops-tasks-tw";

export function PauseModalBody({
  pauseReason,
  setPauseReason,
  pauseError,
  busy,
  onCancel,
  onConfirm,
}: {
  pauseReason: string;
  setPauseReason: (v: string) => void;
  pauseError: string | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="flex flex-col gap-3.5">
      {pauseError ? <Note tone="danger">{pauseError}</Note> : null}
      <label className="flex flex-col gap-1.5">
        <span className={opsTfLbl}>سبب الإيقاف *</span>
        <Textarea
          value={pauseReason}
          onChange={(e) => setPauseReason(e.target.value)}
          placeholder="مثال: بانتظار رد الدائرة…"
          rows={2}
        />
      </label>
      <p className={opsMutedHint}>
        بعد تجاوز يوم عمل تُرسَل تذكيرات يومية للمنشئ والمنفّذ حتى الاستئناف أو
        الإغلاق.
      </p>
      <div className="flex justify-end gap-2">
        <button type="button" className={opsBtnGhost} onClick={onCancel}>
          إلغاء
        </button>
        <button
          type="button"
          className={opsBtnPrimary}
          disabled={busy}
          aria-busy={busy || undefined}
          onClick={onConfirm}
        >
          {busy ? <Spinner /> : null}
          <span>{busy ? "جاري الإيقاف…" : "إيقاف المهمة"}</span>
        </button>
      </div>
    </div>
  );
}

export function PriorityModalBody({
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
          aria-busy={busy || undefined}
          onClick={onApply}
        >
          {busy ? <Spinner /> : null}
          <span>{busy ? "جاري التطبيق…" : "تطبيق"}</span>
        </button>
      </div>
    </div>
  );
}
