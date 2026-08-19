"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { cn } from "@platform/ui-kit";
import { PoNumber } from "../ui/PoNumber";
import { DetailBadge, ltrValueClass } from "./PropertyDetailFields";
import {
  assignmentCompositeTag,
  formatDateAr,
  formatPropertyLocation,
  identifierTypeLabel,
  propertyUiStatusLabel,
  propertyUiStatusTone,
  showsCourtFields,
  type PoIntakeRecord,
  type PoPropertyIntake,
} from "../../lib/prototype/po-intake-data";
import { childTasksForCaseStudyParent } from "../../lib/prototype/case-study-party-answers";
import { caseStudyTaskForProperty } from "../../lib/prototype/tasks-storage";
import { useWorkflowTasksQuery } from "../../query/case-study-queries";
import { useFailuresQuery } from "@failures/mfe";
import { derivePropertyUiStatus } from "../../lib/prototype/property-detail-ui-status";
import { useFavoriteProperties } from "../../lib/prototype/favorite-properties";
import { PoPropertyDetailTopbarActions } from "./PoPropertyDetailTopbarActions";

function deedTitle(property: { deedNumber: string }): string {
  return property.deedNumber.trim() || "—";
}

function isDueSoon(iso: string): boolean {
  if (!iso) return false;
  const due = new Date(iso.slice(0, 10));
  const now = new Date();
  const diff = due.getTime() - now.getTime();
  return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
}

function BuildingIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
    </svg>
  );
}

function StripCell({
  label,
  children,
  first,
}: {
  label: string;
  children: ReactNode;
  first?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 py-1",
        /* Mobile: 2-col grid cells — no side borders. */
        "max-lg:border-0 max-lg:px-0",
        /* Desktop: horizontal strip with dividers. */
        "lg:pe-[22px] lg:ps-[18px]",
        !first && "lg:border-s lg:border-border",
        first && "lg:ps-0 lg:pe-[22px]",
      )}
    >
      <div className="mb-0.5 text-[11px] text-text-3">{label}</div>
      <div className="text-[13px] font-semibold text-text">{children}</div>
    </div>
  );
}

function CompletionRing({
  pct,
  done,
  total,
}: {
  pct: number;
  done: number;
  total: number;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const r = 20;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped / 100);
  return (
    <div
      className="flex flex-col items-center gap-0.5"
      title={`اكتمال دراسة حالة العقار — ${done} من ${total} مرحلة مكتملة`}
    >
      <div className="relative h-[50px] w-[50px]">
        <svg
          width="50"
          height="50"
          viewBox="0 0 50 50"
          className="-rotate-90"
          aria-hidden
        >
          <circle
            cx="25"
            cy="25"
            r={r}
            fill="none"
            stroke="var(--border, #ece8df)"
            strokeWidth="5"
          />
          <circle
            cx="25"
            cy="25"
            r={r}
            fill="none"
            stroke="var(--gold, #a4906f)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={c.toFixed(1)}
            strokeDashoffset={offset.toFixed(1)}
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-xs font-extrabold text-heading [direction:ltr]">
          {clamped}%
        </span>
      </div>
    </div>
  );
}

/**
 * Case Study.html completion ring stages:
 * ST = البيانات الأساسية, مستندات, معاينة, مساحي, مراجعات, مفاتيح, تقييم, دراسة, إنفاذ
 * weight: 1 done · 0.5 in progress · 0 not started
 */

