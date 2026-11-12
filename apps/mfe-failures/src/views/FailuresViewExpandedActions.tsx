"use client";

/**
 * Failures queue — the expanded row / card panel: title, notes, the actions
 * the viewer may take, the supervisor note and the inline resolve form.
 */

import Link from "next/link";
import { Button, cn } from "@platform/ui-kit";
import { poPropertyPath } from "@platform/app-shared/domain/po-routes";
import type { FailureRecord } from "@platform/app-shared/failures/failures-types";
import { failureRecordTitle } from "../lib/failures-labels";
import {
  failureActionPermissions,
  failureBusyKey,
  failureMetaRows,
  isFailureBusy,
  resolveDraftFor,
} from "../lib/failures-view-state";
import {
  FailuresViewResolveForm,
  failuresActionButtonClass,
  failuresFieldTextareaClass,
} from "./FailuresViewResolveForm";
import type { FailuresViewWorkflow } from "./useFailuresViewWorkflow";

export function FailuresViewExpandedActions({
  failure: f,
  wf,
}: {
  failure: FailureRecord;
  wf: FailuresViewWorkflow;
}) {
  const { canSpecialistAct, canSupervisorAct, canResolve, canRevertFinal } =
    failureActionPermissions(f, {
      caseEditor: wf.caseEditor,
      supervisor: wf.supervisor,
      confirmer: wf.confirmer,
      coordinator: wf.coordinator,
    });
  const draft = resolveDraftFor(wf.resolveDraft, f.id);
  const displayTitle = failureRecordTitle(f);
  const actionBtn = failuresActionButtonClass;
  const busy = isFailureBusy(wf.busyKey, f.id);
  const metaRows = failureMetaRows(f, wf.specialistByPo);

  return (
    <div
      className="border-t border-border bg-row-hover px-4 py-3 text-[12.5px]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="min-w-0">
        <div className="text-[13.5px] font-bold leading-snug text-primary">
          {displayTitle}
        </div>
        {metaRows.length > 0 ? (
          <dl className="mt-2 space-y-1.5">
            {metaRows.map((row) => (
              <div
                key={row.label}
                className="flex flex-wrap gap-x-1.5 gap-y-0.5 text-[12px] leading-relaxed text-text-2"
              >
                <dt className="shrink-0 font-semibold text-heading">
                  {row.label}:
                </dt>
                <dd className="m-0 min-w-0">{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>

      {f.propertyId || canSpecialistAct || canSupervisorAct || canRevertFinal ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/80 pt-3">
          {f.propertyId ? (
            <Link
              href={poPropertyPath(f.poNumber, f.propertyId)}
              className={cn(
                "inline-flex items-center justify-center gap-[5px] rounded-[var(--radius-DEFAULT)] border-[0.5px] border-solid border-border-md bg-surface text-text no-underline transition-[background,border-color] duration-150 hover:border-gold hover:text-gold-d",
                actionBtn,
              )}
            >
              عرض العقار
            </Link>
          ) : null}

          {canSpecialistAct ? (
            <>
              {f.severity === "suspected" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className={actionBtn}
                  loading={wf.busyKey === failureBusyKey(f.id, "upgrade")}
                  showActionToast={false}
                  onClick={() => wf.handleUpgrade(f.id)}
                >
                  تأكيد تعذّر داخلي
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className={actionBtn}
                  disabled={busy}
                  showActionToast={false}
                  onClick={() => wf.toggleEscalate(f.id)}
                >
                  {wf.escalateOpen[f.id] ? "إلغاء التصعيد" : "تصعيد إلى المشرف"}
                </Button>
              )}
              {canResolve ? (
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className={actionBtn}
                  disabled={busy}
                  showActionToast={false}
                  onClick={() => wf.toggleResolve(f.id)}
                >
                  {wf.resolveOpen[f.id] ? "إلغاء الحل" : "تم الحل"}
                </Button>
              ) : null}
            </>
          ) : null}

          {canRevertFinal ? (
            <Button
              type="button"
              size="sm"
              variant="default"
              className={actionBtn}
              disabled={busy}
              showActionToast={false}
              onClick={() => wf.toggleRevert(f.id)}
            >
              {wf.revertOpen[f.id] ? "إلغاء الرجوع" : "رجوع من التعذّر النهائي"}
            </Button>
          ) : null}

          {canSupervisorAct ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="default"
                className={actionBtn}
                disabled={busy}
                showActionToast={false}
                onClick={() => wf.setFinalFailureId(f.id)}
              >
                اعتماد التعذّر
              </Button>
              <Button
                type="button"
                size="sm"
                variant="default"
                className={actionBtn}
                loading={wf.busyKey === failureBusyKey(f.id, "return")}
                disabled={busy}
                showActionToast={false}
                onClick={() => wf.handleReturn(f.id)}
              >
                إعادة للأخصائي
              </Button>
              <Button
                type="button"
                size="sm"
                variant="default"
                className={actionBtn}
                loading={wf.busyKey === failureBusyKey(f.id, "suspend")}
                disabled={busy}
                showActionToast={false}
                onClick={() => void wf.handleSuspend(f.id)}
              >
                تعليق المعاملة
              </Button>
            </>
          ) : null}
        </div>
      ) : null}

      {/* The supervisor's note serves «إعادة للأخصائي» and «تعليق المعاملة» only — «اعتماد
          التعذّر» opens the final-failure dialog, which asks its own required reason. */}
      {canSupervisorAct ? (
        <div className="mt-3 border-t border-border/80 pt-3">
          <label
            className="mb-1.5 block text-[11px] font-semibold text-heading"
            htmlFor={`sup_note_${f.id}`}
          >
            ملاحظة الإعادة أو التعليق
          </label>
          <textarea
            id={`sup_note_${f.id}`}
            className={failuresFieldTextareaClass}
            rows={2}
            placeholder="اكتب الملاحظة إن لزم…"
            value={wf.supervisorNote[f.id] ?? ""}
            onChange={(e) => wf.setSupervisorNoteFor(f.id, e.target.value)}
          />
        </div>
      ) : null}

      {/* «تصعيد إلى المشرف» form: the explanation is required — the confirm button stays off
          while it is blank (the escalation used to be one click with no text). A possible
          failure never gets it: its button is «تأكيد تعذّر داخلي» instead. */}
      {wf.escalateOpen[f.id] && canSpecialistAct && f.severity !== "suspected" ? (
        <ReasonConfirmForm
          id={`escalate_note_${f.id}`}
          label="سبب التصعيد"
          placeholder="اشرح للمشرف ما الذي حاولته ولماذا لم يُحل التعذّر…"
          value={wf.escalateNote[f.id] ?? ""}
          onChange={(value) => wf.setEscalateNoteFor(f.id, value)}
          confirmLabel="تأكيد التصعيد إلى المشرف"
          loading={wf.busyKey === failureBusyKey(f.id, "submit")}
          busy={busy}
          onConfirm={() => wf.handleSubmit(f.id)}
        />
      ) : null}

      {/* «رجوع من التعذّر النهائي» form: Enfaz took the transaction back. The reason is required;
          every deed of the transaction comes back with this one. */}
      {wf.revertOpen[f.id] && canRevertFinal ? (
        <ReasonConfirmForm
          id={`revert_final_note_${f.id}`}
          label="سبب الرجوع من التعذّر النهائي"
          placeholder="مثال: اتصال مركز التصفية — رجعت المعاملة من التعذّر في منصة إنفاذ"
          hint={
            (f.transactionDeedCount ?? 1) > 1
              ? `ترجع صكوك المعاملة كلها (${f.transactionDeedCount}) من التعذّر وتُفتح مهامها المتوقفة، ويُخطر أصحابها.`
              : "ترجع المعاملة من التعذّر وتُفتح مهامها المتوقفة، ويُخطر أصحابها."
          }
          value={wf.revertNote[f.id] ?? ""}
          onChange={(value) => wf.setRevertNoteFor(f.id, value)}
          confirmLabel="تأكيد الرجوع واستئناف المعاملة"
          loading={wf.busyKey === failureBusyKey(f.id, "revert-final")}
          busy={busy}
          onConfirm={() => wf.handleRevertFinal(f.id)}
        />
      ) : null}

      {wf.resolveOpen[f.id] && canResolve && !canSupervisorAct ? (
        <FailuresViewResolveForm
          failureId={f.id}
          draft={draft}
          loading={wf.busyKey === failureBusyKey(f.id, "resolve")}
          busy={busy}
          onPatch={(patch) => wf.patchResolveDraft(f.id, patch)}
          onSubmit={() => wf.handleResolve(f.id)}
        />
      ) : null}
    </div>
  );
}

/**
 * A required explanation with its confirm button — «تصعيد إلى المشرف» and «رجوع من التعذّر النهائي».
 *
 * How it works: controlled textarea; the confirm button stays off while the text is blank or any
 * action of the failure is in flight. Edge cases: `hint` is the line above the field saying what
 * the confirm does; the escalation has none.
 */
function ReasonConfirmForm({
  id,
  label,
  placeholder,
  hint,
  value,
  onChange,
  confirmLabel,
  loading,
  busy,
  onConfirm,
}: {
  id: string;
  label: string;
  placeholder: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  confirmLabel: string;
  /** This form's own request is in flight. */
  loading: boolean;
  /** Any action of this failure is in flight. */
  busy: boolean;
  onConfirm: () => void;
}) {
  return (
    <div className="mt-3 space-y-2.5 border-t border-border/80 pt-3">
      {hint ? <p className="m-0 text-[12px] leading-relaxed text-text-2">{hint}</p> : null}
      <div>
        <label className="mb-1.5 block text-[11px] font-semibold text-heading" htmlFor={id}>
          {label} *
        </label>
        <textarea
          id={id}
          className={failuresFieldTextareaClass}
          rows={3}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <Button
        type="button"
        size="sm"
        variant="default"
        className={failuresActionButtonClass}
        loading={loading}
        disabled={!value.trim() || busy}
        showActionToast={false}
        onClick={onConfirm}
      >
        {confirmLabel}
      </Button>
    </div>
  );
}
