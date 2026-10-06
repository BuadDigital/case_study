"use client";

import {
  AppModal,
  Button,
  Label,
  Note,
  Textarea,
  cn,
} from "@platform/ui-kit";
import type {
  ReturnImpactParty,
  ReturnInspectionResultDto,
} from "@platform/api-client";
import { invalidControlClass } from "@platform/app-shared/form-ux";
import {
  RETURN_INSPECTION_SECTIONS,
  returnImpactActionLabel,
  returnPackageStatusBadge,
  returnPartyKindLabel,
  returnPartyOutcomeIsWarning,
  returnPartyOutcomeLabel,
  returnInspectionSuccessMessage,
} from "../../lib/app-data/return-inspection-state";
import { DetailBadge } from "./PropertyDetailFields";
import { useReturnInspectionForm } from "./useReturnInspectionForm";

type Props = {
  open: boolean;
  onClose: () => void;
  /** The field-inspection task being returned. */
  inspectionTaskId: string;
  /** Deed number shown in the description, when known. */
  deedLabel?: string;
  /** Called once the server accepted the return (the dialog then shows the per-party outcomes). */
  onReturned?: (result: ReturnInspectionResultDto) => void;
};

/**
 * «إعادة المعاينة للمعاين» — the specialist sends the inspection back with the sections that need
 * correcting, picks which parties are affected (the server's suggestion is pre-ticked) and, when the
 * study report is already issued, must decide to keep it or reopen it. Replaces the plain reopen note.
 */
export function ReturnInspectionDialog({ open, ...rest }: Props) {
  if (!open) return null;
  return <ReturnInspectionForm {...rest} />;
}

function partyName(party: ReturnImpactParty | undefined): string {
  const name = party?.assigneeName?.trim();
  return name || "بلا مكلّف";
}

