import {
  advanceWorkflowTaskAfterBourse,
  advanceWorkflowTaskAfterEnfath,
  confirmWorkflowTaskDistribution,
  deleteWorkflowTaskSlot,
  deleteWorkflowTasksForPo,
  deleteWorkflowTasksForProperty,
  patchWorkflowTask,
  patchWorkflowTaskDistribution,
  redistributeWorkflowTaskParties,
  addWorkflowTaskEngineeringSurvey,
  skipWorkflowTaskEngineeringSurvey,
  reopenCompletedWorkflowTask,
  revertWorkflowTaskPhase,
} from "@platform/api-client";
import { apiErrorMessage, resolveApiError, workOrdersApiConfig } from "@platform/app-shared/app-data/work-orders-api-config";
import { notifyWorkOrdersChanged } from "@platform/app-shared/app-data/work-orders-api-config";
import { hasRuntimeCapability } from "@platform/app-shared/app-data/runtime-access";
import type { PoPropertyIntake } from "./po-intake-data";
import { formatPropertyDeedDisplay } from "./po-intake-data";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import type {
  TaskDistributionDraft,
  WorkflowTask,
} from "@platform/app-shared/workflow/task-types";
import { notifyTasksChanged, WorkflowTaskStatuses, CaseStudyTaskPhases } from "@platform/app-shared/workflow/task-types";
import {
  buildAssigneeNames,
  defaultDistribution,
  distributionToDto,
  dtoToTask,
  migrateDistribution,
  type AdvanceTaskResult,
  type RedistributePartiesResult,
  type ReopenCompletedTaskResult,
  type RevertTaskPhaseResult,
} from "./tasks-model";
import {
  caseStudyTaskForProperty,
  loadWorkflowTasks,
  loadWorkflowTasksForPo,
  loadWorkflowTasksForQuery,
  poCaseTasks,
} from "./tasks-reads";

/** Link a property registered in primary data to the next empty workflow slot. */
export async function linkNewPropertyToTaskSlot(
  poNumber: string,
  property: PoPropertyIntake,
): Promise<AdvanceTaskResult | null> {
  if (!property.id) return null;
  // The server linked the deed to a free slot when it was saved (2026-11-19); this finds it, and
  // links it here only when that did not happen.
  const tasks = poCaseTasks(await loadWorkflowTasksForPo(poNumber), poNumber.trim());
  const existing = caseStudyTaskForProperty(poNumber, property.id, tasks);
  if (existing) return { ok: true, task: existing };
  const slot = tasks
    .filter((t) => !t.propertyId)
    .sort((a, b) => a.propertyOrdinal - b.propertyOrdinal)[0];
  if (!slot) return null;

  return advanceTaskAfterEnfath(slot.id, property);
}

export async function deleteTasksForProperty(
  poNumber: string,
  propertyId: string,
  expectedPropertyCount = 1,
): Promise<void> {
  const config = workOrdersApiConfig();
  if (!config) return;
  await deleteWorkflowTasksForProperty(
    config,
    poNumber,
    propertyId,
    expectedPropertyCount,
  );
  notifyTasksChanged();
}

export async function deleteTasksForPo(poNumber: string): Promise<void> {
  const config = workOrdersApiConfig();
  if (!config) return;
  await deleteWorkflowTasksForPo(config, poNumber);
  notifyTasksChanged();
}

/** Delete a case-study slot/transaction (property is marked deleted with reason when provided). */
export async function deletePrimaryDataTransaction(
  taskId: string,
  reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = reason.trim();
  if (!trimmed) {
    return { ok: false, error: "سبب الحذف مطلوب" };
  }
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await deleteWorkflowTaskSlot(config, taskId, trimmed);
  if (!result.ok) {
    return {
      ok: false,
      error: resolveApiError(
        result.kind,
        "errors" in result ? result.errors : undefined,
        "تعذّر حذف المعاملة",
      ),
    };
  }
  notifyTasksChanged();
  notifyWorkOrdersChanged();
  return { ok: true };
}

export async function advanceTaskAfterEnfath(
  taskId: string,
  property: PoPropertyIntake,
): Promise<AdvanceTaskResult> {
  if (property.isRemoved) {
    return { ok: false, error: "لا يمكن تقديم معاملة لعقار محذوف" };
  }
  const config = workOrdersApiConfig();
  if (!config || !property.id) {
    return { ok: false, error: apiErrorMessage("auth") };
  }
  const result = await advanceWorkflowTaskAfterEnfath(config, taskId, {
    propertyId: property.id,
    identifierType: property.identifierType,
    bourseDataCompleted: Boolean(property.bourseDataCompleted),
    deedNumber: property.deedNumber,
  });
  if (!result.ok) {
    return {
      ok: false,
      error: resolveApiError(
        result.kind,
        "errors" in result ? result.errors : undefined,
        "تعذّر تقديم مهمة إدخال البيانات الأولية",
      ),
    };
  }
  notifyTasksChanged();
  return { ok: true, task: dtoToTask(result.data) };
}

