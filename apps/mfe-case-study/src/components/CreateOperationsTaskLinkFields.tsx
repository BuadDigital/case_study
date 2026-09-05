"use client";

/**
 * «مهمة جديدة» — the link and schedule fields: link scope with its work
 * order / single deed / multi-deed pickers, priority with the proposed due
 * moment, and the delegation-letter preview for court visits. Presentational;
 * every change dispatches to `createOperationsTaskReducer`.
 */
import { cn } from "@platform/ui-kit";
import type { OperationsTaskLetterRowDto } from "@platform/api-client";
import {
  OPERATIONS_TASK_PRIORITY_LABELS,
  OPERATIONS_TASK_SCOPE_LABELS,
} from "../lib/app-data/operations-task-display";
import type { PoIntakeRecord } from "../lib/app-data/po-intake-data";
import {
  opsFileSize,
  opsFldControl,
  opsFldFull,
  opsLetterCard,
  opsLetterHead,
  opsLetterSub,
  opsLetterTitle,
  opsTfChip,
  opsTfChipActive,
  opsTfDeed,
  opsTfDeedCheck,
  opsTfDeeds,
  opsTfLblInFld,
  opsTfNote,
} from "../lib/app-data/ops-tasks-tw";
import { LetterTable } from "../views/OperationsTasksLetterTable";
import { SegRow, type CreateTaskDispatch } from "./CreateOperationsTaskFields";
import {
  DUE_CHIPS,
  LINK_SCOPES,
  type CreateOperationsTaskForm,
} from "./create-operations-task-state";

