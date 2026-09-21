import type { StaffUser } from "@platform/app-shared/app-data/constants";
import {
  buildCaseStudyPartyAssignees,
  buildCaseStudyTracks,
  caseStudyFamilyParentId,
  type CaseStudyTrackState,
} from "./case-study-tracks";
import { assigneeLabel, getCaseSpecialists } from "./distribution-parties";
import { migrateDistribution, type WorkflowTask } from "./tasks";

export type PropertyDetailPartyRoleKey =
  | "specialist"
  | "inspection"
  | "survey"
  | "appraisal";

export type PropertyDetailPartyCard = {
  roleKey: PropertyDetailPartyRoleKey;
  role: string;
  name: string;
  unassigned: boolean;
  state: CaseStudyTrackState;
  enabled: boolean;
};

export type PropertyDetailPartyStatusRow = {
  key: string;
  /** Display name of the assigned person/office (not the role title). */
  label: string;
  role: string;
  badge: string;
  badgeClass: "pd-badge-teal" | "pd-badge-amber" | "pd-badge-gray";
};

function timelineBadgeForParty(
  enabled: boolean,
  state: CaseStudyTrackState,
): { badge: string; badgeClass: PropertyDetailPartyStatusRow["badgeClass"] } {
  if (!enabled) {
    return { badge: "معطّل", badgeClass: "pd-badge-gray" };
  }
  if (state === "done") {
    return { badge: "مكتمل", badgeClass: "pd-badge-teal" };
  }
  if (state === "progress") {
    return { badge: "قيد التنفيذ", badgeClass: "pd-badge-amber" };
  }
  return { badge: "لم يبدأ", badgeClass: "pd-badge-amber" };
}

/** Party cards for property detail — assigned work parties only (no case specialist). */
export function buildPropertyDetailPartyCards(input: {
  /** @deprecated unused — specialist is not shown on party cards */
  specialistName?: string;
  task: WorkflowTask | null;
  allTasks: WorkflowTask[];
  staffUsers?: StaffUser[];
}): PropertyDetailPartyCard[] {
  const { task, allTasks } = input;
  const assignees = task
    ? buildCaseStudyPartyAssignees(task, allTasks, undefined, input.staffUsers)
    : [];

  const byTrack = (trackId: string) =>
    assignees.find((p) => p.trackId === trackId);

  const inspection = byTrack("inspection");
  const survey = byTrack("survey");
  const appraisal = byTrack("appraisal");

  return [
    {
      roleKey: "inspection",
      role: "المعاين",
      name:
        inspection?.enabled && inspection.name !== "—"
          ? inspection.name
          : "لم يُعيَّن",
      unassigned: !inspection?.enabled || inspection?.name === "—",
      state: inspection?.state ?? "new",
      enabled: inspection?.enabled ?? false,
    },
    {
      roleKey: "survey",
      role: "المكتب الهندسي",
      name:
        survey?.enabled && survey.name !== "—" ? survey.name : "لم يُعيَّن",
      unassigned: !survey?.enabled || survey?.name === "—",
      state: survey?.state ?? "new",
      enabled: survey?.enabled ?? false,
    },
    {
      roleKey: "appraisal",
      role: "المقيّم العقاري",
      name:
        appraisal?.enabled && appraisal.name !== "—"
          ? appraisal.name
          : "لم يُعيَّن",
      unassigned: !appraisal?.enabled || appraisal?.name === "—",
      state: appraisal?.state ?? "new",
      enabled: appraisal?.enabled ?? false,
    },
  ];
}

/**
 * The case specialist owns the real case-study parent. When the viewer only
 * sees a party child (e.g. the appraiser), the child must not stand in for the
 * parent — its assignee is the appraiser, not the specialist.
 */
function timelineSpecialistRow(input: {
  task: WorkflowTask | null;
  allTasks: WorkflowTask[];
  staffUsers?: StaffUser[];
}): PropertyDetailPartyStatusRow {
  const { task, allTasks } = input;
  const staffUsers = input.staffUsers ?? [];
  const role = "أخصائي دراسة الحالة";
  const unassigned = {
    key: "specialist",
    label: "لم يُعيَّن",
    role,
    ...timelineBadgeForParty(false, "new"),
  };
  if (!task) return unassigned;

  const parent =
    task.kind === "case-study-property"
      ? task
      : allTasks.find(
          (t) =>
            t.id === caseStudyFamilyParentId(task) &&
            t.kind === "case-study-property",
        );

  if (parent) {
    const track = buildCaseStudyTracks(parent, allTasks, staffUsers).find(
      (t) => t.id === "caseStudy",
    );
    const name = track?.assigneeName.trim();
    if (!name || name === "—") return unassigned;
    return {
      key: "specialist",
      label: name,
      role,
      ...timelineBadgeForParty(true, track?.state ?? "new"),
    };
  }

  // Parent hidden from this viewer: the child still carries the distribution.
  const name = assigneeLabel(
    getCaseSpecialists(staffUsers),
    migrateDistribution(task.distribution).caseSpecialistId,
  ).trim();
  if (!name) return unassigned;
  return {
    key: "specialist",
    label: name,
    role,
    ...timelineBadgeForParty(true, "progress"),
  };
}

/** Timeline sidebar party rows — assignee names with status badges. */
export function buildPropertyDetailTimelinePartyRows(input: {
  task: WorkflowTask | null;
  allTasks: WorkflowTask[];
  staffUsers?: StaffUser[];
}): PropertyDetailPartyStatusRow[] {
  const { task, allTasks } = input;
  const assignees = task
    ? buildCaseStudyPartyAssignees(task, allTasks, undefined, input.staffUsers)
    : [];
  const byTrack = (trackId: string) =>
    assignees.find((p) => p.trackId === trackId);

  const defs = [
    { key: "inspection", role: "المعاين", trackId: "inspection" },
    { key: "survey", role: "المكتب الهندسي", trackId: "survey" },
    { key: "appraisal", role: "المقيّم", trackId: "appraisal" },
  ] as const;

  const workParties = defs.map((def) => {
    const party = byTrack(def.trackId);
    const enabled = party?.enabled ?? false;
    const state = party?.state ?? "new";
    const name =
      enabled && party?.name && party.name !== "—"
        ? party.name
        : "لم يُعيَّن";
    return {
      key: def.key,
      label: name,
      role: def.role,
      ...timelineBadgeForParty(enabled, state),
    };
  });

  return [timelineSpecialistRow(input), ...workParties];
}
