import type { StaffUser } from "@platform/app-shared/prototype/constants";
import {
  buildCaseStudyPartyAssignees,
  type CaseStudyTrackState,
} from "./case-study-tracks";
import type { WorkflowTask } from "./tasks-storage";

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
  label: string;
  badge: string;
  badgeClass: "pd-badge-teal" | "pd-badge-amber" | "pd-badge-gray";
};

function timelineBadgeForParty(
  enabled: boolean,
  state: CaseStudyTrackState,
  roleKey: string,
): { badge: string; badgeClass: PropertyDetailPartyStatusRow["badgeClass"] } {
  if (!enabled) {
    return { badge: "غير معيّن", badgeClass: "pd-badge-gray" };
  }
  if (state === "done") {
    return { badge: "مكتمل", badgeClass: "pd-badge-teal" };
  }
  if (state === "progress") {
    return { badge: "قيد التنفيذ", badgeClass: "pd-badge-amber" };
  }
  if (roleKey === "inspection") {
    return { badge: "لم يبدأ", badgeClass: "pd-badge-amber" };
  }
  return { badge: "غير معيّن", badgeClass: "pd-badge-gray" };
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

/** Timeline sidebar party rows — matches HTML mockup (no specialist). */
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
    { key: "inspection", label: "المعاين", trackId: "inspection" },
    { key: "survey", label: "المكتب الهندسي", trackId: "survey" },
    { key: "appraisal", label: "المقيّم", trackId: "appraisal" },
  ] as const;

  return defs.map((def) => {
    const party = byTrack(def.trackId);
    const enabled = party?.enabled ?? false;
    const state = party?.state ?? "new";
    return {
      label: def.label,
      ...timelineBadgeForParty(enabled, state, def.key),
    };
  });
}