export function CreateTaskLinkScopeFields({
  form,
  dispatch,
  poOptions,
  selectedPo,
  deeds,
  multiDeedOptions,
}: {
  form: Pick<CreateOperationsTaskForm, "scope" | "poNumber" | "deed" | "selectedDeeds">;
  dispatch: CreateTaskDispatch;
  poOptions: PoIntakeRecord[];
  selectedPo: PoIntakeRecord | undefined;
  deeds: string[];
  multiDeedOptions: { deed: string; po: string }[];
}) {
  const { scope, poNumber, deed, selectedDeeds } = form;
  return (
    <>
      <div className={opsFldFull}>
        <label className={opsTfLblInFld}>نطاق الربط *</label>
        <SegRow
          value={scope}
          onChange={(id) => dispatch({ type: "set-scope", value: id })}
          options={LINK_SCOPES.map((s) => ({
            id: s,
            label: OPERATIONS_TASK_SCOPE_LABELS[s] ?? s,
          }))}
        />
      </div>

      {scope !== "general" && scope !== "multi" ? (
        <div className={opsFldFull}>
          <label className={opsTfLblInFld}>أمر العمل *</label>
          <select
            className={opsFldControl}
            value={poNumber}
            onChange={(e) => dispatch({ type: "set-po", value: e.target.value })}
          >
            <option value="">اختر أمر العمل…</option>
            {poOptions.map((r) => (
              <option key={r.poNumber} value={r.poNumber.trim()}>
                {r.poNumber.trim()}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {scope === "general" ? (
        <div className={opsFldFull}>
          <div className={opsTfNote}>
            مهمة مستقلة تماماً بلا ربط بمعاملة أو أمر عمل.
          </div>
        </div>
      ) : null}

      {scope === "multi" ? (
        <div className={opsFldFull}>
          <div className={opsTfNote}>
            اختر صكوكاً من أي أوامر عمل — يُجمَّع خطاب التفويض حسب المحكمة/الدائرة.
          </div>
        </div>
      ) : null}

      {scope === "transaction" && selectedPo ? (
        <div className={opsFldFull}>
          <label className={opsTfLblInFld}>المعاملة (الصك) *</label>
          <select
            className={opsFldControl}
            value={deed}
            onChange={(e) => dispatch({ type: "set-deed", value: e.target.value })}
          >
            <option value="">اختر الصك…</option>
            {deeds.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {scope === "multi" ? (
        <div className={opsFldFull}>
          <span className={opsTfLblInFld}>
            المعاملات المرتبطة *{" "}
            <span className="font-medium text-text-3">(صكّان فأكثر)</span>
          </span>
          <div className={opsTfDeeds}>
            {multiDeedOptions.map(({ deed: d, po }) => (
              <label key={`${po}-${d}`} className={opsTfDeed}>
                <input
                  type="checkbox"
                  className={opsTfDeedCheck}
                  checked={selectedDeeds.includes(d)}
                  onChange={() => dispatch({ type: "toggle-deed", value: d })}
                />
                <span className="font-bold text-gold-d" dir="ltr">
                  {d}
                </span>
                <span className="text-[11px] text-text-3">{po}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

export function CreateTaskScheduleFields({
  form,
  dispatch,
}: {
  form: Pick<CreateOperationsTaskForm, "priority" | "dueDate" | "dueTime" | "dueChip">;
  dispatch: CreateTaskDispatch;
}) {
  const { priority, dueDate, dueTime, dueChip } = form;
  return (
    <>
      <div className={opsFldFull}>
        <label className={opsTfLblInFld}>الأولوية *</label>
        <SegRow
          value={priority}
          onChange={(id) =>
            dispatch({ type: "set-priority", value: id, now: Date.now() })
          }
          options={Object.entries(OPERATIONS_TASK_PRIORITY_LABELS).map(
            ([id, label]) => ({ id, label }),
          )}
        />
        <span className="mt-1.5 block text-[11px] text-text-3">
          تضبط الأولوية موعد الاستحقاق المقترح — «متوسطة» (الافتراضي) تعادل نصف يوم.
        </span>
      </div>

      <div className={opsFldFull}>
        <label className={opsTfLblInFld}>
          موعد الاستحقاق *{" "}
          <span className={opsFileSize}>
            (يوم + ساعة)
          </span>
        </label>
        <div className="mb-[11px] flex flex-wrap gap-2">
          {DUE_CHIPS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={dueChip === id ? opsTfChipActive : opsTfChip}
              onClick={() =>
                dispatch({ type: "apply-due-chip", chip: id, now: Date.now() })
              }
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2.5">
          <input
            type="date"
            className={cn(opsFldControl, "max-w-[190px]")}
            value={dueDate}
            onChange={(e) => dispatch({ type: "set-due-date", value: e.target.value })}
          />
          <input
            type="time"
            className={cn(opsFldControl, "max-w-[150px]")}
            value={dueTime}
            onChange={(e) => dispatch({ type: "set-due-time", value: e.target.value })}
          />
        </div>
      </div>
    </>
  );
}

/** Snapshot of the delegation-letter rows; hidden until a court visit has rows. */
export function CreateTaskLetterPreview({ rows }: { rows: OperationsTaskLetterRowDto[] }) {
  if (rows.length === 0) return null;
  return (
    <div className={opsFldFull}>
      <div className={cn(opsLetterCard, "mt-1")}>
        <div className={opsLetterHead}>
          <div>
            <div className={opsLetterTitle}>خطاب التفويض الداخلي</div>
            <div className={opsLetterSub}>
              مفتاح التجميع: المحكمة + الدائرة · لقطة (snapshot) عند الإصدار
            </div>
          </div>
          <span className="text-xs font-bold text-text-2">
            الرقم المرجعي:{" "}
            <span className="text-gold-d">يُصدر عند الإنشاء</span>
          </span>
        </div>
        <div className="px-3.5 py-3">
          <LetterTable rows={rows} />
          <p className="mx-0.5 mt-2.5 text-[11.5px] text-text-3">
            لقطة (snapshot) لبيانات الصكوك والمحاكم وقت إنشاء المهمة — تُثبَّت على
            الخطاب ولا تتأثر بتعديلات لاحقة على أمر العمل.
          </p>
        </div>
      </div>
    </div>
  );
}
