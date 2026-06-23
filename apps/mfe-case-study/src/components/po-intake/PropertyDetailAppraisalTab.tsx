"use client";

import { getCachedEvaluatorReport } from "@evaluator/mfe";
import { DocIconButton, FieldBox, FieldsGrid, InfoBox, SectionHeader } from "./PropertyDetailFields";
import {
  downloadPropertyDetailDocument,
  type PropertyDetailDocumentEntry,
} from "../../lib/prototype/property-detail-documents";
import type { PropertyDetailPartySubmission } from "../../lib/prototype/property-detail-party-submissions";
import { InlineLoadingSkeleton } from "@platform/design-system";

function fieldValue(
  submission: PropertyDetailPartySubmission | null | undefined,
  label: string,
): string {
  return submission?.fields.find((f) => f.label === label)?.value?.trim() ?? "";
}

export function PropertyDetailAppraisalTab({
  submission,
  loading,
  appraisalTaskId,
  appraiserName,
}: {
  submission: PropertyDetailPartySubmission | null | undefined;
  loading: boolean;
  appraisalTaskId: string | null;
  appraiserName: string;
}) {
  const report = appraisalTaskId ? getCachedEvaluatorReport(appraisalTaskId) : null;
  const reportDoc: PropertyDetailDocumentEntry | null =
    report?.fileName?.trim() && report.dataUrl
      ? {
          id: "appraisal-report",
          name: "تقرير التقييم",
          fileName: report.fileName.trim(),
          source: "المقيّم العقاري",
          kind: "pdf",
          dataUrl: report.dataUrl,
        }
      : null;

  const price = fieldValue(submission, "سعر التقييم");
  const appraisalDate =
    fieldValue(submission, "تاريخ التقييم") ||
    fieldValue(submission, "تاريخ إصدار التقرير") ||
    fieldValue(submission, "تاريخ الإرسال");
  const entity = appraiserName.trim() || "—";
  const notes =
    submission?.remarks.find((r) => r.label === "ملاحظات المقيّم")?.value?.trim() ??
    "";
  const certificate =
    fieldValue(submission, "تقرير التقييم") ||
    fieldValue(submission, "مرفق التقييم المعتمد") ||
    report?.fileName?.trim() ||
    "";
  const status = fieldValue(submission, "حالة التقييم");
  const hasData = Boolean(
    submission?.hasData || price || appraisalDate || certificate || reportDoc,
  );

  if (loading) {
    return <InlineLoadingSkeleton />;
  }

  return (
    <>
      <SectionHeader>ملخص التقييم</SectionHeader>
      {!hasData ? (
        <InfoBox icon="ℹ">
          لم يتم رفع تقرير التقييم بعد. يُستكمل هذا القسم بعد إتمام المقيّم
          لعمله.
        </InfoBox>
      ) : (
        <InfoBox variant="teal" icon="✓">
          {status || "بيانات التقييم متوفرة"}
          {appraisalDate ? ` — ${appraisalDate}` : ""}
        </InfoBox>
      )}

      <SectionHeader>قائمة التقييم</SectionHeader>
      <FieldsGrid>
        <FieldBox label="سعر التقييم" value={price} ltr emptyLabel="—" />
        <FieldBox label="تاريخ التقييم" value={appraisalDate} ltr emptyLabel="—" />
        <FieldBox label="جهة التقييم" value={entity} emptyLabel="—" />
        <FieldBox label="ملاحظات المقيّم" value={notes} emptyLabel="—" />
        <FieldBox label="رقم الشهادة" value={certificate} emptyLabel="—" />
        <FieldBox label="حالة التقرير" value={status} emptyLabel="—" />
      </FieldsGrid>

      {reportDoc ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-[var(--radius-DEFAULT)] bg-surface-2 px-3 py-2.5">
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-text">تقرير التقييم</div>
            <div className="truncate text-[11px] text-text-2">{reportDoc.fileName}</div>
          </div>
          <DocIconButton
            label="تحميل"
            onClick={() => downloadPropertyDetailDocument(reportDoc)}
          />
        </div>
      ) : null}
    </>
  );
}
