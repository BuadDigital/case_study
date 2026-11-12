/**
 * «رفع مساحي مضاف بعد التوزيع» on the tasks page (Omar 2026-11-11): the engineering office is added
 * from «مهمة جديدة», so what was added shows on the same page — although it is the office's own survey
 * task, not an operations task. Since 2026-11-12 (Omar) the surveys are rows of the tasks table
 * itself, ahead of the operations tasks; the separate box above the table is gone. Pure.
 */
import type { WorkflowTask } from "../lib/app-data/tasks-model";

/** Where the added survey stands: with the office, delivered and waiting, or received. */
export type AddedSurveyState = "open" | "delivered" | "received";

export const ADDED_SURVEY_STATE_LABELS: Record<AddedSurveyState, string> = {
  open: "عند المكتب — قيد التنفيذ",
  delivered: "سلّم المكتب عمله — بانتظار الاستلام",
  received: "استُلمت مخرجاته",
};

/** The badge tone of each state, wherever the survey is listed. */
export const ADDED_SURVEY_STATE_TONES: Record<AddedSurveyState, "warning" | "primary" | "success"> = {
  open: "warning",
  delivered: "primary",
  received: "success",
};

export type AddedSurveyRow = { task: WorkflowTask; state: AddedSurveyState };

/** The added surveys of one deed — what its «المهام المرتبطة» section lists (Omar 2026-11-12). */
export function addedSurveysOfProperty(tasks: WorkflowTask[], propertyId: string): AddedSurveyRow[] {
  return surveysAddedAfterDistribution(tasks).filter((row) => row.task.propertyId === propertyId);
}

/**
 * The surveys added after the distribution that are still the study's business, newest first.
 *
 * How it works: a live engineering-survey task whose transaction is in the study phase, and that
 * was not spawned by the distribution. The distribution spawns its party tasks in one instant, so
 * a survey created at another instant than its sibling field inspection was added later.
 *
 * Edge cases: a cancelled survey (the office was skipped) is left out; once the study report is
 * issued the transaction leaves the study phase and the row leaves with it; a survey whose sibling
 * inspection is not in the list cannot be told apart and is left out.
 */
export function surveysAddedAfterDistribution(tasks: WorkflowTask[]): AddedSurveyRow[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const distributedAt = new Map<string, string>();
  for (const t of tasks) {
    if (t.kind === "field-inspection" && t.parentTaskId) distributedAt.set(t.parentTaskId, t.createdAt);
  }
  return tasks
    .filter((t) => {
      if (t.kind !== "engineering-survey" || t.status === "cancelled" || !t.parentTaskId) return false;
      if (byId.get(t.parentTaskId)?.phase !== "case-study") return false;
      const spawned = distributedAt.get(t.parentTaskId);
      return spawned !== undefined && spawned !== t.createdAt;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((task) => ({
      task,
      state: task.status !== "completed" ? "open" : task.packageAccepted ? "received" : "delivered",
    }));
}

/**
 * The added surveys the tasks table shows under its current filters.
 *
 * How it works: the search box matches the deed, the work order or the office's name; the scope
 * filter keeps them under «كل النطاقات» and «صك» (a survey is always on one deed).
 * Edge cases: a status filter hides them all — the survey's states (with the office, delivered,
 * received) are not the operations tasks' statuses, so no status of that list names them; «النشطة
 * فقط» keeps them, received ones too, until the study report is issued.
 */
export function visibleAddedSurveys(
  rows: AddedSurveyRow[],
  filters: { search: string; statusFilter: string; scopeFilter: string },
): AddedSurveyRow[] {
  if (filters.statusFilter) return [];
  if (filters.scopeFilter && filters.scopeFilter !== "transaction") return [];
  const q = filters.search.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(({ task }) =>
    [task.deedNumber ?? "", task.poNumber ?? "", task.assigneeName ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(q),
  );
}
