import { PropertyListRowStatuses } from "@platform/api-client";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import { resolveAssigneeDisplayName } from "@platform/app-shared/fees/party-fee-meta";
import type { CaseStudyInfoPartyId } from "@settings/mfe/lib/app-data/case-study-info-roles-data";
import {
  assigneeLabel,
  getCaseSpecialists,
  getEngineeringOffices,
  getFieldInspectors,
  getValuators,
} from "./distribution-parties";
import { childTasksForCaseStudyParent } from "./case-study-party-answers";
import {
  migrateDistribution,
  type TaskDistributionDraft,
  type WorkflowTask,
  type WorkflowTaskKind,
} from "./tasks-storage";

export type CaseStudyTrackState =
  | typeof PropertyListRowStatuses.New
  | typeof PropertyListRowStatuses.Progress
  | typeof PropertyListRowStatuses.Done;

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
  caseStudy: "parent",
};

export function trackStateFromTask(
  child: WorkflowTask | undefined,
  spawned: boolean,
): CaseStudyTrackState {
  if (!spawned) return PropertyListRowStatuses.New;
  if (!child) return PropertyListRowStatuses.New;
  if (child.status === "completed") return PropertyListRowStatuses.Done;
  return PropertyListRowStatuses.Progress;
}

function progressPctForState(state: CaseStudyTrackState): number {
  if (state === PropertyListRowStatuses.Done) return 100;
  // Open / assigned ≠ half complete without form or submission evidence.
  return 0;
}

function findChild(
  children: WorkflowTask[],
  kind: Exclude<WorkflowTaskKind, "case-study-property">,
): WorkflowTask | undefined {
  return children.find((t) => t.kind === kind);
}

/** Real case-study parent id — party queue rows are children and may stand in as `parent`. */
export function caseStudyFamilyParentId(task: WorkflowTask): string {
  if (task.kind === "case-study-property" || !task.parentTaskId) return task.id;
  return task.parentTaskId;
}

function partyChildrenForTracks(
  parent: WorkflowTask,
  allTasks: WorkflowTask[],
): WorkflowTask[] {
  const children = childTasksForCaseStudyParent(
    caseStudyFamilyParentId(parent),
    allTasks,
  );
  if (parent.kind === "case-study-property") return children;
  if (children.some((t) => t.id === parent.id)) return children;
  return [parent, ...children];
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
  if (trackId === "inspection") return distribution.inspectorId || null;
  if (trackId === "appraisal") return distribution.valuatorId || null;
  if (trackId === "caseStudy") return distribution.caseSpecialistId || null;
  return null;
}

function liveChild(child: WorkflowTask | undefined): WorkflowTask | undefined {
  if (!child || child.status === "cancelled") return undefined;
  return child;
}

/**
 * Whether this party actually received a task. Checkboxes alone are not
 * enough: survey follows the spawned sibling (or the mirrored assigned flag
 * when party visibility hides the row). Inspection / appraisal follow a live
 * child, a mirrored sibling id, or the assignee id copied onto the row.
 */
export function isPartyTrackAssigned(input: {
  trackId: string;
  distribution: TaskDistributionDraft;
  child?: WorkflowTask;
  parent: WorkflowTask;
}): boolean {
  if (liveChild(input.child)) return true;
  if (input.trackId === "survey") {
    return (
      input.parent.engineeringSurveyAssigned === true ||
      input.parent.engineeringSurveyCompleted === true
    );
  }
  if (input.trackId === "inspection") {
    const id = (distributionAssigneeId(input.distribution, "inspection") ?? "").trim();
    return Boolean(
      id ||
        input.parent.fieldInspectionTaskId?.trim() ||
        input.parent.fieldInspectionCompleted,
    );
  }
  if (input.trackId === "appraisal") {
    return input.parent.kind === "property-appraisal";
  }
  if (input.trackId === "caseStudy") {
    const id = (distributionAssigneeId(input.distribution, "caseStudy") ?? "").trim();
    return Boolean(id || input.distribution.caseSpecialist);
  }
  return false;
}

