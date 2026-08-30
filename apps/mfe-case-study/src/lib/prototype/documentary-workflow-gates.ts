import type { RoleId } from "@platform/types";
import { isSuperAdmin } from "@platform/app-shared/prototype/prototype-role-access";
import type { WorkflowTask } from "./tasks-storage";

export function roleBypassesDocumentaryGates(role: RoleId): boolean {
  return isSuperAdmin(role) || role === "section-supervisor";
}

/** Roles allowed to set location map URL (specialist / inspector / bypass). */
export function roleCanSetLocationMapUrl(role: RoleId): boolean {
  return (
    isSuperAdmin(role) ||
    role === "section-supervisor" ||
    role === "case-specialist" ||
    role === "field-inspector"
  );
}

/** Random = both plan number and plot number are missing. */
export function isInformalSettlement(
  planNumber: string | null | undefined,
  plotNumber: string | null | undefined,
): boolean {
  return !String(planNumber ?? "").trim() && !String(plotNumber ?? "").trim();
}

export function hasAnyPartyPhone(
  contacts: ReadonlyArray<{ phone?: string }> | null | undefined,
): boolean {
  if (!contacts?.length) return false;
  return contacts.some(
    (c) => (c.phone ?? "").replace(/\D/g, "").length >= 10,
  );
}

export function findSiblingInspectionTask(
  surveyTask: WorkflowTask,
  tasks: WorkflowTask[],
): WorkflowTask | null {
  if (!surveyTask.parentTaskId) return null;
  return (
    tasks.find(
      (t) =>
        t.parentTaskId === surveyTask.parentTaskId &&
        t.propertyId === surveyTask.propertyId &&
        t.kind === "field-inspection",
    ) ?? null
  );
}

export type DocumentaryGateState =
  | { ready: true }
  | { ready: false; reason: string };

export function surveyWorkGate(input: {
  role: RoleId;
  surveyTask: WorkflowTask;
  tasks: WorkflowTask[];
  hasActiveFailure: boolean;
  /**
   * Authoritative flag from server (engineering-survey submission DTO).
   * Prefer this over scanning `tasks` — EO lists hide sibling inspection tasks.
   */
  fieldInspectionCompleted?: boolean | null;
}): DocumentaryGateState {
  if (roleBypassesDocumentaryGates(input.role)) return { ready: true };
  if (input.hasActiveFailure) {
    return {
      ready: false,
      reason: "الرفع المساحي مجمّد بسبب تعذر نشط على العقار.",
    };
  }
  const inspectionCompleted =
    typeof input.fieldInspectionCompleted === "boolean"
      ? input.fieldInspectionCompleted
      : findSiblingInspectionTask(input.surveyTask, input.tasks)?.status ===
        "completed";
  if (!inspectionCompleted) {
    return {
      ready: false,
      reason: "لا يمكن بدء الرفع المساحي قبل اكتمال المعاينة الميدانية.",
    };
  }
  return { ready: true };
}

/** Field inspection may submit without a key; envelopes stay informational. */
export function inspectorKeySubmitGate(_input: {
  role: RoleId;
  vacantLand: boolean;
  keyAvailable: boolean;
}): DocumentaryGateState {
  return { ready: true };
}

export function declarationPhoneGate(input: {
  role: RoleId;
  hasPhone: boolean;
  /** Once true, clearing phone later must not re-lock. */
  phoneWasPresentAtDeclaration: boolean;
}): DocumentaryGateState {
  if (roleBypassesDocumentaryGates(input.role)) return { ready: true };
  if (input.phoneWasPresentAtDeclaration || input.hasPhone) {
    return { ready: true };
  }
  return {
    ready: false,
    reason:
      "لا يمكن توقيع إقرار العميل بدون وسيلة اتصال (جوال) لأحد الأطراف.",
  };
}
