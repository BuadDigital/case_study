import {
  approveFailure as apiApproveFailure,
  createFailure as apiCreateFailure,
  deleteFailuresForPo as apiDeleteFailuresForPo,
  dtoToFailureRecord,
  listFailures,
  reportBourseObstruction as apiReportBourseObstruction,
  resolveFailure as apiResolveFailure,
  returnFailure as apiReturnFailure,
  submitFailureForReview as apiSubmitFailureForReview,
  suspendFailure as apiSuspendFailure,
  upgradeFailureToInternal as apiUpgradeFailureToInternal,
  type FailureRecordDto,
  type FailuresApiConfig,
} from "@platform/api-client";
import {
  notifyWorkOrdersChanged,
  workOrdersApiConfig,
  apiErrorMessage,
} from "@platform/app-shared/prototype/work-orders-api-config";
import { notifyTasksChanged } from "@case-study/mfe/lib/prototype/tasks-storage";
import {
  getCachedFailuresList,
  getCachedPropertyFailure,
  removeCachedFailuresForPo,
  setCachedFailuresList,
  upsertCachedFailure,
} from "./failures-cache";
import { notifyFailuresChanged } from "./failures-events";
import type {
  BourseObstructionInput,
  CreateFailureInput,
  FailureRecord,
  FailureSeverity,
  FailureStatus,
  ResolveFailureInput,
} from "./failures-types";

export type { FailuresApiConfig };

export function failuresApiConfig(): FailuresApiConfig | null {
  return workOrdersApiConfig();
}

function requireFailuresApi(): FailuresApiConfig {
  const config = failuresApiConfig();
  if (!config) {
    throw new Error("يجب تسجيل الدخول للوصول إلى التعذرات");
  }
  return config;
}

function mapDto(dto: FailureRecordDto): FailureRecord {
  const raw = dtoToFailureRecord(dto);
  return {
    ...raw,
    severity: raw.severity as FailureSeverity,
    status: raw.status as FailureStatus,
  };
}

function notifyDownstreamChanges(): void {
  notifyFailuresChanged();
  notifyWorkOrdersChanged();
  notifyTasksChanged();
}

function applyMutation(record: FailureRecord): FailureRecord {
  upsertCachedFailure(record);
  notifyDownstreamChanges();
  return record;
}

export async function loadFailuresFromBackend(): Promise<FailureRecord[]> {
  const config = failuresApiConfig();
  if (!config) return [];

  const result = await listFailures(config);
  if (result.ok) {
    const mapped = result.data.map(mapDto);
    setCachedFailuresList(mapped);
    return mapped;
  }

  const cached = getCachedFailuresList();
  if (cached.length > 0) return cached;

  return [];
}

/** React Query loader — surfaces API failures. */
export async function loadFailuresForQuery(): Promise<FailureRecord[]> {
  const config = failuresApiConfig();
  if (!config) {
    throw new Error("يجب تسجيل الدخول للوصول إلى التعذرات");
  }

  const result = await listFailures(config);
  if (result.ok) {
    const mapped = result.data.map(mapDto);
    setCachedFailuresList(mapped);
    return mapped;
  }

  throw new Error(apiErrorMessage(result.kind, "تعذّر تحميل التعذرات"));
}

export function getPropertyFailureFromCache(
  poNumber: string,
  propertyId: string,
): FailureRecord | null {
  if (!failuresApiConfig()) return null;
  return getCachedPropertyFailure(poNumber, propertyId);
}

export async function createFailureAsync(
  input: CreateFailureInput,
): Promise<FailureRecord> {
  const config = requireFailuresApi();

  const result = await apiCreateFailure(config, {
    poNumber: input.poNumber,
    propertyId: input.propertyId,
    deedNumber: input.deedNumber,
    problemTypeId: input.problemTypeId,
    severity: input.severity,
    raisedByRole: input.raisedByRole,
    title: input.title,
    internalNote: input.internalNote,
    specialist: input.specialist,
  });
  if (!result.ok) {
    throw new Error(`createFailure failed: ${result.kind}`);
  }
  return applyMutation(mapDto(result.data));
}

export async function reportBourseObstructionAsync(
  input: BourseObstructionInput,
): Promise<FailureRecord> {
  const config = requireFailuresApi();

  const result = await apiReportBourseObstruction(config, input);
  if (!result.ok) {
    throw new Error(`reportBourseObstruction failed: ${result.kind}`);
  }
  return applyMutation(mapDto(result.data));
}

export type FailureMutationResult =
  | { ok: true; data: FailureRecord }
  | { ok: false; error: string };

async function mutateFailure(
  id: string,
  apiCall: (
    config: FailuresApiConfig,
    failureId: string,
  ) => Promise<
    | { ok: true; data: FailureRecordDto }
    | { ok: false; kind: string }
  >,
): Promise<FailureMutationResult> {
  const config = requireFailuresApi();
  const result = await apiCall(config, id);
  if (!result.ok) {
    return { ok: false, error: apiErrorMessage(result.kind) };
  }
  return { ok: true, data: applyMutation(mapDto(result.data)) };
}

export async function upgradeFailureToInternalAsync(
  id: string,
): Promise<FailureMutationResult> {
  return mutateFailure(id, (config, failureId) =>
    apiUpgradeFailureToInternal(config, failureId),
  );
}

export async function submitFailureForReviewAsync(
  id: string,
): Promise<FailureMutationResult> {
  return mutateFailure(id, (config, failureId) =>
    apiSubmitFailureForReview(config, failureId),
  );
}

export async function suspendFailureAsync(
  id: string,
  note: string,
): Promise<FailureMutationResult> {
  const config = requireFailuresApi();
  const result = await apiSuspendFailure(config, id, note);
  if (!result.ok) {
    return { ok: false, error: apiErrorMessage(result.kind) };
  }
  return { ok: true, data: applyMutation(mapDto(result.data)) };
}

export async function resolveFailureAsync(
  id: string,
  input: ResolveFailureInput,
): Promise<FailureMutationResult> {
  const config = requireFailuresApi();
  const result = await apiResolveFailure(config, id, input);
  if (!result.ok) {
    return { ok: false, error: apiErrorMessage(result.kind) };
  }
  return { ok: true, data: applyMutation(mapDto(result.data)) };
}

export async function approveFailureAsync(
  id: string,
  finalNote: string,
): Promise<FailureMutationResult> {
  const config = requireFailuresApi();
  const result = await apiApproveFailure(config, id, finalNote);
  if (!result.ok) {
    return { ok: false, error: apiErrorMessage(result.kind) };
  }
  return { ok: true, data: applyMutation(mapDto(result.data)) };
}

export async function returnFailureAsync(
  id: string,
  finalNote: string,
): Promise<FailureMutationResult> {
  const config = requireFailuresApi();
  const result = await apiReturnFailure(config, id, finalNote);
  if (!result.ok) {
    return { ok: false, error: apiErrorMessage(result.kind) };
  }
  return { ok: true, data: applyMutation(mapDto(result.data)) };
}

export async function deleteFailuresForPoAsync(
  poNumber: string,
): Promise<boolean> {
  const config = requireFailuresApi();
  const result = await apiDeleteFailuresForPo(config, poNumber);
  if (!result.ok) return false;
  removeCachedFailuresForPo(poNumber);
  notifyFailuresChanged();
  return true;
}

