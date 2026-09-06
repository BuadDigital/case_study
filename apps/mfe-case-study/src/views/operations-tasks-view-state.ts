/**
 * Pure queue/selection rules behind `OperationsTasksView`. No React, no writes —
 * everything here is a function of the tasks list plus the current filters, so
 * the view keeps JSX and event wiring only.
 */
import { RowMoreMenuIcons, type RowMoreMenuItem } from "@platform/ui-kit";
import type { PatchOperationsTaskRequest } from "@platform/api-client";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import type { FailureRecord } from "@platform/app-shared/failures/failures-types";
import {
  isActiveOperationsTask,
  type OperationsTask,
  type OperationsTaskQuery,
} from "../lib/app-data/operations-tasks-model";
import {
  isTerminalOperationsTaskStatus,
  operationsTaskLinkLabel,
  operationsTaskReceiptLabel,
  operationsTaskScopeLabel,
} from "../lib/app-data/operations-task-display";
import {
  isOperationsTaskBlockedByFailure,
  isOpsTaskFailurePauseReason,
} from "../lib/app-data/operations-task-failure-obstruction";
import {
  assigneesForType,
  toLocalDateValue,
  toLocalTimeValue,
  type DraftFile,
} from "./OperationsTasksViewShared";
import type {
  CourtVisitContactDraft,
  CourtVisitKind,
} from "./OperationsTasksCloseModal";
import type { DistributionAssignee } from "../lib/app-data/distribution-parties";
import type { PoIntakeRecord } from "../lib/app-data/po-intake-data";

/** Party account shape used for the "is this row mine" checks. */
export type OperationsQueueAccount =
  | { assigneeId?: string | null; name?: string | null }
  | null
  | undefined;

export type OperationsTaskFilters = {
  statusFilter: string;
  scopeFilter: string;
  showAll: boolean;
};

/**
 * The screen's query state. Status, scope, type, the "active only" toggle, the
 * failure-pause exclusion, the search term and the sort are all sent to the
 * server (`docs/architecture/pagination-contract.md` §3); what stays here is
 * listed on `visibleOperationsTasks`.
 */
export type OperationsTaskQueryState = {
  search: string;
  statusFilter: string;
  scopeFilter: string;
  typeFilter: string;
  showAll: boolean;
};

export const INITIAL_OPERATIONS_TASK_QUERY: OperationsTaskQueryState = {
  search: "",
  statusFilter: "",
  scopeFilter: "",
  typeFilter: "",
  showAll: false,
};

export type OperationsTaskQueryAction =
  | { type: "search"; value: string }
  | { type: "status"; value: string }
  | { type: "scope"; value: string }
  | { type: "taskType"; value: string }
  | { type: "showAll"; value: boolean };

/** Pure reducer; an unchanged value returns the same object so the query key holds. */
export function operationsTaskQueryReducer(
  state: OperationsTaskQueryState,
  action: OperationsTaskQueryAction,
): OperationsTaskQueryState {
  switch (action.type) {
    case "search":
      return action.value === state.search
        ? state
        : { ...state, search: action.value };
    case "status":
      return action.value === state.statusFilter
        ? state
        : { ...state, statusFilter: action.value };
    case "scope":
      return action.value === state.scopeFilter
        ? state
        : { ...state, scopeFilter: action.value };
    case "taskType":
      return action.value === state.typeFilter
        ? state
        : { ...state, typeFilter: action.value };
    case "showAll":
      return action.value === state.showAll
        ? state
        : { ...state, showAll: action.value };
    default:
      return state;
  }
}

/**
 * Query state → the `GET /api/operations-tasks` parameters. `sort: "queue"` is
 * the screen's own `taskStatusRank` band order, so the rows arrive in the order
 * the table renders them.
 */
