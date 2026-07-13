import type { RoleId } from "@platform/types";
import { isSuperAdmin } from "@platform/app-shared/prototype/prototype-role-access";
import type { WorkflowTask } from "./tasks-storage";

export const DOCUMENTARY_SYSTEM_RAISER = "النظام";

export function roleBypassesDocumentaryGates(role: RoleId): boolean {
  return isSuperAdmin(role) || role === "section-supervisor";
}

/** Unlock informal via map URL — specialist or inspector (+ supervisor/CDO). EO waits. */
export function roleCanSetLocationMapUrl(role: RoleId): boolean {
  return (
    isSuperAdmin(role) ||
    role === "section-supervisor" ||
    role === "case-specialist" ||
    role === "field-inspector"
  );
}

/** عشوائي = غياب رقم المخطط ورقم القطعة معاً. */
export function isInformalSettlement(
  planNumber: string | null | undefined,
  plotNumber: string | null | undefined,
): boolean {
  return !String(planNumber ?? "").trim() && !String(plotNumber ?? "").trim();
}

export function hasLocationMapUrl(url: string | null | undefined): boolean {
  const value = String(url ?? "").trim();
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function informalAccessUnlocked(
  planNumber: string | null | undefined,
  plotNumber: string | null | undefined,
  locationMapUrl: string | null | undefined,
): boolean {
  if (!isInformalSettlement(planNumber, plotNumber)) return true;
  return hasLocationMapUrl(locationMapUrl);
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
  planNumber?: string | null;
  plotNumber?: string | null;
  locationMapUrl?: string | null;
}): DocumentaryGateState {
  if (roleBypassesDocumentaryGates(input.role)) return { ready: true };
  if (input.hasActiveFailure) {
    return {
      ready: false,
      reason: "الرفع المساحي مجمّد بسبب تعذر نشط على العقار.",
    };
  }
  const inspection = findSiblingInspectionTask(input.surveyTask, input.tasks);
  if (!inspection || inspection.status !== "completed") {
    return {
      ready: false,
      reason: "لا يمكن بدء الرفع المساحي قبل اكتمال المعاينة الميدانية.",
    };
  }
  if (
    !informalAccessUnlocked(
      input.planNumber,
      input.plotNumber,
      input.locationMapUrl,
    )
  ) {
    return {
      ready: false,
      reason:
        "العقار في منطقة عشوائية — يلزم رابط موقع (خريطة) من الأخصائي أو المعاين.",
    };
  }
  return { ready: true };
}

export function informalAccessGate(input: {
  role: RoleId;
  planNumber?: string | null;
  plotNumber?: string | null;
  locationMapUrl?: string | null;
}): DocumentaryGateState {
  if (roleBypassesDocumentaryGates(input.role)) return { ready: true };
  if (
    informalAccessUnlocked(
      input.planNumber,
      input.plotNumber,
      input.locationMapUrl,
    )
  ) {
    return { ready: true };
  }
  return {
    ready: false,
    reason: "العقار في منطقة عشوائية — يلزم رابط موقع (خريطة) قبل الوصول.",
  };
}

export function inspectorKeySubmitGate(input: {
  role: RoleId;
  vacantLand: boolean;
  keyAvailable: boolean;
}): DocumentaryGateState {
  if (roleBypassesDocumentaryGates(input.role) || input.vacantLand) {
    return { ready: true };
  }
  if (input.keyAvailable) return { ready: true };
  return {
    ready: false,
    reason:
      "لا يمكن إتمام المعاينة بدون استلام المفتاح (ما عدا الأرض الفضاء). سجّل تعذراً مع ملاحظة.",
  };
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

export function governmentReviewSubmitFieldErrors(input: {
  role: RoleId;
  deedNumber?: string | null;
  requestNumber?: string | null;
  city?: string | null;
  district?: string | null;
  circuit?: string | null;
  poNumber?: string | null;
  assignmentMandateNumber?: string | null;
  assignmentMandateDate?: string | null;
}): Record<string, string> {
  if (roleBypassesDocumentaryGates(input.role)) return {};
  const errors: Record<string, string> = {};
  if (!String(input.deedNumber ?? "").trim()) {
    errors.deedNumber = "رقم الصك مطلوب قبل تسليم المراجعة الحكومية.";
  }
  if (!String(input.requestNumber ?? "").trim()) {
    errors.requestNumber = "رقم الطلب مطلوب قبل تسليم المراجعة الحكومية.";
  }
  if (!String(input.city ?? "").trim()) {
    errors.city = "المدينة مطلوبة قبل تسليم المراجعة الحكومية.";
  }
  if (!String(input.district ?? "").trim()) {
    errors.district = "الحي مطلوب قبل تسليم المراجعة الحكومية.";
  }
  if (!String(input.circuit ?? "").trim()) {
    errors.circuit = "رقم الدائرة مطلوب قبل تسليم المراجعة الحكومية.";
  }
  if (!String(input.poNumber ?? "").trim()) {
    errors.poNumber = "رقم التعميد (PO) مطلوب قبل تسليم المراجعة الحكومية.";
  }
  if (!String(input.assignmentMandateNumber ?? "").trim()) {
    errors.assignmentMandateNumber =
      "رقم التكليف مطلوب قبل تسليم المراجعة الحكومية.";
  }
  if (!String(input.assignmentMandateDate ?? "").trim()) {
    errors.assignmentMandateDate =
      "تاريخ التكليف مطلوب قبل تسليم المراجعة الحكومية.";
  }
  return errors;
}
