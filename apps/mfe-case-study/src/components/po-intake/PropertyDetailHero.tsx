"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { cn } from "@platform/design-system";
import { PoNumber } from "../ui/PoNumber";
import { PoPropertyDetailTopbarActions } from "./PoPropertyDetailTopbarActions";
import { DeliveryCountdown } from "./DeliveryCountdown";
import { DetailBadge, ltrValueClass } from "./PropertyDetailFields";
import {
  formatDateAr,
  formatPropertyLocation,
  identifierTypeLabel,
  showsCourtFields,
  type PoIntakeRecord,
  type PoPropertyIntake,
} from "../../lib/prototype/po-intake-data";
import { poPropertiesPath } from "../../lib/po-routes";
import { childTasksForCaseStudyParent } from "../../lib/prototype/case-study-party-answers";
import { caseStudyTaskForProperty } from "../../lib/prototype/tasks-storage";
import { useWorkflowTasksQuery } from "../../query/case-study-queries";

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
        "min-w-0 px-0 py-1 pe-[22px] ps-[18px]",
        !first && "border-s border-border",
        first && "ps-0 pe-[22px]",
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

/** Stage weights match Case Study.html completion ring. */
function estimateCaseStudyCompletion(args: {
  property: PoPropertyIntake;
  hasCaseStudyTask: boolean;
  hasInspection: boolean;
  inspectionDone: boolean;
  hasSurvey: boolean;
  surveyDone: boolean;
  hasAppraisal: boolean;
  appraisalDone: boolean;
  hasGov: boolean;
  govDone: boolean;
  hasKeysHint: boolean;
}): { pct: number; done: number; total: number } {
  const stages: number[] = [
    1, // البيانات الأساسية
    args.property.deedNumber.trim() ? 1 : 0.5, // مستندات / هوية العقار
    args.hasInspection ? (args.inspectionDone ? 1 : 0.5) : 0,
    args.hasSurvey ? (args.surveyDone ? 1 : 0.5) : 0,
    args.hasGov ? (args.govDone ? 1 : 0) : 0,
    args.hasKeysHint ? 1 : 0,
    args.hasAppraisal ? (args.appraisalDone ? 1 : 0) : 0,
    args.hasCaseStudyTask ? 0.5 : 0,
    0, // الرفع على إنفاذ — لا نفترض اكتماله
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
}: {
  record: PoIntakeRecord;
  property: PoPropertyIntake;
  /** 1-based index in PO properties list */
  propertyIndex: number;
}) {
  const { data: tasks = [] } = useWorkflowTasksQuery();
  const titleDeed = deedTitle(property);
  const locationLine = formatPropertyLocation(property);
  const courtLine = [property.court, property.circuit]
    .filter(Boolean)
    .join(" / ");
  const dueUrgent = record.dueDateAt ? isDueSoon(record.dueDateAt) : false;

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
    const gov = children.find((t) => t.kind === "government-review");
    const doneish = (status: string | undefined) => status === "completed";

    return estimateCaseStudyCompletion({
      property,
      hasCaseStudyTask: Boolean(parent),
      hasInspection: Boolean(inspection),
      inspectionDone: doneish(inspection?.status),
      hasSurvey: Boolean(survey),
      surveyDone: doneish(survey?.status),
      hasAppraisal: Boolean(appraisal),
      appraisalDone: doneish(appraisal?.status),
      hasGov: Boolean(gov),
      govDone: doneish(gov?.status),
      hasKeysHint: Boolean(property.requestNumber.trim()),
    });
  }, [record.poNumber, property, tasks]);

  return (
    <>
      <Link
        href={poPropertiesPath(record.poNumber)}
        className="mb-2 inline-flex items-center gap-1.5 border-0 bg-transparent p-0 py-1.5 text-[12.5px] font-semibold text-text-2 no-underline transition-colors hover:text-[#8c7857]"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="-scale-x-100"
          aria-hidden
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        <span>عقارات {record.poNumber.trim()}</span>
      </Link>

      <header className="mb-3.5 shrink-0 rounded-[12px] border border-border bg-surface px-5 pt-4 shadow-[0_1px_2px_rgba(18,40,76,0.03),0_6px_16px_-18px_rgba(18,40,76,0.10)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-[5px] flex flex-wrap items-center gap-1.5 text-[11px] text-text-3">
              <BuildingIcon />
              عقار {propertyIndex} من {record.properties.length} في{" "}
              <PoNumber value={record.poNumber} />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[19px] leading-snug font-bold text-heading">
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
                {record.assignmentType}
              </span>
              {property.deedStatus.trim() ? (
                <DetailBadge tone="gray">{property.deedStatus}</DetailBadge>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-[18px]">
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
          </div>
        </div>

        <div
          className="mt-3 flex flex-wrap gap-0 border-b border-border pb-3"
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
          <StripCell label="المتبقي للتسليم">
            <DeliveryCountdown dueIso={record.dueDateAt} />
          </StripCell>
        </div>

        <div className="flex flex-wrap items-center gap-2 py-[11px]">
          <span className="text-[11px] font-semibold text-text-3">
            الصفحة للاطلاع — الإجراءات حسب صلاحيات دورك:
          </span>
          <PoPropertyDetailTopbarActions
            poNumber={record.poNumber}
            propertyId={property.id}
            variant="hero"
          />
        </div>
      </header>
    </>
  );
}
