import type { RoleId } from "@platform/types";
import type { WorkflowTaskDto } from "@platform/api-client";
import {
  advanceWorkflowTaskAfterBourse,
  advanceWorkflowTaskAfterEnfath,
  confirmWorkflowTaskDistribution,
  deleteWorkflowTasksForPo,
  deleteWorkflowTasksForProperty,
  listWorkflowTasks,
  patchWorkflowTask,
  patchWorkflowTaskDistribution,
  syncWorkflowTasks,
} from "@platform/api-client";
import { workOrdersApiConfig } from "../work-orders-api-config";
import { isSuperAdmin } from "@platform/app-shared/prototype/prototype-role-access";
import {
  getPrototypeRoleAssigneeId,
  partyAccountForViewer,
} from "./distribution-parties";
import { ROLES, type StaffUser } from "@platform/app-shared/prototype/constants";
import type {
  AssignmentType,
  PoIntakeRecord,
  PoPropertyIntake,
} from "./po-intake-data";
import {
  classificationRequiresSurvey,
  formatPropertyDeedDisplay,
} from "./po-intake-data";
import {
  assigneeLabel,
  getEngineeringOffices,
  getFieldInspectors,
  getGovernmentAuditors,
  getValuationCoordinators,
  getValuators,
} from "./distribution-parties";

/** @deprecated Tasks persist in PostgreSQL — kept for storage-event compatibility. */
export const TASKS_STORAGE_KEY = "evalWorkflowTasks";
export const TASKS_CHANGED_EVENT = "eval-workflow-tasks-changed";

/** Phases of the case-study property task (specialist workflow). */
export type CaseStudyTaskPhase =
  | "enfath"
  | "bourse"
  | "distribution"
  | "case-study"
  | "done"
  | "obstruction";

export type WorkflowTaskKind =
  | "case-study-property"
  | "field-inspection"
  | "government-review"
  | "engineering-survey"
  | "valuation-coordination"
  | "property-appraisal";

export type WorkflowTaskStatus = "open" | "completed" | "blocked";

/** Party selection on توزيع المعاملات — checkbox gates each dropdown group. */
export type TaskDistributionDraft = {
  governmentAuditor: boolean;
  governmentAuditorId: string;
  valuationDepartment: boolean;
  operationsCoordinatorId: string;
  inspectorId: string;
  valuatorId: string;
  engineeringOffice: boolean;
  engineeringOfficeId: string;
};

type LegacyDistribution = {
  fieldInspector?: boolean;
  governmentReviewer?: boolean;
  engineeringOffice?: boolean;
  fieldInspectorRecommendedVisit?: boolean;
};

export function migrateDistribution(
  raw: TaskDistributionDraft | LegacyDistribution | undefined,
  staffUsers: StaffUser[] = [],
): TaskDistributionDraft {
  const base = defaultDistribution();
  if (!raw) return base;
  if ("governmentAuditor" in raw) {
    return { ...base, ...(raw as TaskDistributionDraft) };
  }
  const legacy = raw as LegacyDistribution;
  return {
    ...base,
    governmentAuditor: legacy.governmentReviewer ?? false,
    governmentAuditorId:
      legacy.governmentReviewer && getGovernmentAuditors(staffUsers)[0]
        ? getGovernmentAuditors(staffUsers)[0].id
        : "",
    valuationDepartment: legacy.fieldInspector ?? false,
    operationsCoordinatorId:
      legacy.fieldInspector && getValuationCoordinators(staffUsers)[0]
        ? getValuationCoordinators(staffUsers)[0].id
        : "",
    inspectorId:
      legacy.fieldInspector && getFieldInspectors(staffUsers)[0]
        ? getFieldInspectors(staffUsers)[0].id
        : "",
    valuatorId:
      legacy.fieldInspector && getValuators(staffUsers)[0]
        ? getValuators(staffUsers)[0].id
        : "",
    engineeringOffice: legacy.engineeringOffice ?? false,
    engineeringOfficeId:
      legacy.engineeringOffice && getEngineeringOffices(staffUsers)[0]
        ? getEngineeringOffices(staffUsers)[0].id
        : "",
  };
}

