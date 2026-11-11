"use client";

/**
 * The case-study app's share of the appraiser's page (Omar 2026-11-10: the appraiser's page takes
 * the work page's frame, and he reads the property and the study's results before he values):
 * the link to the property's details and the study's part of the summary section. The valuation
 * sections themselves are the evaluator app's (`EvaluatorWindow`).
 */
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Note, WORK_FORM_GRID_CLASS } from "@platform/ui-kit";
import { DEED_NATURE_MATCH_OPTIONS } from "@platform/app-shared/domain/case-study/deed-nature-match-outcomes";
import { poPropertyDetailPath } from "@platform/app-shared/domain/po-routes";
import { InsReadField } from "../components/po-intake/PropertyDetailInspectionFields";
import { appraiserAreaFacts, restrictionFacts } from "../lib/app-data/appraiser-summary-model";
import { loadInspectorWorkspaceSnapshot } from "../lib/app-data/inspector-workspace-reads";
import { loadEngineeringSurveySubmissionSnapshot } from "../lib/app-data/property-detail-party-submission-loaders";
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

/** A group of the summary: its gold bar and title, then its fields, as the work page's groups read. */
function SummaryGroup({
  title,
  testId,
  children,
}: {
  title: string;
  testId?: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-4" data-testid={testId}>
      <div className="mb-3 flex items-center gap-2.5">
        <span className="h-[17px] w-[3px] rounded-full bg-gold" aria-hidden />
        <h3 className="m-0 text-[14px] font-extrabold text-heading">{title}</h3>
        <span className="flex-1 border-t border-border" aria-hidden />
      </div>
      {children}
    </div>
  );
}

/**
 * The summary's three groups the appraiser reads before he values — the areas, the deed's legal
 * standing, and the study's results — as locked fields, four to a row.
 *
 * How it works: the study task is known by id only — the appraiser's task list holds his own
 * tasks, not the study's — so the id comes from the transaction (`studyHolderTaskId`, the deed
 * that holds the one study of a linked property) or else the appraisal task's parent; the
 * report is read with the batch query the lists use, which the appraiser may read. The areas add
 * the engineering office's survey and the inspector's measurements, read by the ids the server
 * stamps on his task once those packages are delivered (`engineeringSurveyTaskId`,
 * `fieldInspectionTaskId`); the legal standing adds the restrictions of the bourse stage, a
 * mortgage flagged in red.
 * Edge cases: study report not issued yet → a note says the valuation can be drafted meanwhile; no
 * report readable → the property's own fields alone; a survey or an inspection not delivered
 * (or one the appraiser may not read) leaves its fields «—»; an empty remark is left out; the
 * building licence's area is not recorded anywhere in the system, so it is not shown.
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

  const surveyTaskId = task.engineeringSurveyTaskId?.trim() ?? "";
  const inspectionTaskId = task.fieldInspectionTaskId?.trim() ?? "";
  const { data: survey } = useQuery({
    queryKey: ["appraiser-summary", "survey", surveyTaskId],
    enabled: Boolean(surveyTaskId),
    staleTime: 60_000,
    retry: false,
    queryFn: () => loadEngineeringSurveySubmissionSnapshot(surveyTaskId),
  });
  const { data: inspector } = useQuery({
    queryKey: ["appraiser-summary", "inspector", inspectionTaskId],
    enabled: Boolean(inspectionTaskId),
    staleTime: 60_000,
    retry: false,
    queryFn: () => loadInspectorWorkspaceSnapshot(inspectionTaskId),
  });
  const areas = appraiserAreaFacts({
    deedArea: property.area,
    survey: survey ?? null,
    inspector: inspector ?? null,
  });
  const restrictions = restrictionFacts(property);

  return (
    <div data-testid="appraiser-study-summary">
      <SummaryGroup title="المساحات" testId="appraiser-areas">
        <div className={WORK_FORM_GRID_CLASS}>
          <InsReadField label="مساحة الأرض (الصك)" value={areas.deed} ltr />
          <InsReadField label="مساحة الأرض (الرفع المساحي)" value={areas.survey} ltr />
          {areas.surveyNature ? (
            <InsReadField label="مساحة الأرض (الرفع المساحي — الطبيعة)" value={areas.surveyNature} ltr />
          ) : null}
          {areas.built ? <InsReadField label="مسطح البناء (المعاين)" value={areas.built} ltr /> : null}
          {areas.annex ? <InsReadField label="الملاحق (المعاين)" value={areas.annex} ltr /> : null}
          {areas.basement ? <InsReadField label="القبو (المعاين)" value={areas.basement} ltr /> : null}
          {areas.buildingsTotal ? (
            <InsReadField label="إجمالي المباني (المعاين)" value={areas.buildingsTotal} ltr />
          ) : null}
        </div>
        {areas.gapLine ? (
          <Note tone="warn" className="mb-0 mt-3">
            {areas.gapLine}
          </Note>
        ) : null}
      </SummaryGroup>

      <SummaryGroup title="الوضع النظامي" testId="appraiser-legal">
        <div className={WORK_FORM_GRID_CLASS}>
          <InsReadField label="الملكية" value={property.isSharedOwnership ? "مشاع" : "غير مشاع"} />
          <InsReadField
            label="القيود على الصك"
            value={restrictions.text}
            multiline={restrictions.text.length > 40}
            badge={
              restrictions.flags.length > 0 ? (
                <span className="flex flex-wrap gap-1">
                  {restrictions.flags.map((f) => (
                    <Badge key={f.label} tone={f.tone}>
                      {f.label}
                    </Badge>
                  ))}
                </span>
              ) : undefined
            }
          />
        </div>
      </SummaryGroup>

      <SummaryGroup title="نتائج دراسة الحالة">
        {task.studyReportIssued !== true ? (
          <Note tone="info" className="mb-3">
            لم يصدر تقرير دراسة الحالة بعد — يمكنك إعداد التقييم كمسودة، وتكتمل النتائج هنا عند صدوره.
          </Note>
        ) : null}

        <div className={WORK_FORM_GRID_CLASS}>
          <InsReadField label="مطابقة الصك على الطبيعة" value={outcome} />
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
      </SummaryGroup>
    </div>
  );
}