function ReturnInspectionForm({
  onClose,
  inspectionTaskId,
  deedLabel,
  onReturned,
}: Omit<Props, "open">) {
  const form = useReturnInspectionForm({ inspectionTaskId, onReturned });
  const deed = (deedLabel ?? "").trim();
  const parties = form.impact?.parties ?? [];

  if (form.result) {
    return (
      <AppModal
        open
        title="أُعيدت المعاينة للمعاين"
        onClose={onClose}
        maxWidthPx={500}
        look="ops-html"
        footer={
          <div className="flex w-full justify-end">
            <Button variant="primary" showActionToast={false} onClick={onClose}>
              تم
            </Button>
          </div>
        }
      >
        <ReturnOutcomes result={form.result} parties={parties} />
      </AppModal>
    );
  }

  return (
    <AppModal
      open
      title="إعادة المعاينة للمعاين"
      subtitle={
        <>
          تعود المعاينة
          {deed ? (
            <>
              {" "}الخاصة بالصك{" "}
              <span dir="ltr" className="font-bold text-gold-d">
                {deed}
              </span>
            </>
          ) : null}{" "}
          إلى المعاين للتصحيح، ويُنبَّه الأطراف الذين اعتمدوا على بياناتها.
        </>
      }
      onClose={onClose}
      maxWidthPx={560}
      look="ops-html"
      footer={
        <div className="flex w-full justify-end gap-2.5">
          <Button
            variant="default"
            showActionToast={false}
            disabled={form.busy}
            onClick={onClose}
          >
            إلغاء
          </Button>
          <Button
            variant="primary"
            showActionToast={false}
            loading={form.busy}
            disabled={form.impactLoading && !form.impact}
            onClick={() => void form.submit()}
          >
            تأكيد الإرجاع للمعاين
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="mb-1.5 p-0 text-[11px] font-semibold text-text-2">
            ما الذي يحتاج تصحيحاً؟
          </legend>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 max-sm:grid-cols-1">
            {RETURN_INSPECTION_SECTIONS.map((section) => (
              <label
                key={section.key}
                className="flex cursor-pointer items-center gap-2 text-[12.5px] text-heading"
              >
                <input
                  type="checkbox"
                  checked={form.sections.includes(section.key)}
                  disabled={form.busy}
                  onChange={() => form.toggleSection(section.key)}
                />
                <span>{section.labelAr}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <Label
            htmlFor="return-inspection-note"
            className="mb-1.5 text-[11px] font-semibold text-text-2"
          >
            سبب الإرجاع للمعاين <span className="text-danger-text">*</span>
          </Label>
          <Textarea
            id="return-inspection-note"
            rows={3}
            value={form.note}
            placeholder="صف ما يجب تصحيحه في تقرير المعاين…"
            aria-invalid={form.fieldErrors.note ? true : undefined}
            className={cn(
              "rounded-[10px] border-border-md bg-surface",
              form.fieldErrors.note && invalidControlClass,
            )}
            onChange={(e) => form.setNote(e.target.value)}
          />
          {form.fieldErrors.note ? (
            <Note tone="danger" className="mt-2">
              {form.fieldErrors.note}
            </Note>
          ) : null}
        </div>

        <section aria-label="الأطراف المتأثرة">
          <div className="mb-1.5 text-[11px] font-semibold text-text-2">
            الأطراف المتأثرة
          </div>
          {form.impactLoading && !form.impact ? (
            <p className="m-0 text-xs text-text-3">جارٍ تحميل الأطراف المتأثرة…</p>
          ) : form.impactError ? (
            <Note tone="warn">
              {form.impactError}{" "}
              <button
                type="button"
                className="font-bold underline"
                onClick={form.retryImpact}
              >
                إعادة المحاولة
              </button>
            </Note>
          ) : parties.length === 0 ? (
            <p className="m-0 text-xs text-text-3">
              لا أطراف أخرى على هذا العقار تتأثر بالإرجاع.
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {parties.map((party) => (
                <PartyRow
                  key={party.taskId}
                  party={party}
                  checked={form.affected.includes(party.taskId)}
                  disabled={form.busy}
                  onToggle={() => form.toggleParty(party.taskId)}
                />
              ))}
            </ul>
          )}
          {form.impact?.valuationClosed ? (
            <Note tone="warn" className="mt-2">
              التقييم مُغلق على هذا العقار — من أودع تقريره يُشعَر فقط، وتُتاح نسخة جديدة
              لاحقاً.
            </Note>
          ) : null}
        </section>

        {form.studyReportIssued ? (
          <fieldset className="m-0 flex min-w-0 flex-col gap-2 rounded-[10px] border border-border bg-surface-2/50 px-3 py-2.5">
            <legend className="px-1 text-[11.5px] font-bold text-heading">
              تقرير دراسة الحالة صادر <span className="text-danger-text">*</span>
            </legend>
            <label className="flex cursor-pointer items-start gap-2 text-[12.5px] text-heading">
              <input
                type="radio"
                name="return-inspection-study-report"
                className="mt-0.5"
                checked={form.studyReport === "keep"}
                disabled={form.busy}
                onChange={() => form.setStudyReport("keep")}
              />
              <span>إبقاء التقرير الصادر</span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-[12.5px] text-heading">
              <input
                type="radio"
                name="return-inspection-study-report"
                className="mt-0.5"
                checked={form.studyReport === "reopen"}
                disabled={form.busy}
                onChange={() => form.setStudyReport("reopen")}
              />
              <span>إعادة فتح تقرير دراسة الحالة</span>
            </label>
            {form.studyReport === "reopen" ? (
              <div>
                <Label
                  htmlFor="return-inspection-study-reason"
                  className="mb-1.5 text-[11px] font-semibold text-text-2"
                >
                  سبب إعادة فتح التقرير (10 أحرف على الأقل)
                </Label>
                <Textarea
                  id="return-inspection-study-reason"
                  rows={2}
                  value={form.studyReportReason}
                  aria-invalid={form.fieldErrors.studyReportReason ? true : undefined}
                  className={cn(
                    "rounded-[10px] border-border-md bg-surface",
                    form.fieldErrors.studyReportReason && invalidControlClass,
                  )}
                  onChange={(e) => form.setStudyReportReason(e.target.value)}
                />
                {form.fieldErrors.studyReportReason ? (
                  <Note tone="danger" className="mt-2">
                    {form.fieldErrors.studyReportReason}
                  </Note>
                ) : null}
              </div>
            ) : null}
            {form.fieldErrors.studyReport ? (
              <Note tone="danger">{form.fieldErrors.studyReport}</Note>
            ) : null}
          </fieldset>
        ) : null}

        {form.serverError ? <Note tone="warn">{form.serverError}</Note> : null}
      </div>
    </AppModal>
  );
}

function PartyRow({
  party,
  checked,
  disabled,
  onToggle,
}: {
  party: ReturnImpactParty;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const status = returnPackageStatusBadge(party.packageStatus);
  return (
    <li className="rounded-[10px] border border-border bg-surface px-3 py-2">
      <label className="flex cursor-pointer items-start gap-2">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={checked}
          disabled={disabled}
          onChange={onToggle}
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold text-heading">
            <span>{partyName(party)}</span>
            <span className="font-normal text-text-3">
              {returnPartyKindLabel(party.kind)}
            </span>
            <DetailBadge tone={status.tone}>{status.label}</DetailBadge>
            <DetailBadge tone={party.willBe === "reopen" ? "amber" : "blue"}>
              {returnImpactActionLabel(party.willBe)}
            </DetailBadge>
          </span>
          {party.suggestedBecause.length > 0 ? (
            <span className="mt-0.5 block text-[11px] leading-relaxed text-text-2">
              {party.suggestedBecause.join(" · ")}
            </span>
          ) : null}
        </span>
      </label>
    </li>
  );
}

function ReturnOutcomes({
  result,
  parties,
}: {
  result: ReturnInspectionResultDto;
  parties: ReturnImpactParty[];
}) {
  const byTask = new Map(parties.map((p) => [p.taskId, p]));
  return (
    <div className="flex flex-col gap-3">
      <Note tone="success">{returnInspectionSuccessMessage(result)}</Note>
      {result.parties.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {result.parties.map((outcome) => {
            const party = byTask.get(outcome.taskId);
            const warn = returnPartyOutcomeIsWarning(outcome.outcome);
            return (
              <li
                key={outcome.taskId}
                className={cn(
                  "rounded-[10px] border px-3 py-2 text-[12.5px]",
                  warn
                    ? "border-amber bg-amber-light text-amber-text"
                    : "border-border bg-surface text-heading",
                )}
              >
                <strong>
                  {partyName(party)} — {returnPartyKindLabel(outcome.kind)}
                </strong>
                <span className="mt-0.5 block text-[11.5px] leading-relaxed">
                  {returnPartyOutcomeLabel(outcome.outcome)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {result.studyReport.issued && !result.studyReport.reopened ? (
        <p className="m-0 text-[11.5px] text-text-2">
          بقي تقرير دراسة الحالة الصادر كما هو.
        </p>
      ) : null}
    </div>
  );
}
