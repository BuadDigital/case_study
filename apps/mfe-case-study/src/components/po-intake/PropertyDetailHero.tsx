"use client";

import type { ReactNode } from "react";
import { useMemo, useRef } from "react";
import {
  cn,
  opsPanelCard,
} from "@platform/ui-kit";
import { useStickyCompact } from "@platform/app-shared/hooks/use-sticky-compact";
import { PoNumber } from "../ui/PoNumber";
import { ltrValueClass } from "./PropertyDetailFields";
import {
  assignmentCompositeTag,
  formatDateAr,
  formatPropertyLocation,
  identifierTypeLabel,
  propertyUiStatusLabel,
  showsCourtFields,
  type PoIntakeRecord,
  type PoPropertyIntake,
} from "../../lib/prototype/po-intake-data";
import { childTasksForCaseStudyParent } from "../../lib/prototype/case-study-party-answers";
import { caseStudyTaskForProperty } from "../../lib/prototype/tasks-storage";
import { useWorkflowTasksQuery } from "../../query/case-study-queries";
import { useFailuresQuery } from "@failures/mfe/query/failures-queries";
import { derivePropertyUiStatus } from "../../lib/prototype/property-detail-ui-status";
import { useFavoriteProperties } from "../../lib/prototype/favorite-properties";
import { PoPropertyDetailTopbarActions } from "./PoPropertyDetailTopbarActions";

