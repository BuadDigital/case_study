"use client";

/**
 * «حالة الأطراف» — where each party of a transaction stands (the case specialist, the inspector, the
 * engineering office, the appraiser), drawn in two places from this one file:
 * - the property's details page and the parties' own pages, in the timeline column, each row with
 *   the assignee's name over his role (`PropertyTransactionTimeline`);
 * - under the sections rail of the frame pages — the work page, the coordinator's page and the
 *   appraiser's page — with the role alone (Omar 2026-11-11: «بدون أسماء، فقط الدور»), the case
 *   specialist as his three sub-roles: «تنسيق الدراسة», «دراسة العقار», «المراجعة والرفع».
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useWindowEvents } from "@platform/app-shared/hooks/useWindowEvents";
import { FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT } from "@platform/app-shared/events/app-events";
import { getReportDraftState } from "@platform/app-shared/workflow/report-draft-state";
import { useReportDraftStates } from "@platform/app-shared/workflow/use-report-draft-states";
import { cn, opsPanelCard } from "@platform/ui-kit";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import { loadInspectorWorkspaceSnapshot } from "../../lib/app-data/inspector-workspace-reads";
import { buildPropertyDetailTimelinePartyRows } from "../../lib/app-data/property-detail-parties";
import { caseStudyFamilyTaskForProperty } from "../../lib/app-data/tasks";
import { useWorkflowTasksQuery } from "../../query/case-study-queries";
import { useTransactionQuery } from "../../query/use-transaction-query";
import { DetailBadge } from "./PropertyDetailFields";
import { PropertyValuationFiguresCard } from "./PropertyValuationFiguresCard";

export type PropertyPartyStatusRow = ReturnType<typeof buildPropertyDetailTimelinePartyRows>[number];

/**
 * A titled card of the side columns (the timeline column and the sections rail).
 * `dense` is the rail's: narrower side padding, as its column is 230px wide.
 */
export function SideCard({
  title,
  icon,
  dense = false,
  children,
}: {
  title: string;
  icon?: ReactNode;
  dense?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn(opsPanelCard, dense ? "px-3 py-3" : "px-4 py-3.5")}>
      <div className="mb-3 flex items-center gap-1.5 text-[12.5px] font-bold text-heading">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function badgeToneFromClass(
  badgeClass: string,
): "teal" | "amber" | "red" | "gray" {
  if (badgeClass.includes("teal")) return "teal";
  if (badgeClass.includes("amber")) return "amber";
  if (badgeClass.includes("red")) return "red";
  return "gray";
}

/**
 * Ring fill = completion only.
 * "In progress" is status, not 50% work done — empty ring until completed.
 */
function partyRingProgress(badgeClass: string): number {
  if (badgeClass.includes("teal")) return 1;
  return 0;
}

function partyRingColor(badgeClass: string): string {
  if (badgeClass.includes("teal")) return "#3f8f5f";
  if (badgeClass.includes("amber")) return "#a4906f";
  return "#a4a6ad";
}

function PartyRing({ progress, color }: { progress: number; color: string }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative h-6 w-6 shrink-0" aria-hidden>
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        className="-rotate-90"
      >
        <circle
          cx="12"
          cy="12"
          r={r}
          fill="none"
          stroke="var(--border, #ece8df)"
          strokeWidth="3"
        />
        <circle
          cx="12"
          cy="12"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c.toFixed(1)}
          strokeDashoffset={(c * (1 - progress)).toFixed(1)}
        />
      </svg>
    </span>
  );
}

/**
 * The parties of one property with their status, for «حالة الأطراف».
 *
 * How it works: the rows come from `buildPropertyDetailTimelinePartyRows` over the workflow tasks
 * and the staff list; the inspector's row also reads his package (a submitted or accepted package
 * counts as done while his task row is still open), re-read when an inspection is submitted; the
 * appraiser's row is refined by where the report draft stands once his package is handed over.
 * Edge cases: no inspection task → not submitted; the draft state is asked for only after the
 * appraiser's package is handed over. `specialistSubRoles` (the rail's card) lists the case
 * specialist as his three sub-roles; `studyHolderTaskId` then names the task holding the study.
 */
