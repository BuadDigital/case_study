import {
  getPoEnfazBilling,
  getPropertyEnfazRevenue,
  issuePoEnfazInvoice,
  collectPoEnfazInvoice,
  downloadPoEnfazInvoicePdf,
  listEnfazTracking,
  listReadyEnfazPoSummariesPage,
  listEnfazFollowups,
  addEnfazFollowup,
  setEnfazFinanceFlag,
  clearEnfazFinanceFlag,
  savePoEnfazBilling,
  markBillingReady,
  type TransactionStateDto,
  type AddEnfazFollowupRequest,
  type CollectPoEnfazInvoiceRequest,
  type EnfazFollowupDto,
  type EnfazReadyPoListQuery,
  type EnfazReadyPoSummaryDto,
  type PagedResultDto,
  type PoEnfazBillingDto,
  type PropertyEnfazRevenueDto,
  type SavePoEnfazBillingRequest,
  type SetEnfazFinanceFlagRequest,
} from "@platform/api-client";
import {
  workOrdersApiConfig,
  apiErrorMessage,
  mutationFromApiResult,
  notifyWorkOrdersChanged,
  requireWorkOrdersApiConfig,
  unwrapApiResult,
  type MutationResult,
} from "./work-orders-api-config";

/**
 * «تعليم جاهز للفوترة» — the accountant marks a handed-over deed once its financial data appeared on
 * Enfaz. A refusal reads as the server's own Arabic reason.
 *
 * How it works: builds the API config from the session (none → the «please sign in» error without any
 * request), calls `markBillingReady`, converts the result with `mutationFromApiResult`, and on success
 * fires `notifyWorkOrdersChanged` so lists and badges refresh.
 *
 * Edge cases: a failure returns `{ ok: false, error }` with the server's Arabic text when it sent one,
 * else the fallback «تعذّر تعليم الصك جاهزاً للفوترة»; nothing is notified on failure.
 */
export async function markDeedBillingReady(
  workOrderId: string,
  propertyId: string,
): Promise<MutationResult<TransactionStateDto>> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = mutationFromApiResult(
    await markBillingReady(config, workOrderId, propertyId),
    "تعذّر تعليم الصك جاهزاً للفوترة",
  );
  if (result.ok) notifyWorkOrdersChanged();
  return result;
}

/** One server page of Enfaz-ready work orders (pagination-contract §10.1). */
export async function loadReadyEnfazPoSummariesPage(
  query: EnfazReadyPoListQuery,
): Promise<PagedResultDto<EnfazReadyPoSummaryDto>> {
  const config = requireWorkOrdersApiConfig();
  const result = await listReadyEnfazPoSummariesPage(config, query);
  return unwrapApiResult(result, "تعذّر تحميل أوامر العمل الجاهزة للفوترة");
}

export async function loadPoEnfazBillingForQuery(
  poNumber: string,
): Promise<PoEnfazBillingDto> {
  const config = workOrdersApiConfig();
  if (!config) throw new Error(apiErrorMessage("auth"));
  const result = await getPoEnfazBilling(config, poNumber);
  if (!result.ok) {
    throw new Error(apiErrorMessage(result.kind, "تعذّر تحميل بيانات الفوترة"));
  }
  return result.data;
}

export async function savePoEnfazBillingData(
  poNumber: string,
  body: SavePoEnfazBillingRequest,
): Promise<PoEnfazBillingDto | null> {
  const config = workOrdersApiConfig();
  if (!config) return null;
  const result = await savePoEnfazBilling(config, poNumber, body);
  return result.ok ? result.data : null;
}

export async function loadEnfazTracking() {
  const config = workOrdersApiConfig();
  if (!config) return [];
  const result = await listEnfazTracking(config);
  return result.ok ? result.data : [];
}

export async function issueEnfazInvoice(
  poNumber: string,
  idempotencyKey?: string,
) {
  const config = workOrdersApiConfig();
  if (!config) return null;
  const result = await issuePoEnfazInvoice(config, poNumber, idempotencyKey);
  return result.ok ? result.data : null;
}

export async function collectEnfazInvoice(
  poNumber: string,
  body: CollectPoEnfazInvoiceRequest,
  idempotencyKey?: string,
): Promise<PoEnfazBillingDto | null> {
  const config = workOrdersApiConfig();
  if (!config) return null;
  const result = await collectPoEnfazInvoice(
    config,
    poNumber,
    body,
    idempotencyKey,
  );
  return result.ok ? result.data : null;
}

export async function downloadEnfazInvoicePdf(
  poNumber: string,
): Promise<boolean> {
  const config = workOrdersApiConfig();
  if (!config) return false;
  const result = await downloadPoEnfazInvoicePdf(config, poNumber);
  if (!result.ok) return false;

  const url = URL.createObjectURL(result.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `فاتورة-إنفاذ-${poNumber.trim()}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}

export async function openEnfazAttachment(
  attachmentId: string,
  fileName = "مرفق-إنفاذ",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { openPartyBillingAttachment } = await import(
    "./party-billing-statements-api"
  );
  return openPartyBillingAttachment(attachmentId, fileName);
}

export async function loadPropertyEnfazRevenue(
  poNumber: string,
  propertyId: string,
): Promise<PropertyEnfazRevenueDto> {
  const config = workOrdersApiConfig();
  if (!config) {
    return {
      hasEnfazRevenue: false,
      caseStudyFeeSar: null,
      surveyFeeSar: null,
      enfazFeeSar: null,
    };
  }
  const result = await getPropertyEnfazRevenue(config, poNumber, propertyId);
  return result.ok
    ? result.data
    : {
        hasEnfazRevenue: false,
        caseStudyFeeSar: null,
        surveyFeeSar: null,
        enfazFeeSar: null,
      };
}

export async function loadEnfazFollowups(
  poNumber: string,
): Promise<EnfazFollowupDto[]> {
  const config = workOrdersApiConfig();
  if (!config) return [];
  const result = await listEnfazFollowups(config, poNumber);
  return result.ok ? result.data : [];
}

export async function createEnfazFollowup(
  poNumber: string,
  body: AddEnfazFollowupRequest,
): Promise<EnfazFollowupDto | null> {
  const config = workOrdersApiConfig();
  if (!config) return null;
  const result = await addEnfazFollowup(config, poNumber, body);
  return result.ok ? result.data : null;
}

export async function markEnfazFinanceFlag(
  poNumber: string,
  body: SetEnfazFinanceFlagRequest,
): Promise<boolean> {
  const config = workOrdersApiConfig();
  if (!config) return false;
  const result = await setEnfazFinanceFlag(config, poNumber, body);
  return result.ok;
}

export async function unmarkEnfazFinanceFlag(
  poNumber: string,
  propertyId?: string | null,
): Promise<boolean> {
  const config = workOrdersApiConfig();
  if (!config) return false;
  const result = await clearEnfazFinanceFlag(config, poNumber, propertyId);
  return result.ok;
}
