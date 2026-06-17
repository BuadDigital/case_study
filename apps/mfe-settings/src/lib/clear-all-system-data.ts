import { resetSystemData, type SystemResetResult } from "@platform/api-client";
import { resetPoIntakeDraftClientCache, TASKS_CHANGED_EVENT } from "@case-study/mfe";
import {
  notifyWorkOrdersChanged,
  workOrdersApiConfig,
} from "@platform/app-shared/prototype/work-orders-api-config";

const EVAL_SESSION_PREFIX = "eval";

const EMPTY_RESET: SystemResetResult = {
  workOrdersDeleted: 0,
  workflowTasksDeleted: 0,
  caseStudyFormsDeleted: 0,
  courtCatalogEntriesDeleted: 0,
  caseStudyInfoRolesConfigsDeleted: 0,
  propertyFailuresDeleted: 0,
  registeredUsersDeleted: 0,
  poIntakeDraftsDeleted: 0,
  attachmentsDeleted: 0,
  internalDelegationLetterSetsDeleted: 0,
  evaluatorRecallsDeleted: 0,
  fieldDictionaryConfigsDeleted: 0,
  failureTypesCatalogConfigsDeleted: 0,
  customAssignedScreensDeleted: 0,
  surveyOfficesDeleted: 0,
  valuationRequestsDeleted: 0,
  propertyKeyRecordsDeleted: 0,
  financialReportConfigsDeleted: 0,
};

/** Clear legacy eval* session keys. Operational data lives on the API. */
export function clearPrototypeSessionStorage(): void {
  if (typeof window === "undefined") return;

  const sessionKeys: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(EVAL_SESSION_PREFIX)) sessionKeys.push(key);
  }
  for (const key of sessionKeys) sessionStorage.removeItem(key);

  try {
    localStorage.removeItem("evalPoIntakeDraft");
  } catch {
    /* ignore */
  }

  resetPoIntakeDraftClientCache();
  window.dispatchEvent(new Event(TASKS_CHANGED_EVENT));
  notifyWorkOrdersChanged();
}

export type ClearAllSystemDataResult = {
  apiReset: boolean;
  sessionStorageCleared: boolean;
  errors: string[];
} & SystemResetResult;

/** Delete all operational + prototype config data on the API; clear prototype session storage. */
export async function clearAllSystemData(): Promise<ClearAllSystemDataResult> {
  const errors: string[] = [];
  let apiReset = false;
  let resetCounts: SystemResetResult = { ...EMPTY_RESET };

  const config = workOrdersApiConfig();
  if (config) {
    const result = await resetSystemData(config);
    if (result.ok) {
      apiReset = true;
      resetCounts = result.data;
    } else if (result.kind === "not_found") {
      errors.push(
        "مسح الخادم غير متاح — أعد تشغيل API بعد dotnet build (النقطة DELETE /api/system/data غير موجودة أو البيئة ليست Development)",
      );
    } else if (result.kind === "auth") {
      errors.push("لا يوجد جلسة صالحة — سجّل الدخول من جديد");
    } else if (result.kind === "forbidden") {
      errors.push(
        "صلاحية غير كافية على الخادم — سجّل الدخول بحساب يملك صلاحية manage-system-config (مثل CDO أو admin@local.dev)",
      );
    } else if (result.kind === "server") {
      errors.push(
        result.detail
          ? `خطأ في الخادم (${result.status ?? "?"}): ${result.detail}`
          : `خطأ في الخادم (${result.status ?? "server"}) — أعد تشغيل API: npm run dev:api`,
      );
    } else {
      errors.push(`تعذّر مسح الخادم (${result.kind})`);
    }
  } else {
    errors.push("لا يوجد جلسة — تم مسح التخزين المحلي فقط");
  }

  clearPrototypeSessionStorage();

  return {
    apiReset,
    sessionStorageCleared: typeof window !== "undefined",
    errors,
    ...resetCounts,
  };
}

/** @deprecated Use clearAllSystemData */
export const clearAllPoData = clearAllSystemData;

/** @deprecated Use clearPrototypeSessionStorage */
export const clearAllEvalBrowserStorage = clearPrototypeSessionStorage;

/** @deprecated Use clearPrototypeSessionStorage */
export const clearPoLocalStorage = clearPrototypeSessionStorage;