export async function advanceTaskAfterBourse(
  taskId: string,
  property: PoPropertyIntake,
): Promise<AdvanceTaskResult> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await advanceWorkflowTaskAfterBourse(
    config,
    taskId,
    formatPropertyDeedDisplay(property),
  );
  if (!result.ok) {
    return {
      ok: false,
      error: resolveApiError(
        result.kind,
        "errors" in result ? result.errors : undefined,
        "تعذّر تقديم مهمة البورصة",
      ),
    };
  }
  notifyTasksChanged();
  return { ok: true, task: dtoToTask(result.data) };
}

/** Return a case-study task to a previous stage (bourse or primary data). */
export async function revertTaskToPhase(
  taskId: string,
  targetPhase: "enfath" | "bourse",
): Promise<RevertTaskPhaseResult> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await revertWorkflowTaskPhase(config, taskId, targetPhase);
  if (!result.ok) {
    return {
      ok: false,
      error: resolveApiError(
        result.kind,
        "errors" in result ? result.errors : undefined,
        "تعذّر إرجاع المعاملة للمرحلة السابقة",
      ),
    };
  }
  notifyTasksChanged();
  return { ok: true, task: dtoToTask(result.data) };
}

/** Reopen a completed transaction — section-supervisor+ permission; reason required. */
export async function reopenCompletedTransaction(
  taskId: string,
  reason: string,
): Promise<ReopenCompletedTaskResult> {
  const trimmed = reason.trim();
  if (!trimmed) {
    return { ok: false, error: "سبب إعادة الفتح مطلوب" };
  }
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await reopenCompletedWorkflowTask(config, taskId, trimmed);
  if (!result.ok) {
    return {
      ok: false,
      error: resolveApiError(
        result.kind,
        "errors" in result ? result.errors : undefined,
        "تعذّر إعادة فتح المعاملة",
      ),
    };
  }
  notifyTasksChanged();
  return { ok: true, task: dtoToTask(result.data) };
}

/** After bourse inquiry — move linked case-study task to transaction distribution. */
export async function advanceTaskAfterBourseForProperty(
  poNumber: string,
  propertyId: string,
  property: PoPropertyIntake,
  tasks?: WorkflowTask[],
): Promise<AdvanceTaskResult | null> {
  const list = tasks ?? (await loadWorkflowTasksForPo(poNumber));
  const task = caseStudyTaskForProperty(poNumber, propertyId, list);
  if (!task) return null;
  return advanceTaskAfterBourse(task.id, property);
}

export async function confirmTaskDistribution(
  taskId: string,
  distribution: TaskDistributionDraft,
  deedNumber = "",
  staffUsers: StaffUser[] = [],
  idempotencyKey?: string,
): Promise<{
  parent: WorkflowTask | null;
  children: WorkflowTask[];
  error?: string;
}> {
  const config = workOrdersApiConfig();
  if (!config) {
    return {
      parent: null,
      children: [],
      error: apiErrorMessage("auth"),
    };
  }

  const normalized = migrateDistribution(distribution, staffUsers);
  const result = await confirmWorkflowTaskDistribution(config, taskId, {
    distribution: distributionToDto(normalized)!,
    deedNumber,
    assigneeNames: buildAssigneeNames(normalized, staffUsers),
  }, idempotencyKey);
  if (!result.ok) {
    return {
      parent: null,
      children: [],
      error: resolveApiError(
        result.kind,
        "errors" in result ? result.errors : undefined,
      ),
    };
  }
  if (!result.data.parent) {
    return {
      parent: null,
      children: [],
      error: "تعذّر تأكيد التوزيع — تحقق من المرحلة وحاول مرة أخرى",
    };
  }

  notifyTasksChanged();
  return {
    parent: dtoToTask(result.data.parent),
    children: result.data.children.map(dtoToTask),
  };
}

/**
 * Edit party assignment on an existing case-study transaction (after distribution confirmed) —
 * updates assignees on existing sub-tasks only without reopening distribution.
 */
export async function redistributeTaskParties(
  taskId: string,
  distribution: TaskDistributionDraft,
  reason: string,
  staffUsers: StaffUser[] = [],
  idempotencyKey?: string,
): Promise<RedistributePartiesResult> {
  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    return { ok: false, error: "سبب إعادة الإسناد مطلوب" };
  }
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };

  const normalized = migrateDistribution(distribution, staffUsers);
  const result = await redistributeWorkflowTaskParties(
    config,
    taskId,
    {
      distribution: distributionToDto(normalized)!,
      assigneeNames: buildAssigneeNames(normalized, staffUsers),
      reason: trimmedReason,
    },
    idempotencyKey,
  );
  if (!result.ok) {
    return {
      ok: false,
      error: resolveApiError(
        result.kind,
        "errors" in result ? result.errors : undefined,
        "تعذّر إعادة إسناد الأطراف",
      ),
    };
  }
  notifyTasksChanged();
  return { ok: true, task: dtoToTask(result.data) };
}