export function toOperationsTaskListQuery(
  state: OperationsTaskQueryState,
  options: {
    /** Executor queues are scoped to the viewer's distribution assignee id. */
    assigneeId?: string;
    /** Executor queues also hide rows parked on an active failure. */
    excludeFailurePaused: boolean;
    /**
     * Debounced search term; falls back to the live one. Deed numbers belong in
     * here — `q` matches `DeedsJson` server-side (pagination-contract §3).
     */
    search?: string;
  },
): OperationsTaskQuery {
  const q = (options.search ?? state.search).trim();
  return {
    ...(options.assigneeId ? { assigneeId: options.assigneeId } : {}),
    ...(state.statusFilter ? { status: state.statusFilter } : {}),
    ...(state.scopeFilter ? { scope: state.scopeFilter } : {}),
    ...(state.typeFilter ? { type: state.typeFilter } : {}),
    // Mirrors the screen's "show all" toggle in its off position; an explicit
    // status filter wins, exactly as `visibleOperationsTasks` had it.
    ...(!state.showAll && !state.statusFilter ? { activeOnly: true } : {}),
    ...(options.excludeFailurePaused ? { excludeFailurePaused: true } : {}),
    ...(q ? { q } : {}),
    sort: "queue",
    dir: "desc",
  };
}

/** The KPI band's shape — counted by the endpoint (`useOperationsTaskStatusCounts`). */
export type OperationsTaskKpis = {
  active: number;
  created: number;
  paused: number;
  inProgress: number;
  completed: number;
};

// Scope order is fixed — one module-level function instead of a closure allocated per comparison
// (js-cache-function-results).
export const taskStatusRank = (status: string) =>
  status === "paused" ? 1 : isTerminalOperationsTaskStatus(status) ? 2 : 0;

/**
 * Executor queues hide a task while a linked failure is open, or while it is
 * parked for a failure pause (until auto-resume / staff clears the obstruction).
 */
export function queueTasksForViewer(
  tasks: OperationsTask[],
  useIndependentQueue: boolean,
  failures: FailureRecord[],
  poRecords: PoIntakeRecord[],
): OperationsTask[] {
  if (!useIndependentQueue) return tasks;
  return tasks.filter((t) => {
    // The pause-reason half also runs server-side (`excludeFailurePaused`);
    // kept here because the offline cache and stale pages can still carry it.
    if (t.status === "paused" && isOpsTaskFailurePauseReason(t.pauseReason)) {
      return false;
    }
    // The other half needs the Failures records and the PO → property map,
    // neither of which is in the Operations database — pagination-contract §3,
    // "still client-side" #1. `totalCount` can therefore overstate what this
    // viewer sees.
    return !isOperationsTaskBlockedByFailure(t, failures, poRecords);
  });
}

/**
 * Status, scope, the "active only" toggle and the whole of the free text are
 * applied by the server. **The deed term is gone from here**: `q` now matches
 * `DeedsJson` through the jsonb containment / trigram pair the endpoint grew
 * (pagination-contract §3, "Deed search"), so a deed-only search no longer
 * comes back empty and the client no longer re-filters what it asked for. The
 * status / scope / active predicates stay only because a stale or offline page
 * can still hold rows the current filters exclude; what is genuinely left is
 * the deterministic band ordering the table renders.
 */
export function visibleOperationsTasks(
  queueTasks: OperationsTask[],
  filters: OperationsTaskFilters,
): OperationsTask[] {
  const list = queueTasks.filter((t) => {
    if (filters.statusFilter && t.status !== filters.statusFilter) return false;
    if (filters.scopeFilter && t.scope !== filters.scopeFilter) return false;
    if (!filters.showAll && !filters.statusFilter && !isActiveOperationsTask(t)) {
      return false;
    }
    return true;
  });
  // Decorate once per task — instead of parsing the date on every comparison.
  return list
    .map((task) => ({
      task,
      rank: taskStatusRank(task.status),
      createdAtMs: new Date(task.createdAt).getTime(),
    }))
    .sort((a, b) =>
      a.rank !== b.rank
        ? a.rank - b.rank
        : // newest first within the same status band
          b.createdAtMs - a.createdAtMs,
    )
    .map((d) => d.task);
}

/**
 * Tasks paused for a failure that is no longer blocking — the view reopens them
 * as «Created» so the assignee confirms receipt again (fresh start, not mid-work).
 */