export type WorkflowTask = {
  id: string;
  kind: WorkflowTaskKind;
  poNumber: string;
  /** Set after phase 1 (Enfath) saves the property. */
  propertyId?: string;
  /** Slot index 1..expectedPropertyCount on the PO. */
  propertyOrdinal: number;
  title: string;
  phase: CaseStudyTaskPhase;
  assigneeRole: RoleId;
  assigneeName: string;
  /** Distribution dropdown id (e.g. fi-ahmed) — filters queue per prototype user. */
  assigneeId?: string;
  parentTaskId?: string;
  status: WorkflowTaskStatus;
  distribution?: TaskDistributionDraft;
  obstructionReason?: string;
  obstructionPriorPhase?: CaseStudyTaskPhase;
  assignmentType?: PoIntakeRecord["assignmentType"];
  createdAt: string;
  updatedAt: string;
};

export function notifyTasksChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TASKS_CHANGED_EVENT));
}

function dtoToTask(dto: WorkflowTaskDto): WorkflowTask {
  return {
    id: dto.id,
    kind: dto.kind as WorkflowTaskKind,
    poNumber: dto.poNumber,
    propertyId: dto.propertyId,
    propertyOrdinal: dto.propertyOrdinal,
    title: dto.title,
    phase: dto.phase as CaseStudyTaskPhase,
    assigneeRole: dto.assigneeRole as RoleId,
    assigneeName: dto.assigneeName,
    assigneeId: dto.assigneeId,
    parentTaskId: dto.parentTaskId,
    status: dto.status as WorkflowTaskStatus,
    distribution: dto.distribution
      ? migrateDistribution(dto.distribution)
      : undefined,
    obstructionReason: dto.obstructionReason,
    obstructionPriorPhase: dto.obstructionPriorPhase as
      | CaseStudyTaskPhase
      | undefined,
    assignmentType: dto.assignmentType as AssignmentType | undefined,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

function distributionToDto(
  distribution: TaskDistributionDraft,
): WorkflowTaskDto["distribution"] {
  return {
    governmentAuditor: distribution.governmentAuditor,
    governmentAuditorId: distribution.governmentAuditorId,
    valuationDepartment: distribution.valuationDepartment,
    operationsCoordinatorId: distribution.operationsCoordinatorId,
    inspectorId: distribution.inspectorId,
    valuatorId: distribution.valuatorId,
    engineeringOffice: distribution.engineeringOffice,
    engineeringOfficeId: distribution.engineeringOfficeId,
  };
}

export async function loadWorkflowTasks(): Promise<WorkflowTask[]> {
  const config = workOrdersApiConfig();
  if (!config) return [];
  const result = await listWorkflowTasks(config);
  if (!result.ok) return [];
  return result.data.map(dtoToTask);
}

function poCaseTasks(list: WorkflowTask[], poNumber: string): WorkflowTask[] {
  const n = poNumber.trim();
  return list.filter(
    (t) => t.kind === "case-study-property" && t.poNumber.trim() === n,
  );
}

export function taskKindLabel(kind: WorkflowTaskKind): string {
  if (kind === "case-study-property") return "دراسة حالة — عقار";
  if (kind === "field-inspection") return "معاينة ميدانية";
  if (kind === "government-review") return "مراجعة حكومية";
  if (kind === "valuation-coordination") return "منسق التقييم — استلام";
  if (kind === "property-appraisal") return "تقييم عقاري";
  return "رفع مساحي — مكتب هندسي";
}

export function taskPhaseLabel(phase: CaseStudyTaskPhase): string {
  if (phase === "enfath") return "البيانات الأولية للعقار";
  if (phase === "bourse") return "المرحلة 2 — بيانات البورصة";
  if (phase === "distribution") return "المرحلة 3 — توزيع الأطراف";
  if (phase === "case-study") return "دراسة حالة العقار";
  if (phase === "obstruction") return "تعذر — بانتظار المشرف";
  return "مكتملة";
}

export function taskStatusLabel(status: WorkflowTaskStatus): string {
  if (status === "open") return "مفتوحة";
  if (status === "blocked") return "موقوفة";
  return "مكتملة";
}

export function taskDisplayPropertyLabel(task: WorkflowTask): string {
  if (task.propertyId) {
    const part = task.title.split(" — ")[0];
    return part || `عقار ${task.propertyOrdinal}`;
  }
  return `خانة ${task.propertyOrdinal}`;
}

export function engineeringOfficeAvailable(
  property: PoPropertyIntake,
  hasPriorSurvey: boolean,
): boolean {
  if (!classificationRequiresSurvey(property.classification)) return false;
  if (hasPriorSurvey) return false;
  return true;
}

export function defaultDistribution(): TaskDistributionDraft {
  return {
    governmentAuditor: false,
    governmentAuditorId: "",
    valuationDepartment: false,
    operationsCoordinatorId: "",
    inspectorId: "",
    valuatorId: "",
    engineeringOffice: false,
    engineeringOfficeId: "",
  };
}

export function distributionValidationError(
  distribution: TaskDistributionDraft,
  engineeringAvailable: boolean,
): string | null {
  const anyParty =
    distribution.governmentAuditor ||
    distribution.valuationDepartment ||
    distribution.engineeringOffice;
  if (!anyParty) {
    return "فعّل طرفاً واحداً على الأقل ثم اختر المسؤول من القائمة.";
  }
  if (distribution.governmentAuditor && !distribution.governmentAuditorId.trim()) {
    return "اختر المراجع الحكومي من القائمة.";
  }
  if (distribution.valuationDepartment) {
    if (!distribution.operationsCoordinatorId.trim()) {
      return "اختر منسق عمليات التقييم.";
    }
    if (!distribution.inspectorId.trim()) {
      return "اختر المعاين الميداني.";
    }
    if (!distribution.valuatorId.trim()) {
      return "اختر المقيم العقاري.";
    }
  }
  if (distribution.engineeringOffice) {
    if (!engineeringAvailable) {
      return "المكتب الهندسي غير متاح لهذا العقار وفق الشروط.";
    }
    if (!distribution.engineeringOfficeId.trim()) {
      return "اختر المكتب الهندسي من القائمة.";
    }
  }
  return null;
}

export function slotTaskTitle(
  poNumber: string,
  ordinal: number,
  total: number,
): string {
  return `تسجيل عقار ${ordinal} من ${total} — ${poNumber}`;
}

export function caseStudyTaskForProperty(
  poNumber: string,
  propertyId: string,
  list: WorkflowTask[],
): WorkflowTask | undefined {
  return list.find(
    (t) =>
      t.kind === "case-study-property" &&
      t.poNumber.trim() === poNumber.trim() &&
      t.propertyId === propertyId,
  );
}

/** Server-side slot sync from work orders. */
export async function syncTaskSlotsForPo(
  record: PoIntakeRecord,
): Promise<WorkflowTask[]> {
  await syncTasksFromPoRecords();
  const list = await loadWorkflowTasks();
  return poCaseTasks(list, record.poNumber.trim());
}

/** Link a property registered outside مهامي (e.g. PO → إضافة عقار) to the next empty slot. */
export async function linkNewPropertyToTaskSlot(
  record: PoIntakeRecord,
  property: PoPropertyIntake,
): Promise<WorkflowTask | null> {
  if (!property.id) return null;
  await syncTaskSlotsForPo(record);
  const list = await loadWorkflowTasks();
  const existing = caseStudyTaskForProperty(record.poNumber, property.id, list);
  if (existing) return existing;

  const tasks = poCaseTasks(list, record.poNumber);
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

export async function advanceTaskAfterEnfath(
  taskId: string,
  property: PoPropertyIntake,
): Promise<WorkflowTask | null> {
  const config = workOrdersApiConfig();
  if (!config || !property.id) return null;
  const result = await advanceWorkflowTaskAfterEnfath(config, taskId, {
    propertyId: property.id,
    identifierType: property.identifierType,
    bourseDataCompleted: Boolean(property.bourseDataCompleted),
    deedNumber: property.deedNumber,
  });
  if (!result.ok) return null;
  notifyTasksChanged();
  return dtoToTask(result.data);
}

export async function advanceTaskAfterBourse(
  taskId: string,
  property: PoPropertyIntake,
): Promise<WorkflowTask | null> {
  const config = workOrdersApiConfig();
  if (!config) return null;
  const result = await advanceWorkflowTaskAfterBourse(
    config,
    taskId,
    formatPropertyDeedDisplay(property),
  );
  if (!result.ok) return null;
  notifyTasksChanged();
  return dtoToTask(result.data);
}

/** After استعلام البورصة — move linked case-study task to توزيع المعاملات. */
export async function advanceTaskAfterBourseForProperty(
  poNumber: string,
  propertyId: string,
  property: PoPropertyIntake,
  tasks?: WorkflowTask[],
): Promise<WorkflowTask | null> {
  const list = tasks ?? (await loadWorkflowTasks());
  const task = caseStudyTaskForProperty(poNumber, propertyId, list);
  if (!task) return null;
  return advanceTaskAfterBourse(task.id, property);
}

function buildAssigneeNames(
  distribution: TaskDistributionDraft,
  staffUsers: StaffUser[] = [],
): Record<string, string> {
  const names: Record<string, string> = {};
  if (distribution.governmentAuditor) {
    names["government-review"] = assigneeLabel(
      getGovernmentAuditors(staffUsers),
      distribution.governmentAuditorId,
    );
  }
  if (distribution.valuationDepartment) {
    names["valuation-coordination"] = assigneeLabel(
      getValuationCoordinators(staffUsers),
      distribution.operationsCoordinatorId,
    );
    names["field-inspection"] = assigneeLabel(
      getFieldInspectors(staffUsers),
      distribution.inspectorId,
    );
    names["property-appraisal"] = assigneeLabel(
      getValuators(staffUsers),
      distribution.valuatorId,
    );
  }
  if (distribution.engineeringOffice) {
    names["engineering-survey"] = assigneeLabel(
      getEngineeringOffices(staffUsers),
      distribution.engineeringOfficeId,
    );
  }
  return names;
}

export async function confirmTaskDistribution(
  taskId: string,
  distribution: TaskDistributionDraft,
  deedNumber = "",
  staffUsers: StaffUser[] = [],
): Promise<{ parent: WorkflowTask | null; children: WorkflowTask[] }> {
  const config = workOrdersApiConfig();
  if (!config) return { parent: null, children: [] };

  const normalized = migrateDistribution(distribution, staffUsers);
  const result = await confirmWorkflowTaskDistribution(config, taskId, {
    distribution: distributionToDto(normalized)!,
    deedNumber,
    assigneeNames: buildAssigneeNames(normalized, staffUsers),
  });
  if (!result.ok || !result.data.parent) {
    return { parent: null, children: [] };
  }

  notifyTasksChanged();
  return {
    parent: dtoToTask(result.data.parent),
    children: result.data.children.map(dtoToTask),
  };
}

export async function escalateTaskForObstruction(
  poNumber: string,
  propertyId: string,
  reason: string,
  tasks?: WorkflowTask[],
): Promise<WorkflowTask | null> {
  const list = tasks ?? (await loadWorkflowTasks());
  const task = list.find(
    (t) =>
      t.kind === "case-study-property" &&
      t.poNumber === poNumber &&
      t.propertyId === propertyId &&
      t.status !== "completed",
  );
  if (!task) return null;

  const config = workOrdersApiConfig();
  if (!config) return null;
  const result = await patchWorkflowTask(config, task.id, {
    phase: "obstruction",
    obstructionPriorPhase: task.phase,
    assigneeRole: "section-supervisor",
    assigneeName: "مشرف دراسة الحالة",
    status: "blocked",
    obstructionReason: reason.trim(),
  });
  if (!result.ok) return null;
  notifyTasksChanged();
  return dtoToTask(result.data);
}

/** Pause all open work on a property — SLA timer keeps running elsewhere. */
export async function suspendWorkflowTasksForProperty(
  poNumber: string,
  propertyId: string,
  reason: string,
): Promise<void> {
  const n = poNumber.trim();
  const list = await loadWorkflowTasks();
  const related = list.filter(
    (t) =>
      t.poNumber.trim() === n &&
      t.propertyId === propertyId &&
      t.status !== "completed",
  );
  const config = workOrdersApiConfig();
  if (!config) return;
  const note = reason.trim() || "معاملة معلقة";
  for (const task of related) {
    await patchWorkflowTask(config, task.id, {
      status: "blocked",
      obstructionReason: note,
    });
  }
  notifyTasksChanged();
}

export async function resolveObstructionForProperty(
  poNumber: string,
  propertyId: string,
): Promise<WorkflowTask | null> {
  const list = await loadWorkflowTasks();
  const task = list.find(
    (t) =>
      t.kind === "case-study-property" &&
      t.poNumber === poNumber &&
      t.propertyId === propertyId &&
      t.phase === "obstruction",
  );
  if (!task) return null;
  return resolveTaskObstruction(task.id, task);
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

export function compareWorkflowTasks(
  a: WorkflowTask,
  b: WorkflowTask,
): number {
  const poCmp = a.poNumber.localeCompare(b.poNumber, undefined, {
    numeric: true,
  });
  if (poCmp !== 0) return poCmp;
  if (a.propertyOrdinal !== b.propertyOrdinal) {
    return a.propertyOrdinal - b.propertyOrdinal;
  }
  return a.createdAt.localeCompare(b.createdAt);
}

export function tasksForRole(
  role: RoleId,
  tasks: WorkflowTask[],
): WorkflowTask[] {
  if (isSuperAdmin(role)) return [...tasks].sort(compareWorkflowTasks);
  return tasks
    .filter((t) => t.assigneeRole === role)
    .sort(compareWorkflowTasks);
}

/** Party queues — match role and selected person from توزيع المعاملات. */
export function tasksForPartyAssignee(
  viewerRole: RoleId,
  tasks: WorkflowTask[],
  queueRole?: RoleId,
  viewerEmail?: string | null,
  staffUsers: StaffUser[] = [],
): WorkflowTask[] {
  if (isSuperAdmin(viewerRole) && !queueRole) {
    return [...tasks].sort(compareWorkflowTasks);
  }
  const role =
    isSuperAdmin(viewerRole) && queueRole ? queueRole : viewerRole;
  const account = partyAccountForViewer(role, viewerEmail, staffUsers);
  const expectedId =
    account?.assigneeId ?? getPrototypeRoleAssigneeId(staffUsers)[role];
  const expectedName = account?.name ?? ROLES[role]?.name;
  return tasks
    .filter((t) => t.assigneeRole === role)
    .filter((t) => {
      if (t.assigneeId && expectedId) return t.assigneeId === expectedId;
      if (expectedName) return t.assigneeName.trim() === expectedName.trim();
      return true;
    })
    .sort(compareWorkflowTasks);
}

export async function syncTasksFromPoRecords(): Promise<void> {
  const config = workOrdersApiConfig();
  if (!config) return;
  await syncWorkflowTasks(config);
  notifyTasksChanged();
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
  if (!distribution.governmentAuditor) {
    distribution.governmentAuditorId = "";
  }
  if (!distribution.valuationDepartment) {
    distribution.operationsCoordinatorId = "";
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
