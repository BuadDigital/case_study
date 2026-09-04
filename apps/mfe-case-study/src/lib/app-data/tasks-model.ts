import type { RoleId } from "@platform/types";
import type { WorkflowTaskDto } from "@platform/api-client";
import type {
  AssignmentType,
  PoPropertyIntake,
} from "./po-intake-data";
import {
  propertyHasRegisteredTitle,
  propertyRequiresSurvey,
} from "./po-intake-data";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import {
  assigneeLabel,
  getCaseSpecialists,
  getEngineeringOffices,
  getFieldInspectors,
  getValuators,
} from "./distribution-parties";

export type {
  AssignmentType as WorkflowAssignmentType,
  CaseStudyTaskPhase,
  TaskDistributionDraft,
  WorkflowTask,
  WorkflowTaskKind,
  WorkflowTaskStatus,
} from "@platform/app-shared/workflow/task-types";
export {
  TASKS_CHANGED_EVENT,
  TASKS_STORAGE_KEY,
  notifyTasksChanged,
} from "@platform/app-shared/workflow/task-types";
import type {
  CaseStudyTaskPhase,
  TaskDistributionDraft,
  WorkflowTask,
  WorkflowTaskKind,
  WorkflowTaskStatus,
} from "@platform/app-shared/workflow/task-types";

type LegacyDistribution = {
  fieldInspector?: boolean;
  governmentReviewer?: boolean;
  engineeringOffice?: boolean;
  fieldInspectorRecommendedVisit?: boolean;
  operationsCoordinatorId?: string;
  caseSpecialist?: boolean;
  caseSpecialistId?: string;
};

export function migrateDistribution(
  raw: TaskDistributionDraft | LegacyDistribution | undefined,
  staffUsers: StaffUser[] = [],
): TaskDistributionDraft {
  const base = defaultDistribution();
  let migrated: TaskDistributionDraft;
  if (!raw) {
    migrated = base;
  } else if ("valuationDepartment" in raw || "inspectorId" in raw) {
    const full = raw as TaskDistributionDraft;
    migrated = {
      ...base,
      valuationDepartment: full.valuationDepartment,
      inspectorId: full.inspectorId,
      valuatorId: full.valuatorId,
      engineeringOffice: full.engineeringOffice,
      engineeringOfficeId: full.engineeringOfficeId,
      caseSpecialist: full.caseSpecialist ?? false,
      caseSpecialistId: full.caseSpecialistId ?? "",
    };
  } else {
    const legacy = raw as LegacyDistribution;
    migrated = {
      ...base,
      valuationDepartment: legacy.fieldInspector ?? false,
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
      caseSpecialist: legacy.caseSpecialist ?? false,
      caseSpecialistId: legacy.caseSpecialistId ?? "",
    };
  }

  // Government reviewer is not part of transaction distribution (operations tasks).
  return migrated;
}

export function dtoToTask(dto: WorkflowTaskDto): WorkflowTask {
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
    fieldInspectionCompleted:
      typeof dto.fieldInspectionCompleted === "boolean"
        ? dto.fieldInspectionCompleted
        : undefined,
    fieldInspectionAccepted:
      typeof dto.fieldInspectionAccepted === "boolean"
        ? dto.fieldInspectionAccepted
        : undefined,
    fieldInspectionTaskId: dto.fieldInspectionTaskId?.trim() || undefined,
    // The five PO-record columns the server joins onto every row
    // (pagination-contract §2) — absent-as-null becomes absent-as-undefined.
    deedNumber: dto.deedNumber?.trim() || undefined,
    city: dto.city?.trim() || undefined,
    district: dto.district?.trim() || undefined,
    propertyType: dto.propertyType?.trim() || undefined,
    classification: dto.classification?.trim() || undefined,
  };
}

export function distributionToDto(
  distribution: TaskDistributionDraft,
): WorkflowTaskDto["distribution"] {
  return {
    governmentAuditor: false,
    governmentAuditorId: "",
    valuationDepartment: distribution.valuationDepartment,
    operationsCoordinatorId: "",
    inspectorId: distribution.inspectorId,
    valuatorId: distribution.valuatorId,
    engineeringOffice: distribution.engineeringOffice,
    engineeringOfficeId: distribution.engineeringOfficeId,
    caseSpecialist: distribution.caseSpecialist,
    caseSpecialistId: distribution.caseSpecialistId,
  };
}

export type SyncTasksResult = { ok: true } | { ok: false; error: string };