export function operationsTasksToResumeAfterFailure(
  tasks: OperationsTask[],
  failures: FailureRecord[],
  poRecords: PoIntakeRecord[],
): OperationsTask[] {
  return tasks.filter(
    (t) =>
      t.status === "paused" &&
      isOpsTaskFailurePauseReason(t.pauseReason) &&
      !isOperationsTaskBlockedByFailure(t, failures, poRecords),
  );
}

/** A detail row the viewer must be pushed off: parked for, or blocked by, a failure. */
export function operationsTaskHiddenByFailure(
  task: OperationsTask,
  failures: FailureRecord[],
  poRecords: PoIntakeRecord[],
): boolean {
  const parkedForFailure =
    task.status === "paused" && isOpsTaskFailurePauseReason(task.pauseReason);
  return parkedForFailure || isOperationsTaskBlockedByFailure(task, failures, poRecords);
}

/** Matches by distribution assignee id first, then by display name. */
export function matchesOperationsTaskAssignee(
  task: Pick<OperationsTask, "assigneeId" | "assigneeName">,
  account: OperationsQueueAccount,
  fallbackName?: string | null,
): boolean {
  const taskAid = task.assigneeId?.trim() ?? "";
  const myAid = account?.assigneeId?.trim() ?? "";
  if (myAid && taskAid && myAid === taskAid) return true;
  const myName = (account?.name ?? fallbackName ?? "").trim();
  const taskName = task.assigneeName?.trim() ?? "";
  if (myName && taskName && myName === taskName) return true;
  return false;
}

export function reviewerStaffForAccount(
  account: OperationsQueueAccount,
  staffUsers: StaffUser[],
): StaffUser | null {
  const id = account?.assigneeId?.trim();
  if (!id) return null;
  return staffUsers.find((u) => u.distributionAssigneeId?.trim() === id) ?? null;
}

/** Close-modal credit picker — type assignees plus the task's own two parties. */
export function creditAssigneeOptions(
  task: OperationsTask | null,
  staffUsers: StaffUser[],
): DistributionAssignee[] {
  if (!task) return [];
  const base = [...assigneesForType(task.type, staffUsers)];
  const ensure = (id: string | null | undefined, name: string | null | undefined) => {
    const trimmed = id?.trim();
    if (!trimmed) return;
    if (!base.some((a) => a.id === trimmed)) {
      base.push({ id: trimmed, name: name?.trim() || trimmed });
    }
  };
  ensure(task.originalAssigneeId, task.originalAssigneeName);
  ensure(task.assigneeId, task.assigneeName);
  return base;
}

/** `yyyy-mm-dd` + `hh:mm` from the date/time inputs, in the viewer's local zone. */
export function dueDateFromLocalParts(date: string, time: string): Date {
  const [y, mo, da] = date.split("-").map(Number);
  const [hh, mm] = (time || "12:00").split(":").map(Number);
  return new Date(y!, (mo ?? 1) - 1, da ?? 1, hh ?? 12, mm ?? 0);
}

/** Date/time input values from a task's due timestamp — blank date and noon when unset. */
export function localDueParts(
  dueAt: string | null | undefined,
): { date: string; time: string } {
  const due = dueAt ? new Date(dueAt) : null;
  if (due && !Number.isNaN(due.getTime())) {
    return { date: toLocalDateValue(due), time: toLocalTimeValue(due) };
  }
  return { date: "", time: "12:00" };
}

/** `/keys?register=1…` — the envelope registration deep link for a court visit. */
export function keysRegisterPathForTask(
  task: Pick<OperationsTask, "id" | "letterRows">,
): string {
  const params = new URLSearchParams({ register: "1" });
  const request = task.letterRows[0]?.request?.trim();
  if (request) params.set("request", request);
  params.set("task", task.id);
  return `/keys?${params.toString()}`;
}

/**
 * Close modal defaults: a creator closing a task nobody has started is
 * cancelling it; the credit picker starts on the original assignee.
 */
