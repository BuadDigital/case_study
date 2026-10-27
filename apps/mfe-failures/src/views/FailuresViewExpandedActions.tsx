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
  const { canSpecialistAct, canSupervisorAct, canResolve } =
    failureActionPermissions(f, {
      caseEditor: wf.caseEditor,
      supervisor: wf.supervisor,
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

      {f.propertyId || canSpecialistAct || canSupervisorAct ? (
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
        <div className="mt-3 space-y-2.5 border-t border-border/80 pt-3">
          <div>
            <label
              className="mb-1.5 block text-[11px] font-semibold text-heading"
              htmlFor={`escalate_note_${f.id}`}
            >
              سبب التصعيد *
            </label>
            <textarea
              id={`escalate_note_${f.id}`}
              className={failuresFieldTextareaClass}
              rows={3}
              placeholder="اشرح للمشرف ما الذي حاولته ولماذا لم يُحل التعذّر…"
              value={wf.escalateNote[f.id] ?? ""}
              onChange={(e) => wf.setEscalateNoteFor(f.id, e.target.value)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="default"
            className={actionBtn}
            loading={wf.busyKey === failureBusyKey(f.id, "submit")}
            disabled={!(wf.escalateNote[f.id] ?? "").trim() || busy}
            showActionToast={false}
            onClick={() => wf.handleSubmit(f.id)}
          >
            تأكيد التصعيد إلى المشرف
          </Button>
        </div>
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
