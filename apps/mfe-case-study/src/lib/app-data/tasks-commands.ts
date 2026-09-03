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
  reopenCompletedWorkflowTask,
  revertWorkflowTaskPhase,
  syncWorkflowTasks,
} from "@platform/api-client";
import { apiErrorMessage, resolveApiError, workOrdersApiConfig } from "../work-orders-api-config";
import { notifyWorkOrdersChanged } from "@platform/app-shared/app-data/work-orders-api-config";
import { hasRuntimeCapability } from "@platform/app-shared/app-data/runtime-access";
import type { PoPropertyIntake } from "./po-intake-data";
import { formatPropertyDeedDisplay } from "./po-intake-data";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import type {
  TaskDistributionDraft,
  WorkflowTask,
} from "@platform/app-shared/workflow/task-types";
import { notifyTasksChanged } from "@platform/app-shared/workflow/task-types";
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
  type SyncTaskSlotsResult,
  type SyncTasksResult,
} from "./tasks-model";
import {
  caseStudyTaskForProperty,
  loadWorkflowTasks,
  loadWorkflowTasksForQuery,
  poCaseTasks,
} from "./tasks-reads";

export async function syncTaskSlotsForPo(
  poNumber: string,
): Promise<SyncTaskSlotsResult> {
  const sync = await syncTasksFromPoRecords();
  if (!sync.ok) return { ok: false, error: sync.error };
  const list = await loadWorkflowTasks();
  return {
    ok: true,
    tasks: poCaseTasks(list, poNumber.trim()),
  };
}

/** Link a property registered in primary data to the next empty workflow slot. */
export async function linkNewPropertyToTaskSlot(
  poNumber: string,
  property: PoPropertyIntake,
): Promise<AdvanceTaskResult | null> {
  if (!property.id) return null;
  const slots = await syncTaskSlotsForPo(poNumber);
  if (!slots.ok) return { ok: false, error: slots.error };
  // slots.tasks is the same poCaseTasks result from a list just loaded —
  // calling loadWorkflowTasks again was a duplicate identical GET.
  const tasks = slots.tasks;
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
  const list = tasks ?? (await loadWorkflowTasks());
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
      t.status !== "completed",
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
  if (!resolved || resolved.phase !== "obstruction") return null;

  const resumePhase =
    resolved.obstructionPriorPhase ??
    (resolved.propertyId ? "bourse" : "enfath");

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

/**
 * Single-flight + cooldown for the slot sync. Cache warm-ups fire from several
 * query keys on every navigation (see `loadPoRecordsWithTaskSync` and the shell
 * prefetches), and overlapping POST /workflow-tasks/sync calls used to race on
 * the same rows server-side. Concurrent callers collapse onto one request, and
 * quiet warm-ups (`notify: false`) skip entirely inside the cooldown window.
 * Mutating paths (default `notify: true`) always run a fresh sync.
 */

const SYNC_COOLDOWN_MS = 60_000;
let syncInFlight: Promise<SyncTasksResult> | null = null;
let lastSyncOkAtMs = 0;

async function syncTasksOnce(): Promise<SyncTasksResult> {
  const config = workOrdersApiConfig();
  if (!config) {
    return { ok: false, error: apiErrorMessage("auth") };
  }
  if (!hasRuntimeCapability("manage-work-orders")) {
    return { ok: true };
  }
  const result = await syncWorkflowTasks(config);
  if (!result.ok) {
    console.warn("[workflow-tasks] sync failed:", result.kind);
    return {
      ok: false,
      error: apiErrorMessage(
        result.kind,
        "تعذّر مزامنة خانات البيانات الأولية",
      ),
    };
  }
  lastSyncOkAtMs = Date.now();
  return { ok: true };
}

export async function syncTasksFromPoRecords(options?: {
  /** Default true — set false when warming the PO cache so reads don't fan out. */
  notify?: boolean;
}): Promise<SyncTasksResult> {
  const quiet = options?.notify === false;
  if (quiet) {
    if (syncInFlight) return syncInFlight;
    if (Date.now() - lastSyncOkAtMs < SYNC_COOLDOWN_MS) {
      return { ok: true };
    }
  } else if (syncInFlight) {
    // Serialize behind the in-flight warm-up, then run fresh — a mutation may
    // have landed after that sync started.
    await syncInFlight.catch(() => undefined);
  }

  const flight = syncTasksOnce().finally(() => {
    syncInFlight = null;
  });
  syncInFlight = flight;
  const result = await flight;
  if (result.ok && !quiet) {
    notifyTasksChanged();
  }
  return result;
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