export function closeModalDefaults(
  task: Pick<
    OperationsTask,
    "status" | "assigneeId" | "assigneeName" | "originalAssigneeId" | "originalAssigneeName"
  >,
  canCreate: boolean,
): {
  closeOutcome: "completed" | "cancelled";
  creditAssigneeId: string;
  creditAssigneeName: string;
} {
  return {
    closeOutcome:
      canCreate && task.status === "created" ? "cancelled" : "completed",
    creditAssigneeId: task.originalAssigneeId?.trim() || task.assigneeId || "",
    creditAssigneeName:
      task.originalAssigneeName?.trim() || task.assigneeName || "",
  };
}

export type OperationsTaskPatch = PatchOperationsTaskRequest;
export type CourtVisitResultPatch = NonNullable<
  PatchOperationsTaskRequest["courtVisitResult"]
>;

/** The PATCH body for a status move; the completion / cancellation extras only apply to their status. */
export function buildStatusPatchBody(input: {
  status: string;
  courtVisitResult?: CourtVisitResultPatch;
  credit?: { assigneeId?: string; assigneeName?: string };
  cancelReason?: string;
}): OperationsTaskPatch {
  const { status } = input;
  const patchBody: OperationsTaskPatch = { status };
  if (status === "completed" && input.courtVisitResult) {
    patchBody.courtVisitResult = input.courtVisitResult;
  }
  if (status === "completed" && input.credit?.assigneeId?.trim()) {
    patchBody.creditAssigneeId = input.credit.assigneeId.trim();
    patchBody.creditAssigneeName =
      input.credit.assigneeName?.trim() || undefined;
  }
  if (status === "cancelled") {
    patchBody.cancelReason = input.cancelReason?.trim() || undefined;
  }
  return patchBody;
}

/** Trimmed contacts; rows with neither a name nor a phone are dropped. */
export function normalizeCourtVisitContacts(contacts: CourtVisitContactDraft[]) {
  return contacts
    .map((c) => ({
      scope: c.scope || "property",
      name: c.name.trim(),
      role: c.role.trim() || null,
      phone: c.phone.trim() || null,
      note: c.note.trim() || null,
    }))
    .filter((c) => c.name || c.phone);
}

/** Per-deed statements with both a deed and a non-blank text. */
export function courtVisitPerDeedEntries(perDeed: Record<string, string>) {
  return Object.entries(perDeed)
    .map(([deed, text]) => ({ deed, text: text.trim() }))
    .filter((p) => p.deed && p.text);
}

/** Everything the close modal collects. */
export type CloseTaskForm = {
  closeOutcome: "completed" | "cancelled";
  cancelReason: string;
  closeText: string;
  closeFiles: DraftFile[];
  courtKind: CourtVisitKind;
  courtOtherText: string;
  courtStatement: string;
  courtPerDeed: Record<string, string>;
  courtContacts: CourtVisitContactDraft[];
  creditAssigneeId: string;
  creditAssigneeName: string;
};

/** The validated close — the arguments `runStatus` receives. */
export type CloseTaskSubmission = {
  status: "completed" | "cancelled";
  closeComment?: string;
  files?: DraftFile[];
  courtVisitResult?: CourtVisitResultPatch;
  credit?: { assigneeId: string; assigneeName: string };
  cancelReason?: string;
};

export type CloseTaskValidation =
  | { ok: true; submission: CloseTaskSubmission }
  | { ok: false; error: string };

const CREDIT_REQUIRED_ERROR = "اختر من يحصل على مسؤولية التنفيذ";

/**
 * Close-modal validation. Cancelling needs a creator and a reason; a court
 * visit needs the keys outcome (and its detail / contacts); a reassigned task
 * closed by a creator needs the credit pick.
 */
