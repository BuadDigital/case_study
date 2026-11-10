"use client";

/**
 * The case-study app's share of the appraiser's page (Omar 2026-11-10: the appraiser's page takes
 * the work page's frame, and he reads the property and the study's results before he values):
 * the link to the property's details and the study's part of the summary section. The valuation
 * sections themselves are the evaluator app's (`EvaluatorWindow`).
 */
import { useRouter } from "next/navigation";
import { Button, Note, WORK_FORM_GRID_CLASS } from "@platform/ui-kit";
import { DEED_NATURE_MATCH_OPTIONS } from "@platform/app-shared/domain/case-study/deed-nature-match-outcomes";
import { poPropertyDetailPath } from "@platform/app-shared/domain/po-routes";
import { InsReadField } from "../components/po-intake/PropertyDetailInspectionFields";
import type { PoPropertyIntake } from "../lib/app-data/po-intake-data";
import type { WorkflowTask } from "../lib/app-data/tasks";
import { useCaseStudyReportBatchQuery } from "../query/case-study-queries";
import { useTransactionQuery } from "../query/use-transaction-query";

/** «تفاصيل العقار (المرجع)» — the page-level button beside «تقرير التقييم», as on the work page. */
export function AppraiserPageActions({
  poNumber,
  propertyId,
}: {
  poNumber: string;
  propertyId: string;
}) {
  const router = useRouter();
  return (
    <Button
      type="button"
      size="sm"
      variant="default"
      onClick={() => router.push(poPropertyDetailPath(poNumber, propertyId))}
    >
      تفاصيل العقار (المرجع)
    </Button>
  );
}

const REMARKS: readonly {
  key: "deedRemarks" | "surveyRemarks" | "componentsRemarks" | "occupancyRemarks";
  label: string;
}[] = [
  { key: "deedRemarks", label: "ملاحظات الصك" },
  { key: "surveyRemarks", label: "ملاحظات الرفع المساحي" },
  { key: "componentsRemarks", label: "ملاحظات المكوّنات" },
  { key: "occupancyRemarks", label: "ملاحظات الإشغال" },
];

/**
 * The study's part of the appraiser's summary section: the outcome of the deed match, the
 * specialist's remarks, and the deed's area and ownership — locked fields, four to a row.
 *
 * How it works: the study task is known by id only — the appraiser's task list holds his own
 * tasks, not the study's — so the id comes from the transaction (`studyHolderTaskId`, the deed
 * that holds the one study of a linked property) or else the appraisal task's parent; the
 * report is read with the batch query the lists use, which the appraiser may read.
 * Edge cases: study report not issued yet → a note says the valuation can be drafted meanwhile;
 * no report readable → the property's own fields alone; an empty remark is left out.
 */
export function AppraiserStudySummary({
  property,
  task,
}: {
  property: PoPropertyIntake;
  /** The appraiser's own task. */
  task: WorkflowTask;
}) {
  const { data: transaction } = useTransactionQuery(property.id);
  const studyTaskId = transaction?.studyHolderTaskId?.trim() || task.parentTaskId?.trim() || "";
  const { data: reports } = useCaseStudyReportBatchQuery(studyTaskId, {
    enabled: Boolean(studyTaskId),
  });
  const report = reports?.get(studyTaskId.toLowerCase())?.parent ?? null;
  const outcome =
    DEED_NATURE_MATCH_OPTIONS.find((o) => o.value === (report?.deedNatureMatchOutcome ?? ""))
      ?.label ?? "";

  return (
    <div className="mt-4" data-testid="appraiser-study-summary">
      <div className="mb-3 flex items-center gap-2.5">
        <span className="h-[17px] w-[3px] rounded-full bg-gold" aria-hidden />
        <h3 className="m-0 text-[14px] font-extrabold text-heading">نتائج دراسة الحالة</h3>
        <span className="flex-1 border-t border-border" aria-hidden />
      </div>

      {task.studyReportIssued !== true ? (
        <Note tone="info" className="mb-3">
          لم يصدر تقرير دراسة الحالة بعد — يمكنك إعداد التقييم كمسودة، وتكتمل النتائج هنا عند صدوره.
        </Note>
      ) : null}

      <div className={WORK_FORM_GRID_CLASS}>
        <InsReadField label="مطابقة الصك على الطبيعة" value={outcome} />
        <InsReadField label="مساحة الصك (م²)" value={property.area} ltr />
        <InsReadField label="الملكية" value={property.isSharedOwnership ? "مشاع" : "غير مشاع"} />
        {report?.deedNatureMatchNotes?.trim() ? (
          <InsReadField label="ملاحظات المطابقة" value={report.deedNatureMatchNotes} multiline />
        ) : null}
        {REMARKS.map(({ key, label }) =>
          report?.[key]?.trim() ? (
            <InsReadField key={key} label={label} value={report[key]} multiline />
          ) : null,
        )}
      </div>
      <p className="mb-0 mt-2 text-[12px] text-text-3">
        تُقرأ من دراسة الحالة ولا تُعدَّل من هنا.
      </p>
    </div>
  );
}
