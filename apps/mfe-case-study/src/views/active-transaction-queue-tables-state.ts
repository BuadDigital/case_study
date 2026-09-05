/**
 * Pure contracts and decisions shared by the active-transaction queue tables
 * (`active-transaction-queue-*-table.tsx`): the row context the screen builds
 * once, the status/remaining label rules, and the per-row derivations that were
 * duplicated verbatim across the survey and appraisal branches. No React, no I/O.
 */
import type { RowMoreMenuItem, StatusPillStyle } from "@platform/ui-kit";
import type { CaseStudyInfoPartyId } from "@settings/mfe/lib/app-data/case-study-info-roles-data";
import type { RemainingTimeState } from "../lib/app-data/my-task-row";
import type { PoIntakeRecord } from "../lib/app-data/po-intake-data";
import type { WorkflowTask } from "../lib/app-data/tasks-storage";

/** Shared row context across every table branch — built once in the screen. */
export type QueueRowContext = {
  queuePending: boolean;
  /** First load with no tasks yet — skeleton rows. */
  showSkeleton: boolean;
  selectedId: string | null;
  isTaskOpening: (taskId: string) => boolean;
  handleRowClick: (taskId: string) => void;
  resolveRowAttention: (task: WorkflowTask) => boolean;
  resolveRowMoreItems: (
    task: WorkflowTask,
    propertyId: string | undefined,
  ) => RowMoreMenuItem[];
};

export type QueueStatusBadge = { label: string; className: string } | null;

export type PartyProgressByTask = Map<
  string,
  Partial<Record<CaseStudyInfoPartyId, number>>
>;

/** Stable empty ref when party progress is absent — a fresh `{}` kills row memoization. */
export const EMPTY_PARTY_PROGRESS: Partial<Record<CaseStudyInfoPartyId, number>> =
  {};

export const ALL_TRANSACTIONS_SKELETON_COLS = 7;
export const PRIMARY_SKELETON_COLS = 7;
export const PARTY_QUEUE_SKELETON_COLS = 7;

/** Distribution table: 8 fixed columns plus the three party columns when shown. */
export function distributionSkeletonCols(showPartyColumns: boolean): number {
  return 8 + (showPartyColumns ? 3 : 0);
}

/** Primary table drops the city/district pair when the layout has no location. */
export function primarySkeletonCols(primaryHasLocation: boolean): number {
  return primaryHasLocation ? PRIMARY_SKELETON_COLS : PRIMARY_SKELETON_COLS - 2;
}

/** Case Study.html `ENG_ST` / `VAL` status pill colors. */
export function engSurveyStatusPillStyle(className: string): StatusPillStyle {
  if (className.includes("done")) {
    return { base: "#3f8f5f", fg: "#2f7a4d" };
  }
  if (className.includes("fail") || className.includes("returned")) {
    return { base: "#d9694f", fg: "#a5432e" };
  }
  if (className.includes("prog")) {
    return { base: "#d9a441", fg: "#8a5e14" };
  }
  if (className.includes("gold")) {
    return { base: "#a4906f", fg: "#8c7857" };
  }
  if (className.includes("navy")) {
    return { base: "#102B4E", fg: "#102B4E" };
  }
  // New — GRAY in prototype (not blue)
  return { base: "#6b7c8f", fg: "#4a5568" };
}

/** Case Study.html remaining column: two days / N days / overdue. */
export function formatEngSurveyRemaining(state: RemainingTimeState): {
  text: string;
  overdue: boolean;
} {
  if (state.status === "missing") return { text: "—", overdue: false };
  if (state.status === "overdue") return { text: "متأخر", overdue: true };
  const days = state.days;
  if (days <= 0) return { text: "0 أيام", overdue: false };
  if (days === 1) return { text: "يوم", overdue: false };
  if (days === 2) return { text: "يومان", overdue: false };
  return { text: `${days} أيام`, overdue: false };
}

/**
 * What the survey "remaining" cell shows: the clock is paused while the property
 * has no contact number, stopped while a failure/return awaits handling, and
 * otherwise counts down.
 */
export type EngSurveyRemainingMode = "paused" | "stopped" | "countdown";

export function engSurveyRemainingMode(
  missingPhone: boolean,
  statusClass: string,
): EngSurveyRemainingMode {
  if (missingPhone) return "paused";
  if (statusClass === "b-fail" || statusClass === "b-returned") return "stopped";
  return "countdown";
}

/** Assignment date YYYY/MM/DD — was duplicated verbatim in survey and appraisal branches. */
export function assignedDateLabel(
  task: Pick<WorkflowTask, "createdAt">,
  record: Pick<PoIntakeRecord, "receivedFromEnfathAt"> | undefined,
): string {
  const raw = task.createdAt || record?.receivedFromEnfathAt || "";
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

/** "City — District", skipping blanks and the "—" placeholder. */
export function joinCityDistrict(city: string, district: string): string {
  return [city, district].filter((v) => v && v !== "—").join(" — ");
}

/** Property type, falling back to the classification; empty when neither is set. */
export function propertyTypeLabel(
  property:
    | { propertyType?: string | null; classification?: string | null }
    | null
    | undefined,
): string {
  return (
    property?.propertyType?.trim() || property?.classification?.trim() || ""
  );
}

export type EngSurveyContact = {
  name: string;
  phone: string;
  role: string;
  missingPhone: boolean;
};

/** First contact with any field filled; `name` falls back to "—" when none. */
export function resolveEngSurveyContact(
  contacts:
    | ReadonlyArray<{ name: string; phone: string; role: string }>
    | null
    | undefined,
): EngSurveyContact {
  const contact =
    contacts?.find(
      (c) => c.name.trim() || c.phone.trim() || c.role.trim(),
    ) ?? null;
  const phone = contact?.phone.trim() || "";
  return {
    name: contact?.name.trim() || "—",
    phone,
    role: contact?.role.trim() || "",
    missingPhone: !phone,
  };
}

/** One avatar chip in the appraisal "parties" column. */
export type AppraisalPartyDep = {
  name: string;
  role: string;
  ok: boolean;
  letter: string;
  ink: boolean;
};

/** The inspector always; the engineering office only when a survey is required. */
export function buildAppraisalPartyDeps(args: {
  inspected: boolean;
  needsSurvey: boolean;
  surveyed: boolean;
}): AppraisalPartyDep[] {
  const deps: AppraisalPartyDep[] = [
    {
      name: "المعاين",
      role: "المعاينة الميدانية",
      ok: args.inspected,
      letter: "م",
      ink: true,
    },
  ];
  if (args.needsSurvey) {
    deps.push({
      name: "المكتب الهندسي",
      role: "الرفع المساحي",
      ok: args.surveyed,
      letter: "هـ",
      ink: false,
    });
  }
  return deps;
}

/** Primary-data rows render the "under study" slot as an RTL gold label. */
export function isStudySlotLabel(propertySlot: string): boolean {
  return propertySlot.startsWith("قيد الدراسة");
}