export function buildCloseTaskSubmission(
  task: Pick<OperationsTask, "type" | "originalAssigneeId">,
  form: CloseTaskForm,
  canCreate: boolean,
): CloseTaskValidation {
  if (form.closeOutcome === "cancelled") {
    if (!canCreate) {
      return { ok: false, error: "الإلغاء متاح للمنشئ أو المشرف فقط" };
    }
    if (!form.cancelReason.trim()) {
      return { ok: false, error: "سبب الإلغاء مطلوب" };
    }
    return {
      ok: true,
      submission: { status: "cancelled", cancelReason: form.cancelReason },
    };
  }

  const credit =
    canCreate && task.originalAssigneeId
      ? {
          assigneeId: form.creditAssigneeId,
          assigneeName: form.creditAssigneeName,
        }
      : undefined;

  if (task.type === "court_visit") {
    const { courtKind } = form;
    if (!courtKind) {
      return { ok: false, error: "اختر موقف المفاتيح لدى المحكمة" };
    }
    if (courtKind === "other" && !form.courtOtherText.trim()) {
      return { ok: false, error: "يلزم توضيح النتيجة عند اختيار «أخرى»" };
    }
    const contacts = normalizeCourtVisitContacts(form.courtContacts);
    if (courtKind === "other_party" && contacts.length === 0) {
      return {
        ok: false,
        error:
          "يلزم إدخال جهة اتصال واحدة على الأقل عندما يكون الظرف عند طرف آخر",
      };
    }
    if (canCreate && task.originalAssigneeId && !form.creditAssigneeId.trim()) {
      return { ok: false, error: CREDIT_REQUIRED_ERROR };
    }
    return {
      ok: true,
      submission: {
        status: "completed",
        closeComment: form.closeText,
        files: form.closeFiles,
        courtVisitResult: {
          kind: courtKind,
          other: courtKind === "other" ? form.courtOtherText.trim() : null,
          statement: form.courtStatement.trim() || null,
          perDeed: courtVisitPerDeedEntries(form.courtPerDeed),
          contacts,
        },
        credit,
      },
    };
  }

  if (canCreate && task.originalAssigneeId && !form.creditAssigneeId.trim()) {
    return { ok: false, error: CREDIT_REQUIRED_ERROR };
  }
  return {
    ok: true,
    submission: {
      status: "completed",
      closeComment: form.closeText,
      files: form.closeFiles,
      credit,
    },
  };
}

export type OperationsTaskRowMenuViewer = {
  canCreate: boolean;
  canRemind: boolean;
  reviewerAccount: OperationsQueueAccount;
};

export type OperationsTaskRowMenuHandlers = {
  showDetail: (task: OperationsTask) => void;
  /** «Confirm receipt» and «resume» both move the task to in_progress. */
  markInProgress: (task: OperationsTask) => void;
  closeTask: (task: OperationsTask) => void;
  registerEnvelope: (task: OperationsTask) => void;
  pauseTask: (task: OperationsTask) => void;
  remindTask: (task: OperationsTask) => void;
  changePriority: (task: OperationsTask) => void;
  reassignTask: (task: OperationsTask) => void;
};

/** The row "more" menu — which actions this viewer gets on this row. */
export function buildOperationsTaskRowMenu(
  task: OperationsTask,
  viewer: OperationsTaskRowMenuViewer,
  handlers: OperationsTaskRowMenuHandlers,
): RowMoreMenuItem[] {
  const { canCreate, canRemind } = viewer;
  const items: RowMoreMenuItem[] = [
    {
      id: "detail",
      label: "عرض التفاصيل",
      icon: RowMoreMenuIcons.eye,
      onClick: () => handlers.showDetail(task),
    },
  ];
  const rowIsAssignee = matchesOperationsTaskAssignee(task, viewer.reviewerAccount);
  if (task.status === "created" && rowIsAssignee) {
    items.push({
      id: "start",
      label: "✓ تأكيد الاستلام",
      icon: RowMoreMenuIcons.play,
      onClick: () => handlers.markInProgress(task),
    });
  }
  if (
    (task.status === "in_progress" && rowIsAssignee) ||
    (canCreate &&
      (task.status === "in_progress" ||
        task.status === "paused" ||
        task.status === "created"))
  ) {
    items.push({
      id: "complete",
      label: "إغلاق المهمة",
      icon: RowMoreMenuIcons.checkCircle,
      onClick: () => handlers.closeTask(task),
    });
  }
  if (
    task.type === "court_visit" &&
    !task.linkedEnvelopeId &&
    task.courtVisitResult?.kind === "received" &&
    (task.status === "completed" || task.status === "in_progress")
  ) {
    items.push({
      id: "register-envelope",
      label: "تسجيل الظرف الآن",
      icon: RowMoreMenuIcons.checkCircle,
      onClick: () => handlers.registerEnvelope(task),
    });
  }
  if (canCreate && (task.status === "created" || task.status === "in_progress")) {
    items.push({
      id: "pause",
      label: "إيقاف مؤقت",
      icon: RowMoreMenuIcons.pause,
      onClick: () => handlers.pauseTask(task),
    });
  }
  if (canCreate && task.status === "paused") {
    items.push({
      id: "resume",
      label: "استئناف المهمة",
      icon: RowMoreMenuIcons.play,
      onClick: () => handlers.markInProgress(task),
    });
  }
  if (task.type === "court_visit" && task.letterRows.length > 0) {
    items.push({
      id: "letter",
      label: "عرض خطاب التفويض",
      icon: RowMoreMenuIcons.building,
      onClick: () => handlers.showDetail(task),
    });
  }
  if (canRemind && isActiveOperationsTask(task)) {
    items.push({
      id: "remind",
      label: "تذكير المنفّذ",
      icon: RowMoreMenuIcons.bell,
      onClick: () => handlers.remindTask(task),
    });
  }
  if (canCreate && isActiveOperationsTask(task)) {
    items.push({
      id: "prio",
      label: "تغيير الأولوية",
      icon: RowMoreMenuIcons.flag,
      onClick: () => handlers.changePriority(task),
    });
    items.push({
      id: "reassign",
      label: "إعادة توجيه وإسناد",
      icon: RowMoreMenuIcons.arrowRight,
      onClick: () => handlers.reassignTask(task),
    });
  }
  return items;
}

