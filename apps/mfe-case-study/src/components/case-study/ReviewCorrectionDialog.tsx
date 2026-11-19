"use client";

import { useMemo, useState } from "react";
import { AppModal, Badge, Button, Note, cn, useToast } from "@platform/ui-kit";
import { RegSelect } from "@platform/app-shared/registration/FormFields";
import { useDistributionAssigneesQuery } from "@settings/mfe/query/settings-queries";
import { assigneeLoadOptions } from "../../lib/app-data/distribution-assignee-options";
import { buildAssigneeOpenLoadMap } from "../../lib/app-data/distribution-load";
import { getValuators } from "../../lib/app-data/distribution-parties";
import { useWorkflowTasksQuery } from "../../query/case-study-queries";
import {
  planCaseStudyReopenSubmit,
  type CaseStudyReopenOutcome,
} from "../../lib/app-data/case-study-report-issue-errors";
import type {
  ReviewCorrectionOption,
  ReviewCorrectionSource,
} from "../../lib/app-data/review-correction-model";
import { EnfazClearConfirm, ReopenReasonField } from "./CaseStudyReportReopenDialog";

/** What a return answers the window with: done, or the refusal as the server words it. */
export type ReviewCorrectionResult = { ok: true } | { ok: false; error: string };

/** The appraiser a valuation return goes to: the current one, or another eligible appraiser. */
export type ReviewCorrectionAppraiser = { id: string; name: string };

/**
 * «المقيّم» for a valuation return: the current appraiser, or another from the list «تعديل الأطراف»
 * offers for the appraiser seat, each with his open load. The lists are read only while it shows.
 * Picking the current one again answers null (a plain return).
 */
function AppraiserChoice({
  currentId,
  movedTo,
  disabled,
  onChange,
}: {
  currentId: string;
  movedTo: ReviewCorrectionAppraiser | null;
  disabled: boolean;
  onChange: (next: ReviewCorrectionAppraiser | null) => void;
}) {
  const { data: staffResult } = useDistributionAssigneesQuery();
  const { data: tasks } = useWorkflowTasksQuery();
  const options = useMemo(() => {
    const people = getValuators(staffResult?.users ?? []);
    const labelled = assigneeLoadOptions(people, buildAssigneeOpenLoadMap(tasks ?? []));
    return labelled.map((option, i) => ({ ...option, name: people[i]!.name }));
  }, [staffResult, tasks]);
  return (
    <RegSelect
      id="review-correction-appraiser"
      label="المقيّم"
      options={options}
      value={movedTo?.id ?? currentId}
      disabled={disabled}
      hint="يبقى المقيّم الحالي، أو اختر مقيّمًا آخر (مثلاً عند غيابه): تنتقل إليه المعاملة بعملها كما هو."
      onChange={(next) => {
        const option = options.find((o) => o.value === next);
        onChange(next !== currentId && option ? { id: option.value, name: option.name } : null);
      }}
    />
  );
}

const DONE_TOAST: Record<ReviewCorrectionSource, string> = {
  study: "أُعيدت الدراسة لدارس العقار",
  valuation: "أُعيد التقييم للمقيّم للتصحيح",
};

/**
 * «طلب تصحيح» — review's one window for sending work back (Omar 2026-11-11).
 *
 * How it works: 1) review ticks where the error is — the study, the valuation, or both; each choice
 * shows the action that follows and who it touches, before anything is sent; 2) one reason, sent to
 * every party touched; 3) «إرسال طلب التصحيح» runs the returns one after the other (the study first)
 * with the commands the sections' own buttons use, and the window closes when all went through.
 * Edge cases: a choice that cannot be made now is listed with its reason and cannot be ticked; a
 * study already handed over to Enfaz asks for «إلغاء تسليم إنفاذ» (up-front when the page knows it,
 * else after the server's refusal); when one return went through and the next was refused, the
 * first is marked done and is not sent again on the retry. With `appraisers`, the valuation return
 * may go to another appraiser in the same step (Omar 2026-11-18: «المقيّم» defaults to the current
 * one); the server moves the task with the work kept and tells the new appraiser.
 */
