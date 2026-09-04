"use client";

import type { ReactNode } from "react";
import { Button, FormGroup, Label, Note, Textarea, cn } from "@platform/ui-kit";

import { buildCaseStudyReportModel } from "../../lib/app-data/case-study-report-model";
import { CaseStudyReportActions } from "./CaseStudyReportActions";
import { CaseStudyProgressDonut } from "./CaseStudyProgressDonut";
import { CaseStudyDeedNatureMatchSection } from "./CaseStudyDeedNatureMatchSection";
import { CaseStudyInfathSpecialistSection } from "./CaseStudyInfathSpecialistSection";
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  disabled?: boolean;
}) {
  return (
    <FormGroup className="mb-0 border-0 pt-0">
      <Label className="mb-1.5 text-[11px] font-semibold text-text-2">
        {label}
      </Label>
      <Textarea
        rows={rows}
        placeholder="الملاحظات..."
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-[10px] border-border-md bg-surface"
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
      aria-label="تقدم النموذج"
    >
      <CaseStudyProgressDonut
        pct={pct}
        color="var(--ink, #102b4e)"
        label={submitted ? "تم رفع النموذج" : "اكتمال النموذج"}
        sub={`${answered} / ${summary.total}`}
      />
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
              بالمعلومة» ولا تُعتبر إجابة نهائية في نموذج الدراسة.
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
            معاينة أو تحميل التقرير المملوء تلقائياً من إجابات النموذج
          </p>
        </div>
        <CaseStudyReportActions model={reportModel} />
      </div>
    </div>
  );
}
