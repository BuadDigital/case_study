import type { StaffUser } from "@platform/app-shared/prototype/constants";
import { resolveAssigneeDisplayName } from "@platform/app-shared/fees/party-fee-meta";
import type { CaseStudyInfoPartyId } from "@settings/mfe/lib/prototype/case-study-info-roles-data";
import {
  assigneeLabel,
  getCaseSpecialists,
  getEngineeringOffices,
  getFieldInspectors,
  getValuators,
} from "./distribution-parties";
import {
  migrateDistribution,
  type TaskDistributionDraft,
  type WorkflowTask,
  type WorkflowTaskKind,
} from "./tasks-storage";

export type CaseStudyTrackState = "new" | "progress" | "done";

export type CaseStudyTrack = {
  id: string;
  label: string;
  state: CaseStudyTrackState;
  progressPct: number;
  assigneeName: string;
};

const TRACK_KIND: Record<
  string,
  Exclude<WorkflowTaskKind, "case-study-property"> | "parent"
> = {
  survey: "engineering-survey",
  inspection: "field-inspection",
  appraisal: "property-appraisal",
  government: "government-review",
  caseStudy: "parent",
};

export function trackStateFromTask(
  child: WorkflowTask | undefined,
  spawned: boolean,
): CaseStudyTrackState {
  if (!spawned) return "new";
  if (!child) return "new";
  if (child.status === "completed") return "done";
  return "progress";
}

function progressPctForState(state: CaseStudyTrackState): number {
  if (state === "done") return 100;
  // Open / assigned ≠ half complete without form or submission evidence.
  return 0;
}

function findChild(
  children: WorkflowTask[],
  kind: Exclude<WorkflowTaskKind, "case-study-property">,
): WorkflowTask | undefined {
  return children.find((t) => t.kind === kind);
}

function distributionAssignee(
  distribution: TaskDistributionDraft,
  trackId: string,
  staffUsers: StaffUser[],
): string {
  if (trackId === "survey") {
    return assigneeLabel(
      getEngineeringOffices(staffUsers),
      distribution.engineeringOfficeId,
    );
  }
  if (trackId === "inspection") {
    return assigneeLabel(getFieldInspectors(staffUsers), distribution.inspectorId);
  }
  if (trackId === "appraisal") {
    return assigneeLabel(getValuators(staffUsers), distribution.valuatorId);
  }
  if (trackId === "caseStudy") {
    return assigneeLabel(
      getCaseSpecialists(staffUsers),
      distribution.caseSpecialistId,
    );
  }
  return "";
}

function distributionAssigneeId(
  distribution: TaskDistributionDraft,
  trackId: string,
): string | null {
  if (trackId === "survey") return distribution.engineeringOfficeId || null;
  if (trackId === "government") return distribution.governmentAuditorId || null;
  if (trackId === "inspection") return distribution.inspectorId || null;
  if (trackId === "appraisal") return distribution.valuatorId || null;
  if (trackId === "caseStudy") return distribution.caseSpecialistId || null;
  return null;
}

export function buildCaseStudyTracks(
  parent: WorkflowTask,
  allTasks: WorkflowTask[],
  staffUsers: StaffUser[] = [],
): CaseStudyTrack[] {
  const distribution = migrateDistribution(parent.distribution);
  const children = allTasks.filter((t) => t.parentTaskId === parent.id);

  // المرحلة الحكومية لا تُفعَّل من التوزيع — تظهر إذا وُجدت مهمة طرف (مثلاً من العمليات).
  const governmentSpawned = Boolean(
    findChild(children, "government-review"),
  );

  const defs: { id: string; label: string; spawned: boolean }[] = [
    {
      id: "survey",
      label: "الرفع المساحي",
      spawned: distribution.engineeringOffice,
    },
    {
      id: "inspection",
      label: "المعاينة الميدانية",
      spawned: distribution.valuationDepartment,
    },
    {
      id: "appraisal",
      label: "التقييم العقاري",
      spawned: distribution.valuationDepartment,
    },
    {
      id: "government",
      label: "المراجعة الحكومية",
      spawned: governmentSpawned,
    },
    { id: "caseStudy", label: "دراسة الحالة", spawned: true },
  ];

  return defs.map(({ id, label, spawned }) => {
    const kind = TRACK_KIND[id];
    const child =
      kind === "parent"
        ? parent
        : findChild(children, kind as Exclude<WorkflowTaskKind, "case-study-property">);
    const state =
      kind === "parent"
        ? parent.status === "completed" || parent.phase === "done"
          ? "done"
          : parent.phase === "case-study"
            ? "progress"
            : "new"
        : trackStateFromTask(child, spawned);
    const distName = distributionAssignee(distribution, id, staffUsers);
    const assigneeName = resolveAssigneeDisplayName({
      assigneeName: child?.assigneeName,
      assigneeId: child?.assigneeId || distributionAssigneeId(distribution, id),
      staffUsers,
      fallback: distName || "—",
    });

    return {
      id,
      label,
      state,
      progressPct: progressPctForState(state),
      assigneeName,
    };
  });
}

export function caseStudyTrackBadgeClass(state: CaseStudyTrackState): string {
  if (state === "done") return "b-done";
  if (state === "progress") return "b-prog";
  return "b-new";
}

export function caseStudyTrackBadgeLabel(state: CaseStudyTrackState): string {
  if (state === "done") return "مكتمل";
  if (state === "progress") return "قيد التنفيذ";
  return "جديد";
}

export type CaseStudyPartyAssignee = {
  trackId: string;
  shortLabel: string;
  enabled: boolean;
  name: string;
  state: CaseStudyTrackState;
  progressPct: number;
};

const CASE_STUDY_PARTY_DEFS = [
  { trackId: "inspection", shortLabel: "المعاين", partyId: "insp" },
  { trackId: "appraisal", shortLabel: "المقيم", partyId: "val" },
  { trackId: "survey", shortLabel: "المكتب الهندسي", partyId: "eng" },
] as const;

/**
 * Party columns for دراسة حالة العقارات queue table.
 *
 * Progress priority:
 * 1. Task completed → 100% (workflow truth beats form-fill ratio)
 * 2. Otherwise form fill % when provided (case-study answers)
 * 3. Else coarse track % (0 or 100 from task completed state)
 */
export function buildCaseStudyPartyAssignees(
  parent: WorkflowTask,
  allTasks: WorkflowTask[],
  progressByParty?: Partial<Record<CaseStudyInfoPartyId, number>>,
  staffUsers: StaffUser[] = [],
): CaseStudyPartyAssignee[] {
  const tracks = buildCaseStudyTracks(parent, allTasks, staffUsers);
  const distribution = migrateDistribution(parent.distribution);

  return CASE_STUDY_PARTY_DEFS.map((def) => {
    const track = tracks.find((t) => t.id === def.trackId);
    const state = track?.state ?? "new";
    const enabled =
      def.trackId === "inspection" || def.trackId === "appraisal"
        ? distribution.valuationDepartment
        : distribution.engineeringOffice;

    const formPct =
      progressByParty === undefined
        ? undefined
        : (progressByParty[def.partyId] ?? 0);
    const progressPct =
      state === "done"
        ? 100
        : formPct !== undefined
          ? formPct
          : (track?.progressPct ?? 0);

    return {
      trackId: def.trackId,
      shortLabel: def.shortLabel,
      enabled,
      name: track?.assigneeName ?? "—",
      state,
      progressPct,
    };
  });
}