export function ReviewCorrectionDialog({
  options,
  initial,
  deedLabel,
  enfazHandedOver = false,
  onClose,
  onReturnStudy,
  onReturnValuation,
  currentAppraiserId,
}: {
  options: readonly ReviewCorrectionOption[];
  /** The choice ticked when the window opens (the section it was opened from). */
  initial?: ReviewCorrectionSource;
  deedLabel?: string;
  enfazHandedOver?: boolean;
  onClose: () => void;
  onReturnStudy: (reason: string, clearEnfazHandover: boolean) => Promise<CaseStudyReopenOutcome>;
  onReturnValuation: (
    reason: string,
    newAppraiser: ReviewCorrectionAppraiser | null,
  ) => Promise<ReviewCorrectionResult>;
  /** The valuation's current appraiser; given → «المقيّم» lets review pick another one. */
  currentAppraiserId?: string | null;
}) {
  const { showToast } = useToast();
  const available = (source: ReviewCorrectionSource) =>
    options.some((o) => o.source === source && o.unavailable === null);
  const [picked, setPicked] = useState<ReadonlySet<ReviewCorrectionSource>>(
    () => new Set(initial && available(initial) ? [initial] : []),
  );
  const [done, setDone] = useState<ReadonlySet<ReviewCorrectionSource>>(new Set());
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [enfazPrompted, setEnfazPrompted] = useState(enfazHandedOver);
  const [enfazConfirmed, setEnfazConfirmed] = useState(false);
  const [enfazError, setEnfazError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const currentAppraiser = currentAppraiserId?.trim() ?? "";
  const [movedTo, setMovedTo] = useState<ReviewCorrectionAppraiser | null>(null);

  const toggle = (source: ReviewCorrectionSource) => {
    setPickError(null);
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  };

  const submit = async () => {
    if (busy) return;
    setServerError(null);
    const todo = options.map((o) => o.source).filter((s) => picked.has(s) && !done.has(s));
    if (todo.length === 0) {
      setPickError("اختر أين الخطأ.");
      return;
    }
    const studyAsked = todo.includes("study");
    const plan = planCaseStudyReopenSubmit({
      reason,
      enfazPrompted: studyAsked && enfazPrompted,
      enfazConfirmed,
    });
    if (!plan.ok) {
      if (plan.field === "reason") setReasonError(plan.error);
      else setEnfazError(plan.error);
      return;
    }
    setReasonError(null);
    setEnfazError(null);
    setBusy(true);
    try {
      for (const source of todo) {
        const outcome =
          source === "study"
            ? await onReturnStudy(plan.reason, plan.clearEnfazHandover)
            : await onReturnValuation(plan.reason, movedTo);
        if (!outcome.ok) {
          if ("needsEnfazConfirmation" in outcome && outcome.needsEnfazConfirmation) {
            setEnfazPrompted(true);
            setEnfazConfirmed(false);
          }
          setServerError(outcome.error);
          return;
        }
        setDone((prev) => new Set(prev).add(source));
        showToast(DONE_TOAST[source], "success");
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const deed = (deedLabel ?? "").trim();
  return (
    <AppModal
      open
      title="طلب تصحيح"
      subtitle={
        <>
          حدّد أين الخطأ
          {deed ? (
            <>
              {" "}في معاملة الصك{" "}
              <span dir="ltr" className="font-bold text-gold-d">
                {deed}
              </span>
            </>
          ) : null}
          ، وراجع الإجراء ومن يتأثر به قبل الإرسال.
        </>
      }
      onClose={onClose}
      maxWidthPx={560}
      look="ops-html"
      footer={
        <div className="flex w-full justify-end gap-2.5">
          <Button variant="default" showActionToast={false} disabled={busy} onClick={onClose}>
            إلغاء
          </Button>
          <Button variant="primary" showActionToast={false} loading={busy} onClick={() => void submit()}>
            إرسال طلب التصحيح
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3" data-testid="review-correction">
        <fieldset className="m-0 flex flex-col gap-2 border-none p-0">
          <legend className="mb-1.5 p-0 text-[11px] font-semibold text-text-2">أين الخطأ؟</legend>
          {options.map((o) => {
            const isDone = done.has(o.source);
            const disabled = o.unavailable !== null || isDone || busy;
            const checked = picked.has(o.source);
            return (
              <label
                key={o.source}
                data-testid={`review-correction-${o.source}`}
                className={cn(
                  "flex items-start gap-2.5 rounded-[10px] border px-3 py-2.5",
                  disabled ? "cursor-default" : "cursor-pointer",
                  checked && !disabled ? "border-ink bg-surface-2" : "border-border bg-surface",
                  o.unavailable !== null && "opacity-70",
                )}
              >
                <input
                  type="checkbox"
                  className="mt-1 shrink-0 accent-[var(--ink)]"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(o.source)}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 text-[13px] font-bold text-heading">
                    {o.title}
                    {isDone ? <Badge tone="success">تم</Badge> : null}
                  </span>
                  {o.unavailable !== null ? (
                    <span className="mt-0.5 block text-[12px] leading-relaxed text-text-3">{o.unavailable}</span>
                  ) : (
                    <>
                      <span className="mt-0.5 block text-[12px] leading-relaxed text-text">{o.action}</span>
                      <span className="mt-1.5 block text-[11px] font-semibold text-text-2">المتأثرون</span>
                      <ul className="m-0 mt-0.5 list-disc ps-4 text-[12px] leading-relaxed text-text-2">
                        {o.affected.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </span>
              </label>
            );
          })}
          {pickError ? <Note tone="danger" className="mb-0">{pickError}</Note> : null}
        </fieldset>

        {currentAppraiser && picked.has("valuation") && !done.has("valuation") ? (
          <AppraiserChoice
            currentId={currentAppraiser}
            movedTo={movedTo}
            disabled={busy}
            onChange={setMovedTo}
          />
        ) : null}

        <ReopenReasonField
          label="سبب طلب التصحيح (10 أحرف على الأقل) — يصل لكل طرف متأثر"
          placeholder="مثال: مساحة البناء في الدراسة لا تطابق رخصة البناء"
          value={reason}
          error={reasonError}
          onChange={(value) => {
            setReason(value);
            if (reasonError) setReasonError(null);
          }}
        />

        {enfazPrompted && picked.has("study") && !done.has("study") ? (
          <EnfazClearConfirm
            checked={enfazConfirmed}
            error={enfazError}
            onChange={(checked) => {
              setEnfazConfirmed(checked);
              if (enfazError) setEnfazError(null);
            }}
          />
        ) : null}

        {serverError ? <Note tone="warn" className="mb-0">{serverError}</Note> : null}
      </div>
    </AppModal>
  );
}
