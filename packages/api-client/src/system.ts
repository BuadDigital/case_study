import { getApiBase } from "./index";

export type SystemApiConfig = {
  baseUrl?: string;
  token: string;
};

export type SystemResetResult = {
  workOrdersDeleted: number;
  workflowTasksDeleted: number;
  caseStudyFormsDeleted: number;
  courtCatalogEntriesDeleted: number;
  caseStudyInfoRolesConfigsDeleted: number;
  propertyFailuresDeleted: number;
  registeredUsersDeleted: number;
  poIntakeDraftsDeleted: number;
  attachmentsDeleted: number;
  internalDelegationLetterSetsDeleted: number;
  evaluatorRecallsDeleted: number;
  fieldDictionaryConfigsDeleted: number;
  failureTypesCatalogConfigsDeleted: number;
  customAssignedScreensDeleted: number;
  surveyOfficesDeleted: number;
  valuationRequestsDeleted: number;
  propertyKeyRecordsDeleted: number;
  financialReportConfigsDeleted: number;
};

export type ResetSystemDataResult =
  | { ok: true; data: SystemResetResult }
  | {
      ok: false;
      kind: "auth" | "forbidden" | "network" | "server" | "not_found";
      status?: number;
      detail?: string;
    };

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
  };
}

function mapResetResult(data: Record<string, number | undefined>): SystemResetResult {
  return {
    workOrdersDeleted: data.workOrdersDeleted ?? 0,
    workflowTasksDeleted: data.workflowTasksDeleted ?? 0,
    caseStudyFormsDeleted: data.caseStudyFormsDeleted ?? 0,
    courtCatalogEntriesDeleted: data.courtCatalogEntriesDeleted ?? 0,
    caseStudyInfoRolesConfigsDeleted: data.caseStudyInfoRolesConfigsDeleted ?? 0,
    propertyFailuresDeleted: data.propertyFailuresDeleted ?? 0,
    registeredUsersDeleted: data.registeredUsersDeleted ?? 0,
    poIntakeDraftsDeleted: data.poIntakeDraftsDeleted ?? 0,
    attachmentsDeleted: data.attachmentsDeleted ?? 0,
    internalDelegationLetterSetsDeleted:
      data.internalDelegationLetterSetsDeleted ?? 0,
    evaluatorRecallsDeleted: data.evaluatorRecallsDeleted ?? 0,
    fieldDictionaryConfigsDeleted: data.fieldDictionaryConfigsDeleted ?? 0,
    failureTypesCatalogConfigsDeleted:
      data.failureTypesCatalogConfigsDeleted ?? 0,
    customAssignedScreensDeleted: data.customAssignedScreensDeleted ?? 0,
    surveyOfficesDeleted: data.surveyOfficesDeleted ?? 0,
    valuationRequestsDeleted: data.valuationRequestsDeleted ?? 0,
    propertyKeyRecordsDeleted: data.propertyKeyRecordsDeleted ?? 0,
    financialReportConfigsDeleted: data.financialReportConfigsDeleted ?? 0,
  };
}

export async function resetSystemData(
  config: SystemApiConfig,
): Promise<ResetSystemDataResult> {
  const base = config.baseUrl ?? getApiBase();
  try {
    const res = await fetch(`${base}/api/system/data`, {
      method: "DELETE",
      headers: headers(config.token),
    });
    if (res.status === 401) return { ok: false, kind: "auth", status: 401 };
    if (res.status === 403) return { ok: false, kind: "forbidden", status: 403 };
    if (res.status === 404) return { ok: false, kind: "not_found", status: 404 };
    if (!res.ok) {
      let detail: string | undefined;
      try {
        const body = (await res.json()) as { title?: string; detail?: string };
        detail = body.detail ?? body.title;
      } catch {
        try {
          detail = (await res.text()).slice(0, 200) || undefined;
        } catch {
          detail = undefined;
        }
      }
      return { ok: false, kind: "server", status: res.status, detail };
    }
    const data = (await res.json()) as Record<string, number | undefined>;
    return { ok: true, data: mapResetResult(data) };
  } catch {
    return { ok: false, kind: "network" };
  }
}