/**
 * «إضافة رفع مساحي» after distribution — called from «مهمة جديدة», type «رفع مساحي» (Omar 2026-11-11).
 * The server refuses when a survey is already live, and — for a property the survey rule asks no
 * survey for — when `exceptionReason` is missing.
 */
export async function addEngineeringSurveyToTask(
  parentTaskId: string,
  office: { id: string; name: string },
  exceptionReason?: string,
): Promise<RedistributePartiesResult> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  return surveyCommandResult(
    await addWorkflowTaskEngineeringSurvey(config, parentTaskId, {
      assigneeId: office.id,
      assigneeName: office.name,
      ...(exceptionReason?.trim() ? { exceptionReason: exceptionReason.trim() } : {}),
    }),
    "تعذّر إضافة الرفع المساحي",
  );
}

/**
 * «تجاوز المكتب الهندسي» (Omar 2026-11-11) — the study goes on without the office: its open task is
 * cancelled and earns no fee. The server refuses once the office delivered, or without a reason.
 */
export async function skipEngineeringSurveyOfTask(
  parentTaskId: string,
  reason: string,
): Promise<RedistributePartiesResult> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  return surveyCommandResult(
    await skipWorkflowTaskEngineeringSurvey(config, parentTaskId, { reason }),
    "تعذّر تجاوز المكتب الهندسي",
  );
}

/** A survey command's answer as the screens read it; a success refreshes the task lists. */
function surveyCommandResult(
  result: Awaited<ReturnType<typeof addWorkflowTaskEngineeringSurvey>>,
  fallback: string,
): RedistributePartiesResult {
  if (!result.ok) {
    return {
      ok: false,
      error: resolveApiError(result.kind, "errors" in result ? result.errors : undefined, fallback),
    };
  }
  notifyTasksChanged();
  return { ok: true, task: dtoToTask(result.data) };
}

/** Pause all open work on a property — SLA timer keeps running elsewhere. */
export async function suspendWorkflowTasksForProperty(
  poNumber: string,
  propertyId: string,
  reason: string,
): Promise<boolean> {
  const n = poNumber.trim();
  let list: WorkflowTask[];
  try {
    list = await loadWorkflowTasksForQuery();
  } catch {
    return false;
  }
  const related = list.filter(
    (t) =>
      t.poNumber.trim() === n &&
      t.propertyId === propertyId &&
      t.status !== WorkflowTaskStatuses.Completed,
  );
  const config = workOrdersApiConfig();
  if (!config) return false;
  const note = reason.trim() || "معاملة معلقة";
  const results = await Promise.allSettled(
    related.map((task) =>
      patchWorkflowTask(config, task.id, {
        status: "blocked",
        obstructionReason: note,
      }),
    ),
  );
  const allOk = results.every(
    (r) => r.status === "fulfilled" && r.value.ok,
  );
  if (related.length > 0) notifyTasksChanged();
  return allOk;
}

export async function resolveTaskObstruction(
  taskId: string,
  task?: WorkflowTask,
): Promise<WorkflowTask | null> {
  const resolved =
    task ?? (await loadWorkflowTasks()).find((t) => t.id === taskId);
  if (!resolved || resolved.phase !== CaseStudyTaskPhases.Obstruction) return null;

  const resumePhase =
    resolved.obstructionPriorPhase ??
    (resolved.propertyId ? CaseStudyTaskPhases.Bourse : CaseStudyTaskPhases.Enfath);

  const config = workOrdersApiConfig();
  if (!config) return null;
  const result = await patchWorkflowTask(config, taskId, {
    phase: resumePhase,
    assigneeRole: "case-specialist",
    assigneeName: "أخصائي دراسة الحالة",
    status: "open",
    obstructionReason: "",
    obstructionPriorPhase: "",
  });
  if (!result.ok) return null;
  notifyTasksChanged();
  return dtoToTask(result.data);
}

export async function completeChildTask(
  taskId: string,
): Promise<WorkflowTask | null> {
  const config = workOrdersApiConfig();
  if (!config) return null;
  const result = await patchWorkflowTask(config, taskId, {
    status: "completed",
    phase: "done",
  });
  if (!result.ok) return null;
  notifyTasksChanged();
  return dtoToTask(result.data);
}

export async function patchTaskDistribution(
  taskId: string,
  patch: Partial<TaskDistributionDraft>,
  task?: WorkflowTask,
): Promise<WorkflowTask | null> {
  const resolved =
    task ?? (await loadWorkflowTasks()).find((t) => t.id === taskId);
  if (!resolved) return null;

  const distribution = migrateDistribution({
    ...(resolved.distribution ?? defaultDistribution()),
    ...patch,
  });
  if (!distribution.valuationDepartment) {
    distribution.inspectorId = "";
    distribution.valuatorId = "";
  }
  if (!distribution.engineeringOffice) {
    distribution.engineeringOfficeId = "";
  }

  const config = workOrdersApiConfig();
  if (!config) return null;
  const result = await patchWorkflowTaskDistribution(
    config,
    taskId,
    distributionToDto(distribution)!,
  );
  if (!result.ok) return null;
  notifyTasksChanged();
  return dtoToTask(result.data);
}