function estimateCaseStudyCompletion(args: {
  property: PoPropertyIntake;
  hasCaseStudyTask: boolean;
  caseStudyDone: boolean;
  hasInspection: boolean;
  inspectionDone: boolean;
  hasSurvey: boolean;
  surveyDone: boolean;
  hasAppraisal: boolean;
  appraisalDone: boolean;
  hasGov: boolean;
  govDone: boolean;
  hasKeysHint: boolean;
  enfathDone: boolean;
}): { pct: number; done: number; total: number } {
  const stage = (has: boolean, done: boolean, partialWhenHas = true) => {
    if (done) return 1;
    if (has && partialWhenHas) return 0.5;
    return 0;
  };

  const stages: number[] = [
    1, // البيانات الأساسية — دائماً مكتمل في العرض
    args.property.deedNumber.trim() ? 1 : 0.5, // مستندات العقار
    stage(args.hasInspection, args.inspectionDone), // معاينة العقار
    stage(args.hasSurvey, args.surveyDone), // التقرير المساحي
    stage(args.hasGov, args.govDone, false), // المراجعات: 1 أو 0 مثل HTML
    args.hasKeysHint ? 1 : 0, // مفاتيح العقار
    stage(args.hasAppraisal, args.appraisalDone, false), // تقييم العقار
    stage(args.hasCaseStudyTask, args.caseStudyDone), // دراسة العقار
    args.enfathDone ? 1 : 0, // الرفع على إنفاذ
  ];
  const total = stages.length;
  const sum = stages.reduce((a, b) => a + b, 0);
  const done = stages.filter((s) => s === 1).length;
  return {
    pct: Math.round((sum / total) * 100),
    done,
    total,
  };
}

