"use client";

/**
 * «مهمة جديدة» — the who/what fields: task type, assignee (with the
 * loading/empty hints), the cooperator visit fee and the description.
 * Presentational; every change dispatches to `createOperationsTaskReducer`.
 */
import type { Dispatch } from "react";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import type { DistributionAssignee } from "../lib/app-data/distribution-parties";
import type { groupAssigneesForSelect } from "../lib/app-data/operations-task-assignees";
import { OPERATIONS_TASK_TYPE_LABELS } from "../lib/app-data/operations-task-display";
import {
  opsFld,
  opsFldControl,
  opsFldFull,
  opsFldTextarea,
  opsTfLblInFld,
  opsTfSeg,
  opsTfSegActive,
  opsTfSegRow,
} from "../lib/app-data/ops-tasks-tw";
import {
  TASK_TYPES,
  type CreateOperationsTaskAction,
  type CreateOperationsTaskForm,
} from "./create-operations-task-state";

export type CreateTaskDispatch = Dispatch<CreateOperationsTaskAction>;
type AssigneeGroups = ReturnType<typeof groupAssigneesForSelect>;

const HINT = "mt-1 block text-[11px] leading-snug text-text-3";

export function SegRow({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className={opsTfSegRow}>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={value === opt.id ? opsTfSegActive : opsTfSeg}
          onClick={() => onChange(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function CreateTaskTypeField({
  form,
  dispatch,
}: {
  form: Pick<CreateOperationsTaskForm, "type">;
  dispatch: CreateTaskDispatch;
}) {
  const { type } = form;
  return (
    <div className={opsFld}>
      <label className={opsTfLblInFld}>نوع المهمة *</label>
      <select
        className={opsFldControl}
        value={type}
        onChange={(e) => dispatch({ type: "set-type", value: e.target.value })}
      >
        {TASK_TYPES.map((t) => (
          <option key={t} value={t}>
            {OPERATIONS_TASK_TYPE_LABELS[t]}
          </option>
        ))}
      </select>
      {type === "general" ? (
        <span className={HINT}>
          تكليف تشغيلي لأي طرف منفّذ: معاين، مقيم، مكتب هندسي، أو مراجع.
        </span>
      ) : type === "court_visit" ? (
        <span className={HINT}>
          زيارة محكمة — تُسند للمراجع الحكومي فقط (مع أتعاب الزيارة للمتعاون).
        </span>
      ) : null}
    </div>
  );
}

function AssigneeOptions({ assignees }: { assignees: DistributionAssignee[] }) {
  return (
    <>
      {assignees.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
          {a.subtitle ? ` — ${a.subtitle}` : ""}
        </option>
      ))}
    </>
  );
}

export function CreateTaskAssigneeField({
  form,
  dispatch,
  assignees,
  assigneeGroups,
  staffUsers,
  staffLoading,
  staffLoadError,
}: {
  form: Pick<CreateOperationsTaskForm, "type" | "assigneeId">;
  dispatch: CreateTaskDispatch;
  assignees: DistributionAssignee[];
  assigneeGroups: AssigneeGroups;
  staffUsers: StaffUser[];
  staffLoading: boolean;
  staffLoadError: string | null;
}) {
  const { type, assigneeId } = form;
  return (
    <div className={opsFld}>
      <label className={opsTfLblInFld}>مُسندة إلى *</label>
      <select
        className={opsFldControl}
        value={staffLoading ? "" : assigneeId}
        disabled={staffLoading || assignees.length === 0}
        onChange={(e) => {
          const id = e.target.value;
          dispatch({
            type: "set-assignee",
            id,
            name: assignees.find((a) => a.id === id)?.name ?? "",
          });
        }}
      >
        {staffLoading ? (
          <option value="">جاري تحميل المنفّذين…</option>
        ) : (
          <>
            <option value="">اختر المنفّذ…</option>
            {assigneeGroups.length > 1 ? (
              assigneeGroups.map((g) => (
                <optgroup key={g.key} label={g.label}>
                  <AssigneeOptions assignees={g.items} />
                </optgroup>
              ))
            ) : (
              <AssigneeOptions assignees={assignees} />
            )}
          </>
        )}
      </select>
      {staffLoading ? (
        <span className="mt-1 block text-[11px] text-text-3">
          جاري جلب قائمة المعاينين والمقيمين والمكاتب والمراجعين…
        </span>
      ) : assignees.length === 0 ? (
        <span className="text-[11px] text-text-3">
          {staffLoadError
            ? staffLoadError
            : staffUsers.length === 0
              ? "تعذّر تحميل المنفّذين — تحقق من تسجيل الدخول وخادم الهوية (صلاحية manage-work-orders)."
              : "لا يوجد منفّذون بمُعرّف توزيع لهذا النوع. تأكد أن للموظفين DistributionAssigneeId ودور طرف صحيح."}
        </span>
      ) : type === "general" ? (
        <span className={HINT}>
          {assignees.length} منفّذ متاح
          {assigneeGroups.length > 1
            ? ` · ${assigneeGroups.map((g) => g.label).join(" · ")}`
            : ""}
        </span>
      ) : null}
    </div>
  );
}

/** court_visit with an assignee: the fee input for cooperators, a note for employees. */
export function CreateTaskVisitFeeFields({
  form,
  dispatch,
  needsVisitFee,
}: {
  form: Pick<CreateOperationsTaskForm, "type" | "assigneeId" | "visitFeeAmountSar">;
  dispatch: CreateTaskDispatch;
  needsVisitFee: boolean;
}) {
  if (form.type !== "court_visit" || !form.assigneeId) return null;
  if (needsVisitFee) {
    return (
      <div className={opsFld}>
        <label className={opsTfLblInFld}>أتعاب الزيارة (ر.س) *</label>
        <input
          className={opsFldControl}
          type="number"
          min={0}
          step={1}
          inputMode="decimal"
          value={form.visitFeeAmountSar}
          onChange={(e) => dispatch({ type: "set-visit-fee", value: e.target.value })}
          placeholder="المبلغ الافتراضي من جدول التسعير قابل للتعديل"
        />
        <span className={HINT}>
          يُختم عند الإنشاء ويُرحَّل إلى التكاليف عند إكمال الزيارة.
        </span>
      </div>
    );
  }
  return (
    <div className={opsFldFull}>
      <p className="m-0 rounded-md border border-border/70 bg-surface-2/60 px-3 py-2 text-[12px] leading-snug text-text-2">
        المراجع الموظف لا يستحق أتعاب زيارة — لا يظهر بند في التكاليف.
        الحوافز عبر جداول flat (إن وُجدت). للمتعاون اختر منفّذاً بنوع
        عقد متعاون/خارجي لتمكين مبلغ الزيارة.
      </p>
    </div>
  );
}

export function CreateTaskDescriptionField({
  form,
  dispatch,
}: {
  form: Pick<CreateOperationsTaskForm, "description">;
  dispatch: CreateTaskDispatch;
}) {
  return (
    <div className={opsFldFull}>
      <label className={opsTfLblInFld}>الوصف</label>
      <textarea
        className={opsFldTextarea}
        value={form.description}
        onChange={(e) => dispatch({ type: "set-description", value: e.target.value })}
        rows={2}
        placeholder="تفاصيل إضافية للمنفّذ (اختياري)"
      />
    </div>
  );
}