function deedTitle(property: { deedNumber: string }): string {
  return property.deedNumber.trim() || "—";
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
  compact = false,
  valueTone,
}: {
  label: string;
  children: ReactNode;
  /** Collapsed hero: label and value sit inline on one tight row. */
  compact?: boolean;
  /** HTML strip: due date uses danger text. */
  valueTone?: "due";
}) {
  return (
    <div
      className={cn(
        "min-w-0 shrink-0 py-1",
        compact
          ? "flex items-center gap-1.5 py-0 text-start"
          : "text-center max-lg:text-start",
      )}
    >
      <div
        className={cn(
          "whitespace-nowrap text-text-3",
          compact ? "mb-0 text-[10px]" : "mb-[3px] text-[10.5px]",
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "whitespace-nowrap font-bold tabular-nums",
          compact ? "text-[11.5px]" : "text-[12.5px]",
          valueTone === "due" ? "text-danger-text" : "text-heading",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Field Inspection Workspace / Case Study.html completion donut. */
function CompletionRing({
  pct,
  done,
  total,
  compact = false,
}: {
  pct: number;
  done: number;
  total: number;
  compact?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const size = compact ? 32 : 46;
  const hole = compact ? 20 : 34;
  return (
    <div
      className="flex flex-col items-center"
      role="img"
      aria-label={`اكتمال الدراسة ${clamped}٪ — ${done} من ${total} مراحل مكتملة`}
      title={`اكتمال دراسة حالة العقار — ${done} من ${total} مرحلة مكتملة`}
    >
      <div
        className="grid place-items-center rounded-full"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(var(--gold, #a4906f) ${clamped}%, var(--surface-2, #f1ece2) 0)`,
        }}
      >
        <div
          className="grid place-items-center rounded-full bg-surface"
          style={{ width: hole, height: hole }}
        >
          <span className="text-[11px] font-extrabold tabular-nums text-heading [direction:ltr]">
            {clamped}%
          </span>
        </div>
      </div>
      <span
        className={cn(
          "mt-1 whitespace-nowrap text-[9.5px] text-text-3",
          compact && "hidden",
        )}
      >
        اكتمال الدراسة
      </span>
    </div>
  );
}

/**
 * Case Study.html completion ring stages:
 * ST = primary data, documents, inspection, survey, reviews, keys, valuation, case study, Infath
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
    1, // Primary data — always complete in the display
    args.property.deedNumber.trim() ? 1 : 0.5, // Property documents
    stage(args.hasInspection, args.inspectionDone), // Property inspection
    stage(args.hasSurvey, args.surveyDone), // Survey report
    stage(args.hasGov, args.govDone, false), // Reviews: 1 or 0 like HTML
    args.hasKeysHint ? 1 : 0, // Property keys
    stage(args.hasAppraisal, args.appraisalDone, false), // Property valuation
    stage(args.hasCaseStudyTask, args.caseStudyDone), // Property case study
    args.enfathDone ? 1 : 0, // Upload to Infath
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
  stickyCompact = false,
}: {
  record: PoIntakeRecord;
  property: PoPropertyIntake;
  /** 1-based index in PO properties list */
  propertyIndex: number;
  hideOpenCaseStudy?: boolean;
  /** Pin the hero and collapse it once the page scrolls (workspace screens). */
  stickyCompact?: boolean;
}) {
  const heroRef = useRef<HTMLElement>(null);
  const compact = useStickyCompact(heroRef, stickyCompact);
  const { data: tasks = [] } = useWorkflowTasksQuery();
  const { data: failures = [] } = useFailuresQuery();
  const { isFavorite, toggleFavorite } = useFavoriteProperties();
  const titleDeed = deedTitle(property);
  const favorite = isFavorite(record.poNumber, property.id);
  const locationLine = formatPropertyLocation(property);
  const courtLine = [property.court, property.circuit]
    .filter(Boolean)
    .join(" / ");

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
      <header
        ref={heroRef}
        className={cn(
          opsPanelCard,
          "mb-3.5 shrink-0 transition-[padding,box-shadow] duration-200",
          stickyCompact && "sticky top-[-1px] z-[5]",
          compact
            ? "px-4 py-1.5 shadow-[0_6px_18px_-14px_rgba(16,43,78,.55)]"
            : "px-[18px] pb-0 pt-3.5",
        )}
      >
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <div
              className={cn(
                "mb-0 flex flex-wrap items-center gap-1.5 text-[11px] text-text-3",
                compact && "hidden",
              )}
            >
              <BuildingIcon />
              عقار {propertyIndex} من {record.properties.length} في{" "}
              <PoNumber value={record.poNumber} />
            </div>
            <div
              className={cn(
                "mt-1.5 flex flex-wrap items-center gap-2.5",
                compact && "mt-0",
              )}
            >
              <button
                type="button"
                className="inline-flex shrink-0 cursor-pointer border-0 bg-transparent p-0 leading-none"
                aria-label={
                  favorite
                    ? "إزالة المعاملة من المفضلة"
                    : "إضافة المعاملة إلى المفضلة"
                }
                aria-pressed={favorite}
                title={favorite ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
                onClick={() => toggleFavorite(record.poNumber, property.id)}
              >
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill={favorite ? "var(--gold)" : "none"}
                  stroke="var(--gold)"
                  strokeWidth="1.6"
                  aria-hidden
                >
                  <path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.8l6.5-.9z" />
                </svg>
              </button>
              <h1
                className={cn(
                  "m-0 font-extrabold tabular-nums text-heading transition-[font-size] duration-200",
                  compact ? "text-[14px]" : "text-[21px]",
                )}
              >
                <bdi dir="ltr" className={ltrValueClass}>
                  {titleDeed}
                </bdi>
              </h1>
              {/* HTML badge colors: deed=gold, assignment=teal, work=amber */}
              <span
                className={cn(
                  "rounded-md font-bold whitespace-nowrap",
                  compact
                    ? "px-2 py-0.5 text-[10px]"
                    : "px-[11px] py-1 text-[11.5px]",
                  "bg-[color-mix(in_srgb,var(--gold)_18%,transparent)] text-gold-d",
                )}
              >
                {identifierTypeLabel(property.identifierType)}
              </span>
              <span
                className={cn(
                  "rounded-md font-bold whitespace-nowrap",
                  compact
                    ? "px-2 py-0.5 text-[10px]"
                    : "px-[11px] py-1 text-[11.5px]",
                  "bg-[color-mix(in_srgb,#2a8f8f_12%,transparent)] text-[#1f6f6f]",
                )}
              >
                {assignmentCompositeTag(record.assignmentType)}
              </span>
              <span
                className={cn(
                  "rounded-md font-bold whitespace-nowrap",
                  compact
                    ? "px-2 py-0.5 text-[10px]"
                    : "px-[11px] py-1 text-[11.5px]",
                  "bg-[var(--amber-light,#f7ecd8)] text-[var(--amber-text,#8a6116)]",
                )}
              >
                {propertyUiStatusLabel(uiStatus)}
              </span>
            </div>
          </div>

          <div
            className={cn(
              "flex shrink-0 items-center",
              compact ? "gap-3" : "gap-[18px] pt-1.5",
            )}
          >
            {property.referenceNumber?.trim() ? (
              <div className={cn("text-start", compact && "hidden")}>
                <div className="text-[10.5px] text-text-3">رقم المعاملة</div>
                <div className="text-[15px] font-bold tabular-nums text-heading">
                  <bdi dir="ltr" className={ltrValueClass}>
                    {property.referenceNumber.trim()}
                  </bdi>
                </div>
              </div>
            ) : null}
            {property.requestNumber.trim() ? (
              <div className="text-start">
                <div
                  className={cn(
                    "text-[10.5px] text-text-3",
                    compact && "hidden",
                  )}
                >
                  رقم الطلب
                </div>
                <div
                  className={cn(
                    "font-bold tabular-nums",
                    compact
                      ? "text-[11.5px] text-text-2"
                      : "text-[15px] text-heading",
                  )}
                >
                  <bdi dir="ltr" className={ltrValueClass}>
                    {property.requestNumber.trim()}
                  </bdi>
                </div>
              </div>
            ) : null}
            <CompletionRing
              pct={completion.pct}
              done={completion.done}
              total={completion.total}
              compact={compact}
            />
            <PoPropertyDetailTopbarActions
              poNumber={record.poNumber}
              propertyId={property.id}
              variant="hero"
              hideOpenCaseStudy={hideOpenCaseStudy}
            />
          </div>
        </div>

        {(() => {
          const stripCells: {
            label: string;
            node: ReactNode;
            valueTone?: "due";
          }[] = [];
          if (property.ownerName.trim())
            stripCells.push({
              label: "اسم المالك",
              node: property.ownerName.trim(),
            });
          if (locationLine)
            stripCells.push({ label: "المدينة / الحي", node: locationLine });
          if (property.classification.trim())
            stripCells.push({
              label: "التصنيف",
              node: property.classification.trim(),
            });
          if (property.area.trim())
            stripCells.push({
              label: "المساحة",
              node: `${property.area.trim()} م²`,
            });
          if (showsCourtFields(record.assignmentType) && courtLine && !compact)
            stripCells.push({ label: "المحكمة / الدائرة", node: courtLine });
          if (record.dueDateAt)
            stripCells.push({
              label: "تاريخ الاستحقاق",
              valueTone: "due",
              node: (
                <bdi dir="ltr" className={ltrValueClass}>
                  {formatDateAr(record.dueDateAt)}
                </bdi>
              ),
            });
          if (record.receivedFromEnfathAt)
            stripCells.push({
              label: "استلام إنفاذ",
              node: (
                <bdi dir="ltr" className={ltrValueClass}>
                  {formatDateAr(record.receivedFromEnfathAt)}
                </bdi>
              ),
            });
          if (stripCells.length === 0) return null;
          return (
            <div
              className={cn(
                "flex flex-wrap items-start",
                compact
                  ? "mt-1 gap-x-3 gap-y-1 border-0 pb-1.5"
                  : "mt-3 gap-x-5 gap-y-2 border-t border-border py-2.5 sm:gap-x-6 lg:gap-x-7",
              )}
              aria-label="ملخص العقار"
            >
              {stripCells.map((cell) => (
                <StripCell
                  key={cell.label}
                  label={cell.label}
                  compact={compact}
                  valueTone={cell.valueTone}
                >
                  {cell.node}
                </StripCell>
              ))}
            </div>
          );
        })()}
      </header>
    </>
  );
}
