import type { StaffUser } from "@platform/app-shared/prototype/constants";
import {
  assigneeLabel,
  getValuationCoordinators,
} from "./distribution-parties";
import {
  buildCaseStudyPartyAssignees,
  caseStudyTrackBadgeLabel,
  trackStateFromTask,
  type CaseStudyTrackState,
} from "./case-study-tracks";
import {
  migrateDistribution,
  type WorkflowTask,
} from "./tasks-storage";

function valuationCoordinationChild(
  allTasks: WorkflowTask[],
  parentTaskId: string | undefined,
): WorkflowTask | undefined {
  if (!parentTaskId) return undefined;
  return allTasks.find(
    (t) =>
      t.parentTaskId === parentTaskId && t.kind === "valuation-coordination",
  );
}

function coordinatorDisplayName(
  distribution: ReturnType<typeof migrateDistribution>,
  staffUsers: StaffUser[],
  allTasks: WorkflowTask[],
  parentTaskId: string | undefined,
): string {
  const child = valuationCoordinationChild(allTasks, parentTaskId);
  const childName = child?.assigneeName?.trim();
  if (childName && childName !== "—") return childName;

  if (!distribution.valuationDepartment) return "";
  return assigneeLabel(
    getValuationCoordinators(staffUsers),
    distribution.operationsCoordinatorId,
  );
}

function coordinatorEnabled(
  distribution: ReturnType<typeof migrateDistribution>,
  allTasks: WorkflowTask[],
  parentTaskId: string | undefined,
): boolean {
  return (
    distribution.valuationDepartment ||
    Boolean(valuationCoordinationChild(allTasks, parentTaskId))
  );
}

export type PropertyDetailPartyRoleKey =
  | "specialist"
  | "inspection"
  | "survey"
  | "appraisal"
  | "government"
  | "coordinator";

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

/** Six party cards for property detail — matches HTML mockup roles. */
export function buildPropertyDetailPartyCards(input: {
  specialistName: string;
  task: WorkflowTask | null;
  allTasks: WorkflowTask[];
  staffUsers?: StaffUser[];
}): PropertyDetailPartyCard[] {
  const { specialistName, task, allTasks, staffUsers = [] } = input;
  const distribution = migrateDistribution(task?.distribution);
  const assignees = task ? buildCaseStudyPartyAssignees(task, allTasks) : [];

  const byTrack = (trackId: string) =>
    assignees.find((p) => p.trackId === trackId);

  const inspection = byTrack("inspection");
  const survey = byTrack("survey");
  const appraisal = byTrack("appraisal");
  const government = byTrack("government");

  const coordinatorName = coordinatorDisplayName(
    distribution,
    staffUsers,
    allTasks,
    task?.id,
  );

  const cards: PropertyDetailPartyCard[] = [
    {
      roleKey: "specialist",
      role: "أخصائي دراسة الحالة",
      name: specialistName.trim() || "لم يُعيَّن",
      unassigned: !specialistName.trim(),
      state: "progress",
      enabled: true,
    },
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
    {
      roleKey: "government",
      role: "المراجع الحكومي",
      name:
        government?.enabled && government.name !== "—"
          ? government.name
          : "لم يُعيَّن",
      unassigned: !government?.enabled || government?.name === "—",
      state: government?.state ?? "new",
      enabled: government?.enabled ?? false,
    },
    {
      roleKey: "coordinator",
      role: "المنسق",
      name: coordinatorName.trim() || "لم يُعيَّن",
      unassigned: !coordinatorName.trim(),
      state: trackStateFromTask(
        valuationCoordinationChild(allTasks, task?.id),
        coordinatorEnabled(distribution, allTasks, task?.id) &&
          Boolean(coordinatorName.trim()),
      ),
      enabled: coordinatorEnabled(distribution, allTasks, task?.id),
    },
  ];

  return cards;
}

/** Timeline sidebar party rows — matches HTML mockup (no specialist). */
export function buildPropertyDetailTimelinePartyRows(input: {
  task: WorkflowTask | null;
  allTasks: WorkflowTask[];
  staffUsers?: StaffUser[];
}): PropertyDetailPartyStatusRow[] {
  const { task, allTasks, staffUsers = [] } = input;
  const distribution = migrateDistribution(task?.distribution);
  const assignees = task ? buildCaseStudyPartyAssignees(task, allTasks) : [];
  const byTrack = (trackId: string) =>
    assignees.find((p) => p.trackId === trackId);

  const defs = [
    { key: "inspection", label: "المعاين", trackId: "inspection" },
    { key: "survey", label: "المكتب الهندسي", trackId: "survey" },
    { key: "appraisal", label: "المقيّم", trackId: "appraisal" },
    { key: "government", label: "المراجع الحكومي", trackId: "government" },
    {
      key: "coordinator",
      label: "المنسق",
      trackId: null as string | null,
    },
  ] as const;

  return defs.map((def) => {
    if (def.key === "coordinator") {
      const name = coordinatorDisplayName(
        distribution,
        staffUsers,
        allTasks,
        task?.id,
      );
      const enabled = coordinatorEnabled(distribution, allTasks, task?.id);
      const state = trackStateFromTask(
        valuationCoordinationChild(allTasks, task?.id),
        enabled && Boolean(name.trim()),
      );
      const badge = timelineBadgeForParty(enabled, state, def.key);
      return { label: def.label, ...badge };
    }

    const party = def.trackId ? byTrack(def.trackId) : undefined;
    const enabled = party?.enabled ?? false;
    const state = party?.state ?? "new";
    return {
      label: def.label,
      ...timelineBadgeForParty(enabled, state, def.key),
    };
  });
}

export function partyCardStatusLabel(card: PropertyDetailPartyCard): string {
  if (card.unassigned) {
    if (card.role === "المعاين" && card.enabled) return "انتظار التعيين";
    return "لم يُعيَّن";
  }
  if (card.role === "أخصائي دراسة الحالة") return "نشط";
  return caseStudyTrackBadgeLabel(card.state);
}

export function partyCardDotClass(card: PropertyDetailPartyCard): string {
  if (card.unassigned) {
    if (card.role === "المعاين" && card.enabled) return "pd-status-dot--amber";
    return "pd-status-dot--gray";
  }
  if (card.state === "done") return "pd-status-dot--teal";
  if (card.state === "progress") return "pd-status-dot--teal";
  if (card.role === "المعاين") return "pd-status-dot--amber";
  return "pd-status-dot--gray";
}
