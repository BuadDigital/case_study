import {
  getTransactionState,
  recordEnfazHandover,
  returnFromEnfaz,
  type EnfazReturnRequest,
  type TransactionStateDto,
} from "@platform/api-client";
import {
  apiErrorMessage,
  mutationFromApiResult,
  notifyWorkOrdersChanged,
  unwrapApiResult,
  workOrdersApiConfig,
  requireWorkOrdersApiConfig,
  type MutationResult,
} from "../work-orders-api-config";

export async function loadTransactionState(
  workOrderId: string,
  propertyId: string,
): Promise<TransactionStateDto> {
  const config = requireWorkOrdersApiConfig();
  return unwrapApiResult(
    await getTransactionState(config, workOrderId, propertyId),
    "تعذّر تحميل حالة المعاملة",
  );
}

/** «تسجيل الرفع على إنفاذ» — the specialist only; a refusal reads as the server's own Arabic reason. */
export async function confirmEnfazHandover(
  workOrderId: string,
  propertyId: string,
): Promise<MutationResult<TransactionStateDto>> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = mutationFromApiResult(
    await recordEnfazHandover(config, workOrderId, propertyId),
    "تعذّر تسجيل الرفع على إنفاذ",
  );
  if (result.ok) notifyWorkOrdersChanged();
  return result;
}

/** «إعادة من إنفاذ» — clears the handover stamp and reopens what the specialist chose. */
export async function returnPropertyFromEnfaz(
  workOrderId: string,
  propertyId: string,
  request: EnfazReturnRequest,
): Promise<MutationResult<TransactionStateDto>> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = mutationFromApiResult(
    await returnFromEnfaz(config, workOrderId, propertyId, request),
    "تعذّرت الإعادة من إنفاذ",
  );
  if (result.ok) notifyWorkOrdersChanged();
  return result;
}
