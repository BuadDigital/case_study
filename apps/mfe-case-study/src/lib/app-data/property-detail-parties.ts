import type { StaffUser } from "@platform/app-shared/app-data/constants";
import {
  buildCaseStudyPartyAssignees,
  buildCaseStudyTracks,
  caseStudyFamilyParentId,
  type CaseStudyTrackState,
} from "./case-study-tracks";
import {
  appraisalStageLabel,
  type ReportDraftState,
} from "@platform/app-shared/workflow/report-draft-state";
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

/**
 * Where the appraiser's report stands once he handed his package over, worded for whoever reads the rail:
 * waiting for the specialist's draft, the draft waiting for his approval, approved waiting for the deposit code. Null: nothing finer than «in progress».
 */
function appraisalHandOverBadge(
  appraisal: { packageSubmitted: boolean; draft?: ReportDraftState } | undefined,
): { badge: string; badgeClass: PropertyDetailPartyStatusRow["badgeClass"] } | null {
  if (!appraisal) return null;
  const stage = appraisalStageLabel(appraisal.draft);
  if (stage?.group === "approved") return { badge: "معتمد — بانتظار الإيداع", badgeClass: "pd-badge-amber" };
  if (stage?.group === "draft_sent") return { badge: "بانتظار اعتماد المقيّم", badgeClass: "pd-badge-amber" };
  if (appraisal.packageSubmitted) return { badge: "بانتظار المسودة", badgeClass: "pd-badge-amber" };
  return null;
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
  /**
   * Inspector package was submitted. The workflow task row can still be open
   * in the list the rail has, so completion has to come from the package too.
   */
  inspectionSubmitted?: boolean;
  /** The appraiser's package is handed over and where the report draft stands; refines his badge. */
  appraisal?: { packageSubmitted: boolean; draft?: ReportDraftState };
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
    const submittedInspection =
      def.key === "inspection" && input.inspectionSubmitted === true;
    const enabled = (party?.enabled ?? false) || submittedInspection;
    const state = submittedInspection ? "done" : (party?.state ?? "new");
    const name =
      enabled && party?.name && party.name !== "—"
        ? party.name
        : "لم يُعيَّن";
    const handOver =
      def.key === "appraisal" && enabled && state !== "done"
        ? appraisalHandOverBadge(input.appraisal)
        : null;
    return {
      key: def.key,
      label: name,
      role: def.role,
      ...(handOver ?? timelineBadgeForParty(enabled, state)),
    };
  });

  return [timelineSpecialistRow(input), ...workParties];
}
