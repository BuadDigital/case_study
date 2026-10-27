import {
  listInspectorFees,
  patchInspectorFee,
  resolveDiscountProposal,
  transitionInspectorFee,
  waivePartyFees,
  type InspectorFeeRowDto,
  type InspectorFeesSummaryDto,
  type InspectorFeeTransitionRequest,
  type ListInspectorFeesQuery,
  type PatchInspectorFeeRequest,
  type ResolveDiscountProposalRequest,
  type WaivePartyFeesRequest,
  type WaivePartyFeesResultDto,
} from "@platform/api-client";
import {
  apiErrorMessage,
  mutationFromApiResult,
  requireWorkOrdersApiConfig,
  unwrapApiResult,
  workOrdersApiConfig,
  type MutationResult,
} from "./work-orders-api-config";

type InspectorFeeMutationResult<T> = MutationResult<T>;

export async function loadInspectorFeesSummary(
  query: ListInspectorFeesQuery,
): Promise<InspectorFeesSummaryDto> {
  const config = requireWorkOrdersApiConfig();
  const result = await listInspectorFees(config, query);
  return unwrapApiResult(result, "تعذّر تحميل أتعاب المعاينين");
}

export async function saveInspectorFeePatch(
  workflowTaskId: string,
  body: PatchInspectorFeeRequest,
): Promise<InspectorFeeMutationResult<InspectorFeeRowDto>> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };

  const result = await patchInspectorFee(config, workflowTaskId, body);
  return mutationFromApiResult(result, "تعذّر حفظ أتعاب المعاين");
}

export async function runInspectorFeeTransition(
  workflowTaskId: string,
  body: InspectorFeeTransitionRequest,
): Promise<InspectorFeeMutationResult<InspectorFeeRowDto>> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };

  const result = await transitionInspectorFee(config, workflowTaskId, body);
  return mutationFromApiResult(result, "تعذّر تنفيذ إجراء الأتعاب");
}

/** Supervisor: approve / amend / waive the specialist's proposed discount on a fee line. */
export async function decideDiscountProposal(
  workflowTaskId: string,
  body: ResolveDiscountProposalRequest,
): Promise<InspectorFeeMutationResult<InspectorFeeRowDto>> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };

  const result = await resolveDiscountProposal(config, workflowTaskId, body);
  return mutationFromApiResult(result, "تعذّر حفظ القرار على الحسم المقترح");
}

/** Supervisor: cancel one party's whole fee on a transaction (full discount on every open line). */
export async function cancelPartyFeesOnTransaction(
  poNumber: string,
  body: WaivePartyFeesRequest,
): Promise<InspectorFeeMutationResult<WaivePartyFeesResultDto>> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };

  const result = await waivePartyFees(config, poNumber, body);
  return mutationFromApiResult(result, "تعذّر إلغاء أتعاب الطرف على المعاملة");
}