export function buildCaseStudyTracks(
  parent: WorkflowTask,
  allTasks: WorkflowTask[],
  staffUsers: StaffUser[] = [],
): CaseStudyTrack[] {
  const distribution = migrateDistribution(parent.distribution);
  const children = partyChildrenForTracks(parent, allTasks);
  const childOf = (kind: Exclude<WorkflowTaskKind, "case-study-property">) =>
    findChild(children, kind);

  const defs: { id: string; label: string; spawned: boolean }[] = [
    {
      id: "survey",
      label: "الرفع المساحي",
      spawned: isPartyTrackAssigned({
        trackId: "survey",
        distribution,
        child: childOf("engineering-survey"),
        parent,
      }),
    },
    {
      id: "inspection",
      label: "المعاينة الميدانية",
      spawned: isPartyTrackAssigned({
        trackId: "inspection",
        distribution,
        child: childOf("field-inspection"),
        parent,
      }),
    },
    {
      id: "appraisal",
      label: "التقييم العقاري",
      spawned: isPartyTrackAssigned({
        trackId: "appraisal",
        distribution,
        child:
          childOf("property-appraisal") ??
          (parent.kind === "property-appraisal" ? parent : undefined),
        parent,
      }),
    },
    { id: "caseStudy", label: "دراسة الحالة", spawned: true },
  ];

  return defs.map(({ id, label, spawned }) => {
    const kind = TRACK_KIND[id];
    const child =
      kind === "parent"
        ? parent
        : (findChild(
            children,
            kind as Exclude<WorkflowTaskKind, "case-study-property">,
          ) ?? (parent.kind === kind ? parent : undefined));
    let state =
      kind === "parent"
        ? parent.status === "completed" || parent.phase === "done"
          ? PropertyListRowStatuses.Done
          : parent.phase === "case-study"
            ? PropertyListRowStatuses.Progress
            : PropertyListRowStatuses.New
        : trackStateFromTask(child, spawned);
    // Party visibility hides the sibling rows from the appraiser, so a track with
    // no child falls back to the completion flag the server mirrors onto the row.
    if (id === "inspection" && !child && parent.fieldInspectionCompleted) {
      state = PropertyListRowStatuses.Done;
    }
    if (id === "survey" && !child && parent.engineeringSurveyCompleted) {
      state = PropertyListRowStatuses.Done;
    }
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

export type CaseStudyPartyAssignee = {
  trackId: string;
  shortLabel: string;
  enabled: boolean;
  name: string;
  state: CaseStudyTrackState;
  progressPct: number;
};

const CASE_STUDY_PARTY_DEFS = [
  { trackId: "survey", shortLabel: "المكتب الهندسي", partyId: "eng" },
  { trackId: "inspection", shortLabel: "المعاين", partyId: "insp" },
  { trackId: "appraisal", shortLabel: "المقيم", partyId: "val" },
] as const;

/**
 * Party columns for the property case-study queue table.
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
  const children = partyChildrenForTracks(parent, allTasks);

  return CASE_STUDY_PARTY_DEFS.map((def) => {
    const track = tracks.find((t) => t.id === def.trackId);
    const state = track?.state ?? PropertyListRowStatuses.New;
    const kind = TRACK_KIND[def.trackId];
    const child =
      kind && kind !== "parent"
        ? (findChild(
            children,
            kind as Exclude<WorkflowTaskKind, "case-study-property">,
          ) ?? (parent.kind === kind ? parent : undefined))
        : undefined;
    const enabled = isPartyTrackAssigned({
      trackId: def.trackId,
      distribution,
      child,
      parent,
    });

    const formPct =
      progressByParty === undefined
        ? undefined
        : (progressByParty[def.partyId] ?? 0);
    const progressPct =
      state === PropertyListRowStatuses.Done
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

export type AssignedCaseStudyParty = {
  trackId: string;
  name: string;
  role: string;
};

/** Parties that actually received a task — what the queue «الأطراف» stack shows. */
export function assignedCaseStudyParties(
  parent: WorkflowTask,
  allTasks: WorkflowTask[],
  staffUsers: StaffUser[] = [],
): AssignedCaseStudyParty[] {
  return buildCaseStudyPartyAssignees(parent, allTasks, undefined, staffUsers)
    .filter((party) => party.enabled)
    .flatMap((party) => {
      const name = party.name.trim();
      if (!name || name === "—") return [];
      return [{ trackId: party.trackId, name, role: party.shortLabel }];
    });
}