export function usePropertyPartyRows(
  poNumberRaw: string,
  propertyId: string,
  options?: { specialistSubRoles?: boolean; studyHolderTaskId?: string },
): PropertyPartyStatusRow[] {
  const specialistSubRoles = options?.specialistSubRoles === true;
  const studyHolderTaskId = options?.studyHolderTaskId;
  const { data: tasks = [] } = useWorkflowTasksQuery();
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];
  const poNumber = poNumberRaw.trim();

  const [inspectionRevision, setInspectionRevision] = useState(0);
  useWindowEvents({
    [FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT]: () =>
      setInspectionRevision((n) => n + 1),
  });

  const task = useMemo(
    () => caseStudyFamilyTaskForProperty(poNumber, propertyId, tasks),
    [poNumber, propertyId, tasks],
  );

  const inspectionTaskId = useMemo(() => {
    const onProperty = tasks.filter(
      (row) =>
        row.propertyId === propertyId && row.poNumber.trim() === poNumber,
    );
    const inspection = onProperty.find(
      (row) => row.kind === "field-inspection" && row.status !== "cancelled",
    );
    if (inspection) return inspection.id;
    return (
      onProperty.find((row) => row.fieldInspectionTaskId?.trim())
        ?.fieldInspectionTaskId?.trim() || null
    );
  }, [tasks, propertyId, poNumber]);

  const [inspectionSubmitted, setInspectionSubmitted] = useState(false);
  // No inspection task: not submitted — reset during render, before the effect would run.
  const submittedTaskId = inspectionTaskId?.trim() ?? "";
  const [submittedFor, setSubmittedFor] = useState(submittedTaskId);
  if (submittedFor !== submittedTaskId) {
    setSubmittedFor(submittedTaskId);
    if (!submittedTaskId) setInspectionSubmitted(false);
  }
  useEffect(() => {
    const taskId = inspectionTaskId?.trim();
    if (!taskId) return;
    let cancelled = false;
    void loadInspectorWorkspaceSnapshot(taskId).then((draft) => {
      if (cancelled) return;
      setInspectionSubmitted(
        draft?.status === "submitted" ||
          Boolean(draft?.acceptedAtUtc?.trim()),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [inspectionTaskId, inspectionRevision]);

  const appraisalPackageSubmitted = useMemo(
    () =>
      tasks.some(
        (row) =>
          row.kind === "property-appraisal" &&
          row.propertyId === propertyId &&
          row.poNumber.trim() === poNumber &&
          row.appraisalPackageStatus === "submitted",
      ),
    [tasks, propertyId, poNumber],
  );
  // Where the report draft stands (valuation service) — only worth asking once the package is handed over.
  const draftStateVersion = useReportDraftStates(
    [propertyId],
    appraisalPackageSubmitted,
  );

  return useMemo(
    () =>
      buildPropertyDetailTimelinePartyRows({
        task: task ?? null,
        allTasks: tasks,
        staffUsers,
        inspectionSubmitted,
        appraisal: {
          packageSubmitted: appraisalPackageSubmitted,
          draft: getReportDraftState(propertyId),
        },
        specialistSubRoles,
        studyHolderTaskId,
      }),
    // draftStateVersion: the draft state is read from the shared cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [task, tasks, staffUsers, inspectionSubmitted, appraisalPackageSubmitted, propertyId, draftStateVersion, specialistSubRoles, studyHolderTaskId],
  );
}

/**
 * The parties' rows: a completion ring, who the party is, and the status badge.
 *
 * How it works: with `showNames` (the timeline column) a row stacks the assignee's name over his
 * role; without it (the sections rail) the role alone names the row.
 * Edge cases: on the rail a badge that does not fit beside its role in the 230px column (the
 * longest, «معتمد — بانتظار رمز الإيداع») drops to its own line, at the row's end, instead of
 * squeezing the role.
 */
export function PartyStatusRows({
  rows,
  showNames = true,
}: {
  rows: readonly PropertyPartyStatusRow[];
  showNames?: boolean;
}) {
  return (
    <div className="grid gap-[9px]">
      {rows.map((row) => {
        const ring = (
          <PartyRing
            progress={partyRingProgress(row.badgeClass)}
            color={partyRingColor(row.badgeClass)}
          />
        );
        const badge = (
          <DetailBadge
            tone={badgeToneFromClass(row.badgeClass)}
            className={cn("px-1.5 py-px text-[10px]", !showNames && "ms-auto")}
          >
            {row.badge}
          </DetailBadge>
        );
        if (!showNames) {
          return (
            <div
              key={row.key}
              className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1"
              data-testid={`party-status-${row.key}`}
            >
              <span className="flex min-w-0 flex-auto items-center gap-1.5">
                {ring}
                <span className="text-[11.5px] font-semibold text-heading">
                  {row.role}
                </span>
              </span>
              {badge}
            </div>
          );
        }
        return (
          <div key={row.key} className="flex min-w-0 items-center gap-2">
            {ring}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[11.5px] font-semibold text-heading">
                {row.label}
              </span>
              <span className="block truncate text-[10px] text-text-2">
                {row.role}
              </span>
            </span>
            {badge}
          </div>
        );
      })}
    </div>
  );
}

/**
 * «حالة الأطراف» under the sections rail of a frame page (`WorkSectionsLayout`'s `railAside`):
 * the roles and their status, without the assignees' names — the case specialist as his three
 * sub-roles, read from the task that holds the transaction's study (as the rail above reads it).
 * Under it, the navy card of the district's land rates and the valuation's figures
 * (`PropertyValuationFiguresCard`, Omar 2026-11-11) — on the three pages that show this card:
 * the coordinator's, the work page and the appraiser's.
 */
export function PropertyPartiesRailCard({
  poNumber,
  propertyId,
  district,
  city,
  figures = true,
}: {
  poNumber: string;
  propertyId: string;
  /** The property's district and city — the figures card reads the district's land rates. */
  district?: string | null;
  city?: string | null;
  /**
   * The land rates and the valuation's figures under the status. Off on the inspector's page
   * (2026-11-12): he was never shown the valuation's figures, and the frame does not change that.
   */
  figures?: boolean;
}) {
  const { data: transaction } = useTransactionQuery(propertyId);
  const rows = usePropertyPartyRows(poNumber, propertyId, {
    specialistSubRoles: true,
    studyHolderTaskId: transaction?.studyHolderTaskId ?? undefined,
  });
  return (
    <>
      <section aria-label="حالة الأطراف" data-testid="rail-parties-status">
        <SideCard title="حالة الأطراف" dense>
          <PartyStatusRows rows={rows} showNames={false} />
        </SideCard>
      </section>
      {figures ? (
        <PropertyValuationFiguresCard propertyId={propertyId} district={district} city={city} />
      ) : null}
    </>
  );
}