// ---------------------------------------------------------------------------
// Screen-region rules that used to live inline in the view JSX.
// ---------------------------------------------------------------------------

/** Countdown shape returned by `taskCountdown` — kept structural so tests need no clock. */
export type TaskCountdownLike = { txt: string; over: boolean };

/** Mobile card tone: finished, urgent/overdue, in flight, or fresh. */
export type OperationsTaskCardTone = "done" | "returned" | "pending" | "new";

export function operationsTaskCardTone(
  task: Pick<OperationsTask, "status" | "priority">,
  overdue: boolean,
): OperationsTaskCardTone {
  if (task.status === "completed" || task.status === "cancelled") return "done";
  if (task.priority === "urgent" || task.priority === "high" || overdue) {
    return "returned";
  }
  if (task.status === "in_progress" || task.status === "paused") return "pending";
  return "new";
}

/** «متأخرة» when overdue, the ticking text while it counts, nothing when idle. */
export function operationsTaskCountdownLabel(
  cd: TaskCountdownLike,
): string | undefined {
  if (cd.over) return "متأخرة";
  return cd.txt !== "—" && cd.txt !== "متوقفة" ? cd.txt : undefined;
}

/** Per-tick mobile timer: `null` hides the timer once the countdown has no text. */
export function operationsTaskTimerTick(
  cd: TaskCountdownLike,
): { label: string; overdue: boolean } | null {
  if (cd.txt === "—" || cd.txt === "متوقفة") return null;
  return { label: cd.over ? "متأخرة" : cd.txt, overdue: cd.over };
}

/** Third meta chip on a mobile card: the assignee, else the link, else the scope. */
export function operationsTaskCardLinkMeta(
  task: OperationsTask,
): { text: string; kind: "place" | "plain" } {
  const assignee = (task.assigneeName || task.assigneeId || "").trim();
  if (assignee) return { text: assignee, kind: "place" };
  const link = operationsTaskLinkLabel(task);
  if (link && link !== "—") return { text: link, kind: "plain" };
  return { text: operationsTaskScopeLabel(task.scope), kind: "plain" };
}

/** «النطاق / الربط» cell on the detail header. */
export function operationsTaskLinkChip(task: OperationsTask): string {
  return task.scope === "general"
    ? "غير مرتبطة — مهمة مستقلة"
    : `${operationsTaskScopeLabel(task.scope)} · ${operationsTaskLinkLabel(task)}`;
}

