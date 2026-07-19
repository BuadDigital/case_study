import type { StaffUser } from "@platform/app-shared/prototype/constants";
import type { CaseStudyInfoPartyId } from "@settings/mfe/lib/prototype/case-study-info-roles-data";
import {
  assigneeLabel,
  getEngineeringOffices,
  getFieldInspectors,
  getGovernmentAuditors,
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
  if (state === "progress") return 50;
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
  if (trackId === "government") {
    return assigneeLabel(
      getGovernmentAuditors(staffUsers),
      distribution.governmentAuditorId,
    );
  }
  if (trackId === "inspection") {
    return assigneeLabel(getFieldInspectors(staffUsers), distribution.inspectorId);
  }
  if (trackId === "appraisal") {
    return assigneeLabel(getValuators(staffUsers), distribution.valuatorId);
  }
  return "";
}

export function buildCaseStudyTracks(
  parent: WorkflowTask,
  allTasks: WorkflowTask[],
  staffUsers: StaffUser[] = [],
): CaseStudyTrack[] {
  const distribution = migrateDistribution(parent.distribution);
  const children = allTasks.filter((t) => t.parentTaskId === parent.id);

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
      spawned: distribution.governmentAuditor,
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
    const assigneeName =
      child?.assigneeName?.trim() ||
      distributionAssignee(distribution, id, staffUsers) ||
      (kind === "parent" ? parent.assigneeName : "") ||
      "—";

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
  { trackId: "government", shortLabel: "المراجع الحكومي", partyId: "gov" },
  { trackId: "appraisal", shortLabel: "المقيم", partyId: "val" },
  { trackId: "survey", shortLabel: "المكتب الهندسي", partyId: "eng" },
] as const;

/** Party columns for دراسة حالة العقارات queue table. */
export function buildCaseStudyPartyAssignees(
  parent: WorkflowTask,
  allTasks: WorkflowTask[],
  progressByParty?: Partial<Record<CaseStudyInfoPartyId, number>>,
): CaseStudyPartyAssignee[] {
  const tracks = buildCaseStudyTracks(parent, allTasks);
  const distribution = migrateDistribution(parent.distribution);

  return CASE_STUDY_PARTY_DEFS.map((def) => {
    const track = tracks.find((t) => t.id === def.trackId);
    const enabled =
      def.trackId === "inspection" || def.trackId === "appraisal"
        ? distribution.valuationDepartment
        : def.trackId === "government"
          ? distribution.governmentAuditor
          : distribution.engineeringOffice;

    return {
      trackId: def.trackId,
      shortLabel: def.shortLabel,
      enabled,
      name: track?.assigneeName ?? "—",
      state: track?.state ?? "new",
      progressPct:
        progressByParty === undefined
          ? (track?.progressPct ?? 0)
          : (progressByParty[def.partyId] ?? 0),
    };
  });
}