export function taskKindLabel(kind: WorkflowTaskKind | string): string {
  if (kind === "case-study-property") return "دراسة حالة — عقار";
  if (kind === "field-inspection") return "معاينة ميدانية";
  if (kind === "government-review") return "مراجعة حكومية";
  if (kind === "property-appraisal") return "تقييم عقاري";
  if (kind === "engineering-survey") return "رفع مساحي — مكتب هندسي";
  return "مهمة";
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
  if (status === "open") return "قيد الإجراء";
  if (status === "blocked") return "موقوفة";
  if (status === "cancelled") return "ملغاة";
  return "مكتملة";
}

export function taskDisplayPropertyLabel(task: WorkflowTask): string {
  const parts = task.title
    .split(" — ")
    .map((p) => p.trim())
    .filter(Boolean);
  if (task.parentTaskId && parts.length >= 2) {
    return parts[parts.length - 1]!;
  }
  if (task.propertyId) {
    const part = parts[0];
    return part || `عقار ${task.propertyOrdinal}`;
  }
  return `خانة ${task.propertyOrdinal}`;
}

export function engineeringOfficeAvailable(
  property: PoPropertyIntake,
  hasPriorSurvey: boolean,
): boolean {
  if (!propertyRequiresSurvey(property)) return false;
  if (hasPriorSurvey) return false;
  return true;
}

export function engineeringOfficeUnavailableReason(
  property: PoPropertyIntake,
  hasPriorSurvey: boolean,
): string | null {
  if (!propertyRequiresSurvey(property)) {
    if (propertyHasRegisteredTitle(property)) {
      return "المكتب الهندسي غير متاح: المعاملة لها سجل عيني ولا تتطلب رفعاً مساحياً.";
    }
    return "المكتب الهندسي غير متاح: تصنيف «وحدة داخل مبنى» لا يتطلب رفعاً مساحياً.";
  }
  if (hasPriorSurvey) {
    return "يوجد رفع مساحي سابق لنفس الصك — لا حاجة لمكتب هندسي.";
  }
  return null;
}

export function defaultDistribution(): TaskDistributionDraft {
  return {
    governmentAuditor: false,
    governmentAuditorId: "",
    valuationDepartment: true,
    inspectorId: "",
    valuatorId: "",
    engineeringOffice: false,
    engineeringOfficeId: "",
    caseSpecialist: true,
    caseSpecialistId: "",
  };
}

export function distributionValidationError(
  distribution: TaskDistributionDraft,
  engineeringAvailable: boolean,
  propertyBasics?: {
    deedNumber?: string | null;
    requestNumber?: string | null;
    city?: string | null;
    district?: string | null;
    circuit?: string | null;
    poNumber?: string | null;
    assignmentMandateNumber?: string | null;
    assignmentMandateDate?: string | null;
  },
): string | null {
  if (!distribution.caseSpecialistId.trim()) {
    return "اختر أخصائي دراسة الحالة.";
  }
  if (!distribution.inspectorId.trim()) {
    return "اختر المعاين الميداني.";
  }
  if (!distribution.valuatorId.trim()) {
    return "اختر المقيم العقاري.";
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

/** Server-side slot sync from work orders. */
export type SyncTaskSlotsResult =
  | { ok: true; tasks: WorkflowTask[] }
  | { ok: false; error: string };

export type AdvanceTaskResult =
  | { ok: true; task: WorkflowTask }
  | { ok: false; error: string };

export type RevertTaskPhaseResult =
  | { ok: true; task: WorkflowTask }
  | { ok: false; error: string };

export type ReopenCompletedTaskResult =
  | { ok: true; task: WorkflowTask }
  | { ok: false; error: string };

export type RedistributePartiesResult =
  | { ok: true; task: WorkflowTask }
  | { ok: false; error: string };

/** Sub-task assignee display names derived from a confirmed distribution. */
export function buildAssigneeNames(
  distribution: TaskDistributionDraft,
  staffUsers: StaffUser[] = [],
): Record<string, string> {
  const names: Record<string, string> = {};
  if (distribution.valuationDepartment) {
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
  if (distribution.caseSpecialist) {
    const label = assigneeLabel(
      getCaseSpecialists(staffUsers),
      distribution.caseSpecialistId,
    );
    names["case-study-property"] = label;
    names["case-specialist"] = label;
  }
  return names;
}

/** Party queues — match role and selected person from transaction distribution. */
export function partyAssigneeIdFromDistribution(
  kind: WorkflowTaskKind,
  distribution: TaskDistributionDraft,
): string {
  switch (kind) {
    case "government-review":
      // Not selected via transaction distribution — operations tasks own this.
      return "";
    case "field-inspection":
      return distribution.inspectorId.trim();
    case "property-appraisal":
      return distribution.valuatorId.trim();
    case "engineering-survey":
      return distribution.engineeringOfficeId.trim();
    default:
      return "";
  }
}