export function PropertyDetailHero({
  record,
  property,
  propertyIndex,
  hideOpenCaseStudy = false,
}: {
  record: PoIntakeRecord;
  property: PoPropertyIntake;
  /** 1-based index in PO properties list */
  propertyIndex: number;
  hideOpenCaseStudy?: boolean;
}) {
  const { data: tasks = [] } = useWorkflowTasksQuery();
  const { data: failures = [] } = useFailuresQuery();
  const { isFavorite, toggleFavorite } = useFavoriteProperties();
  const titleDeed = deedTitle(property);
  const favorite = isFavorite(record.poNumber, property.id);
  const locationLine = formatPropertyLocation(property);
  const courtLine = [property.court, property.circuit]
    .filter(Boolean)
    .join(" / ");
  const dueUrgent = record.dueDateAt ? isDueSoon(record.dueDateAt) : false;

  const uiStatus = useMemo(
    () =>
      derivePropertyUiStatus({
        poNumber: record.poNumber.trim(),
        property,
        tasks,
        failures,
      }),
    [record.poNumber, property, tasks, failures],
  );

  const completion = useMemo(() => {
    const parent = caseStudyTaskForProperty(
      record.poNumber.trim(),
      property.id,
      tasks,
    );
    const children = parent
      ? childTasksForCaseStudyParent(parent.id, tasks)
      : [];
    const inspection = children.find((t) => t.kind === "field-inspection");
    const survey = children.find((t) => t.kind === "engineering-survey");
    const appraisal = children.find((t) => t.kind === "property-appraisal");
    const doneish = (status: string | undefined) => status === "completed";

    return estimateCaseStudyCompletion({
      property,
      hasCaseStudyTask: Boolean(parent),
      caseStudyDone: doneish(parent?.status),
      hasInspection: Boolean(inspection),
      inspectionDone: doneish(inspection?.status),
      hasSurvey: Boolean(survey),
      surveyDone: doneish(survey?.status),
      hasAppraisal: Boolean(appraisal),
      appraisalDone: doneish(appraisal?.status),
      hasGov: false,
      govDone: false,
      hasKeysHint: Boolean(property.requestNumber.trim()),
      enfathDone: false,
    });
  }, [record.poNumber, property, tasks]);

  return (
    <>
      <header className="mb-3.5 shrink-0 rounded-[12px] border border-border bg-surface px-3.5 pt-3.5 shadow-[0_1px_2px_rgba(18,40,76,0.03),0_6px_16px_-18px_rgba(18,40,76,0.10)] sm:px-5 sm:pt-4">
        <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-[5px] flex flex-wrap items-center gap-1.5 text-[11px] text-text-3">
              <BuildingIcon />
              عقار {propertyIndex} من {record.properties.length} في{" "}
              <PoNumber value={record.poNumber} />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[17px] leading-snug font-bold text-heading sm:text-[19px]">
              <button
                type="button"
                className={cn(
                  "inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-[color-mix(in_srgb,var(--gold)_28%,transparent)] bg-[color-mix(in_srgb,var(--gold)_12%,transparent)] text-[var(--gold-d,#8c7857)] shadow-sm transition-all hover:border-gold hover:bg-[color-mix(in_srgb,var(--gold)_18%,transparent)] active:scale-95",
                  favorite &&
                    "border-gold bg-[color-mix(in_srgb,var(--gold)_22%,var(--surface))] text-gold-d",
                )}
                aria-label={
                  favorite ? "إزالة المعاملة من المفضلة" : "إضافة المعاملة إلى المفضلة"
                }
                aria-pressed={favorite}
                title={
                  favorite ? "إزالة من المفضلة" : "إضافة إلى المفضلة"
                }
                onClick={() => toggleFavorite(record.poNumber, property.id)}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill={favorite ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="m12 2.8 2.84 5.75 6.35.92-4.6 4.48 1.09 6.33L12 17.3l-5.68 2.98 1.09-6.33-4.6-4.48 6.35-.92L12 2.8Z" />
                </svg>
              </button>
              <span>
                صك رقم{" "}
                <bdi dir="ltr" className={ltrValueClass}>
                  {titleDeed}
                </bdi>
              </span>
              <span className="rounded-md border border-[color-mix(in_srgb,#2a8f8f_28%,transparent)] bg-[color-mix(in_srgb,#2a8f8f_12%,transparent)] px-2.5 py-[3px] text-[10.5px] font-bold text-[#1f6f6f]">
                {identifierTypeLabel(property.identifierType)}
              </span>
              <span className="rounded-md border border-[color-mix(in_srgb,#d9a441_32%,transparent)] bg-[color-mix(in_srgb,#d9a441_14%,transparent)] px-2.5 py-[3px] text-[10.5px] font-bold text-[#8a5e14]">
                {assignmentCompositeTag(record.assignmentType)}
              </span>
              <DetailBadge tone={propertyUiStatusTone(uiStatus)}>
                {propertyUiStatusLabel(uiStatus)}
              </DetailBadge>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3 sm:gap-[18px]">
            <div className="text-start">
              <div className="mb-0.5 text-[11px] text-text-3">رقم الطلب</div>
              <div className="text-[21px] font-bold text-[#8c7857]">
                <bdi dir="ltr" className={ltrValueClass}>
                  {property.requestNumber.trim() || "—"}
                </bdi>
              </div>
            </div>
            <CompletionRing
              pct={completion.pct}
              done={completion.done}
              total={completion.total}
            />
            <PoPropertyDetailTopbarActions
              poNumber={record.poNumber}
              propertyId={property.id}
              variant="hero"
              hideOpenCaseStudy={hideOpenCaseStudy}
            />
          </div>
        </div>

        <div
          className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-b border-border pb-3 lg:flex lg:flex-wrap lg:gap-0"
          aria-label="ملخص العقار"
        >
          <StripCell label="اسم المالك" first>
            {property.ownerName.trim() || "—"}
          </StripCell>
          <StripCell label="المدينة / الحي">
            {locationLine || "—"}
          </StripCell>
          <StripCell label="التصنيف">
            {property.classification.trim() || "—"}
          </StripCell>
          <StripCell label="المساحة">
            {property.area.trim() ? `${property.area.trim()} م²` : "—"}
          </StripCell>
          {showsCourtFields(record.assignmentType) ? (
            <StripCell label="المحكمة / الدائرة">
              {courtLine || "—"}
            </StripCell>
          ) : null}
          <StripCell label="تاريخ الاستحقاق">
            {record.dueDateAt ? (
              <bdi
                dir="ltr"
                className={cn(ltrValueClass, dueUrgent && "text-danger-text")}
              >
                {formatDateAr(record.dueDateAt)}
              </bdi>
            ) : (
              "—"
            )}
          </StripCell>
          <StripCell label="استلام إنفاذ">
            {record.receivedFromEnfathAt ? (
              <bdi dir="ltr" className={ltrValueClass}>
                {formatDateAr(record.receivedFromEnfathAt)}
              </bdi>
            ) : (
              "—"
            )}
          </StripCell>
        </div>
      </header>
    </>
  );
}
