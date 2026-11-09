"use client";

import type { ReactNode } from "react";
import { Badge, Button, FormGroup, Label, Note, Textarea, cn } from "@platform/ui-kit";
import { invalidControlClass } from "@platform/app-shared/form-ux";

import { buildCaseStudyReportModel } from "../../lib/app-data/case-study-report-document-model";
import { CaseStudyReportActions } from "./CaseStudyReportActions";
import { CaseStudyProgressDonut } from "./CaseStudyProgressDonut";
import {
  partyById,
  type CaseStudyInfoPartyId,
} from "@settings/mfe/lib/app-data/case-study-info-roles-data";

/**
 * Presentational pieces of the case study form — the remarks block, the
 * progress rings, the party matrix banner and the specialist closing cards.
 * All state stays in the form workflow.
 */
export function RemarksBlock({
  label,
  value,
  onChange,
  rows = 3,
  disabled = false,
  id,
  invalid = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  disabled?: boolean;
  id?: string;
  invalid?: boolean;
}) {
  return (
    <FormGroup className="mb-0 border-0 pt-0">
      <Label
        htmlFor={id}
        className="mb-1.5 text-[11px] font-semibold text-text-2"
      >
        {label}
      </Label>
      <Textarea
        id={id}
        rows={rows}
        placeholder="الملاحظات..."
        value={value}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "rounded-[10px] border-border-md bg-surface",
          invalid && invalidControlClass,
        )}
      />
    </FormGroup>
  );
}

export function FormProgressRings({
  summary,
  submitted,
}: {
  summary: { total: number; answered: number; pending: number; pct: number };
  submitted: boolean;
}) {
  const pct = submitted ? 100 : summary.pct;
  const answered = submitted ? summary.total : summary.answered;
  return (
    <div
      className="flex shrink-0 items-center justify-center gap-2.5 pe-1"
      aria-label="تقدم التقرير"
    >
      <CaseStudyProgressDonut
        pct={pct}
        color="var(--ink, #102b4e)"
        label={submitted ? "تم إصدار التقرير" : "اكتمال التقرير"}
        sub={`${answered} / ${summary.total}`}
      />
    </div>
  );
}

/** «N من M مجابة» next to the issue button — the issue needs every visible question answered. */
export function IssueProgressHint({
  answered,
  total,
}: {
  answered: number;
  total: number;
}) {
  const complete = total > 0 && answered >= total;
  return (
    <span
      className={cn(
        "me-auto text-xs font-semibold",
        complete ? "text-success-text" : "text-text-2",
      )}
      aria-live="polite"
    >
      {answered} من {total} مجابة
    </span>
  );
}

/**
 * Why the issue button is disabled: a traditional deed waits for the deed ↔ nature outcome,
 * chosen on «مدخلات المعاين». The link opens that tab.
 */
export function DeedMatchIssueHint({
  message,
  onOpen,
}: {
  message: string;
  onOpen: () => void;
}) {
  return (
    <p
      className="m-0 flex basis-full flex-wrap items-center gap-2 text-xs font-semibold text-amber-text"
      role="status"
    >
      <span>{message}</span>
      <Button type="button" size="sm" variant="outline" showActionToast={false} onClick={onOpen}>
        فتح «مدخلات المعاين»
      </Button>
    </p>
  );
}

/**
 * Status line of a sent study with its actions (Omar 2026-11-08). Rendered outside the read-only
 * wrapper (`pointer-events-none`) so the buttons stay clickable.
 *
 * How it works: «عند المراجع» until review approves it — review approves («اعتماد الدراسة») or returns it
 * («إرجاع للدراسة»), the study takes it back («استرجاع الدراسة»); once approved only review returns it.
 * Edge cases: `onApprove` absent → no approve button (not review, or approved already).
 */
