"use client";

/**
 * The case-study app's share of the appraiser's page (Omar 2026-11-10: the appraiser's page takes
 * the work page's frame, and he reads the property and the study's results before he values):
 * the link to the property's details and the study's part of the summary section. The valuation
 * sections themselves are the evaluator app's (`EvaluatorWindow`).
 */
import { useReducer } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Badge, Button, Note, WORK_FORM_GRID_CLASS } from "@platform/ui-kit";
import {
  loadSpecialistFinishingLevel,
  specialistFinishingLevelLabel,
} from "@platform/app-shared/app-data/valuation-report-specialist-finishing";
import { DEED_NATURE_MATCH_OPTIONS } from "@platform/app-shared/domain/case-study/deed-nature-match-outcomes";
import { poPropertyDetailPath } from "@platform/app-shared/domain/po-routes";
import { VALUATION_SPECIALIST_FINISHING_CHANGED_EVENT } from "@platform/app-shared/events/app-events";
import { useWindowEvents } from "@platform/app-shared/hooks/useWindowEvents";
import { PropertyBoundariesTable } from "../components/po-intake/PropertyBoundariesTable";
import { InsReadField } from "../components/po-intake/PropertyDetailInspectionFields";
import { SummaryGroup } from "../components/po-intake/SummaryGroup";
import {
  appraiserAlerts,
  appraiserAreaFacts,
  appraiserBoundaryRows,
  appraiserBuildingFacts,
  appraiserLocationFacts,
  appraiserViolationsText,
  restrictionFacts,
  type SummaryFact,
} from "../lib/app-data/appraiser-summary-model";
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

/** A group's facts as locked fields, four to a row; a long value takes its own row. */
function FactsGrid({ facts }: { facts: SummaryFact[] }) {
  return (
    <div className={WORK_FORM_GRID_CLASS}>
      {facts.map((fact) => (
        <InsReadField
          key={fact.label}
          label={fact.label}
          value={fact.value}
          multiline={fact.value.length > 40}
        />
      ))}
    </div>
  );
}

/**
 * What the appraiser reads before he values, under the photo and the map (Omar 2026-11-15): a line
 * of what needs his attention, then the location and its services, the four sides, the areas, the
 * building, the deed's legal standing, and the study's results — as locked fields, four to a row.
 * The page's header already names the property (its type, district, deed and owner), so none of
 * that is repeated here; the deed's land area alone is, beside the survey's it is compared with.
 *
 * How it works: the study task is known by id only — the appraiser's task list holds his own
 * tasks, not the study's — so the id comes from the transaction (`studyHolderTaskId`, the deed
 * that holds the one study of a linked property) or else the appraisal task's parent; the
 * report is read with the batch query the lists use, which the appraiser may read. The engineering
 * office's survey and the inspector's package are read by the ids the server stamps on his task
 * once they are delivered (`engineeringSurveyTaskId`, `fieldInspectionTaskId`); the finishing
 * level is the case specialist's. The restrictions, the area gap and a study outcome other than
 * «مطابق» are gathered in the «يستدعي الانتباه» line and so are not flagged again in their groups.
 * Edge cases: study report not issued yet → a note says the valuation can be drafted meanwhile; no
 * report readable → the property's own fields alone; a survey or an inspection not delivered
 * (or one the appraiser may not read) leaves its fields «—»; land has no «وصف المبنى» group; an
 * empty remark is left out; the number of facades is not recorded anywhere in the system — the
 * appraiser reads the streets off the four sides; nor is the building licence's area.
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
  const alerts = appraiserAlerts({
    restrictions,
    gapLine: areas.gapLine,
    deedNatureMatchOutcome: report?.deedNatureMatchOutcome,
  });
  // The specialist's finishing level lives in the synced report extras; re-read when it changes.
  const [, refreshFinishing] = useReducer((n: number) => n + 1, 0);
  useWindowEvents({ [VALUATION_SPECIALIST_FINISHING_CHANGED_EVENT]: refreshFinishing });
  const building = appraiserBuildingFacts(
    property,
    inspector ?? null,
    specialistFinishingLevelLabel(loadSpecialistFinishingLevel(property.id)),
  );

  return (
    <div data-testid="appraiser-study-summary">
      {alerts.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2" data-testid="appraiser-alerts">
          <span className="text-[13px] font-extrabold text-heading">يستدعي الانتباه:</span>
          {alerts.map((alert) => (
            <Badge key={alert.label} tone={alert.tone}>
              {alert.label}
            </Badge>
          ))}
        </div>
      ) : null}

      <SummaryGroup title="الموقع والخدمات" testId="appraiser-location">
        <FactsGrid facts={appraiserLocationFacts(property, inspector ?? null)} />
      </SummaryGroup>

      <SummaryGroup title="الحدود والأطوال" testId="appraiser-boundaries">
        <PropertyBoundariesTable rows={appraiserBoundaryRows(property, inspector ?? null)} showInspection />
      </SummaryGroup>

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
      </SummaryGroup>

      {building ? (
        <SummaryGroup title="وصف المبنى" testId="appraiser-building">
          <FactsGrid facts={building} />
        </SummaryGroup>
      ) : null}

      <SummaryGroup title="الوضع النظامي" testId="appraiser-legal">
        <FactsGrid
          facts={[
            { label: "الملكية", value: property.isSharedOwnership ? "مشاع" : "ملكية تامة" },
            { label: "حالة الصك", value: property.deedStatus.trim() },
            { label: "القيود على الصك", value: restrictions.text },
            { label: "المخالفات الظاهرة (المعاين)", value: appraiserViolationsText(inspector ?? null) },
          ]}
        />
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