/** Past due while still open — a paused task never counts as overdue. */
export function isOperationsTaskOverdue(
  task: Pick<OperationsTask, "status" | "dueAt">,
  nowMs: number,
): boolean {
  return (
    !isTerminalOperationsTaskStatus(task.status) &&
    new Date(task.dueAt).getTime() < nowMs &&
    task.status !== "paused"
  );
}

/** Only a started (or paused) task can be closed as «completed». */
export function allowsCompleteOutcome(status: string | undefined): boolean {
  return status === "in_progress" || status === "paused";
}

/** Close modal chrome per outcome. */
export function closeModalTitles(
  closeOutcome: "completed" | "cancelled",
): { title: string; subtitle: string } {
  return closeOutcome === "cancelled"
    ? {
        title: "إلغاء المهمة",
        subtitle: "صلاحية منشئ المهمة — يتطلب سبباً إلزامياً",
      }
    : {
        title: "إغلاق المهمة — منجزة",
        subtitle: "يقوم المنفّذ بإغلاق المهمة بعد إتمام العمل المطلوب",
      };
}

export type OperationsTaskReceiptCell =
  | { kind: "hidden" }
  | { kind: "confirm" }
  | { kind: "label"; text: string; confirmed: boolean };

/** The receipt slot on the detail summary: the assignee's confirm button, a label, or nothing. */
export function operationsTaskReceiptCell(
  task: Pick<OperationsTask, "status" | "receiptConfirmedAt">,
  isAssignee: boolean,
): OperationsTaskReceiptCell {
  const receipt = operationsTaskReceiptLabel(task);
  if (receipt === null && isTerminalOperationsTaskStatus(task.status)) {
    return { kind: "hidden" };
  }
  if (task.status === "created" && isAssignee) return { kind: "confirm" };
  if (!receipt) return { kind: "hidden" };
  const confirmed = receipt === "مؤكَّد";
  return { kind: "label", text: confirmed ? "✓ مؤكَّد" : receipt, confirmed };
}

export type OperationsTaskDetailActions = {
  close: boolean;
  pause: boolean;
  resume: boolean;
  reassign: boolean;
  changePriority: boolean;
};

/** Which action buttons the detail footer shows — mirrors the row menu rules. */
export function operationsTaskDetailActions(
  task: Pick<OperationsTask, "status">,
  viewer: { isAssignee: boolean; canCreate: boolean },
): OperationsTaskDetailActions {
  const { isAssignee, canCreate } = viewer;
  const active = task.status === "created" || task.status === "in_progress";
  return {
    close:
      (task.status === "in_progress" && isAssignee) ||
      (canCreate &&
        (task.status === "in_progress" ||
          task.status === "paused" ||
          task.status === "created")),
    pause: canCreate && active,
    resume: canCreate && task.status === "paused",
    reassign: canCreate && active,
    changePriority: canCreate && active,
  };
}

/** A completed court visit that received an envelope nobody has registered yet. */
export function needsEnvelopeRegistration(
  task: Pick<OperationsTask, "type" | "status" | "courtVisitResult" | "linkedEnvelopeId">,
): boolean {
  return (
    task.type === "court_visit" &&
    task.courtVisitResult?.kind === "received" &&
    task.status === "completed" &&
    !task.linkedEnvelopeId
  );
}

/** Header checkbox: (de)select every active visible row, leaving other ids untouched. */
export function toggleVisibleActiveSelection(
  selectedIds: Record<string, boolean>,
  visibleTasks: OperationsTask[],
  on: boolean,
): Record<string, boolean> {
  const next = { ...selectedIds };
  for (const t of visibleTasks) {
    if (!isActiveOperationsTask(t)) continue;
    if (on) next[t.id] = true;
    else delete next[t.id];
  }
  return next;
}

/** Single-row checkbox reducer. */
export function toggleSelectedId(
  prev: Record<string, boolean>,
  id: string,
  on: boolean,
): Record<string, boolean> {
  const next = { ...prev };
  if (on) next[id] = true;
  else delete next[id];
  return next;
}

export function emptyQueueMessage(useIndependentQueue: boolean): string {
  return useIndependentQueue ? "لا توجد مهام مسندة إليك." : "لا توجد مهام مطابقة.";
}