export function CaseStudyIssuedBar({
  approved,
  reopenLabel,
  onReopen,
  onApprove,
  approving = false,
}: {
  approved: boolean;
  /** The reopen button's label, or null when the viewer may not reopen now. */
  reopenLabel: string | null;
  onReopen: () => void;
  onApprove?: () => void;
  approving?: boolean;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5 rounded-[10px] border border-border bg-surface-2/50 px-3.5 py-2.5">
      <span className="inline-flex items-center gap-2 text-[12.5px] text-text-2" data-testid="case-study-review-state">
        حالة الدراسة
        <Badge tone={approved ? "success" : "info"} dot>
          {approved ? "اعتمدها المراجع" : "عند المراجع"}
        </Badge>
      </span>
      <span className="inline-flex flex-wrap gap-2">
        {reopenLabel ? (
          <Button variant="dangerOutline" size="sm" showActionToast={false} disabled={approving} onClick={onReopen}>
            {reopenLabel}
          </Button>
        ) : null}
        {onApprove ? (
          <Button variant="primary" size="sm" showActionToast={false} loading={approving} onClick={onApprove}>
            اعتماد الدراسة
          </Button>
        ) : null}
      </span>
    </div>
  );
}

export function CaseStudyMatrixBanner({
  viewerPartyId,
  isParty,
  partyAdvisory,
  partyContribCount,
  onRefreshParty,
}: {
  viewerPartyId: CaseStudyInfoPartyId;
  isParty: boolean;
  partyAdvisory?: boolean;
  partyContribCount: number;
  onRefreshParty: () => void;
}) {
  const party = partyById(viewerPartyId);
  return (
    <Note
      tone="info"
      className="flex flex-wrap items-center justify-between gap-2.5 rounded-[10px]"
    >
      {isParty ? (
        <p className="m-0 min-w-[min(100%,240px)] flex-1 text-[12px] leading-relaxed">
          {partyAdvisory ? (
            <>
              الأسئلة أدناه <strong>استدلالية للأخصائي</strong> — تظهر فقط
              المسندة لـ<strong>{party.name}</strong> في «علاقة المستخدم
              بالمعلومة» ولا تُعتبر إجابة نهائية في تقرير دراسة الحالة.
            </>
          ) : (
            <>
              تظهر هنا فقط الأسئلة المسندة لـ<strong>{party.name}</strong> في
              «علاقة المستخدم بالمعلومة». الأسئلة التي دورك فيها «لا دور» لا
              تُعرض.
            </>
          )}
        </p>
      ) : (
        <>
          <p className="m-0 min-w-[min(100%,240px)] flex-1 text-[12px] leading-relaxed">
            <strong>مسؤولية الأخصائي:</strong> تظهر الأسئلة المسندة لك في
            المصفوفة فقط. راجع إجابات الأطراف على الأسئلة الظاهرة، ثم حدّد
            إجابتك الرسمية واعتمدها حيث وُجدت مساهمات.
          </p>
          {partyContribCount > 0 ? (
            <Button size="sm" variant="outline" className="me-auto" onClick={onRefreshParty}>
              تحديث إجابات الأطراف ({partyContribCount})
            </Button>
          ) : (
            <span className="text-[11px] text-text-3">
              لا توجد إجابات من الأطراف بعد على الأسئلة الظاهرة.
            </span>
          )}
        </>
      )}
    </Note>
  );
}

export function SpecialistClosingCards({
  reportModel,
}: {
  reportModel: ReturnType<typeof buildCaseStudyReportModel>;
}) {
  return (
    <div
      data-report-section
      className="pointer-events-auto select-auto [&_button]:cursor-pointer"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-border bg-surface-2/50 px-4 py-3.5">
        <div className="min-w-0">
          <div className="text-[13px] font-bold text-heading">التقرير النهائي</div>
          <p className="m-0 mt-0.5 text-[11px] leading-relaxed text-text-3">
            معاينة أو تحميل التقرير المملوء تلقائياً من إجابات التقرير
          </p>
        </div>
        <CaseStudyReportActions model={reportModel} />
      </div>
    </div>
  );
}
