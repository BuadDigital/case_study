import {
  getPoEnfazBilling,
  getPropertyEnfazRevenue,
  issuePoEnfazInvoice,
  collectPoEnfazInvoice,
  downloadPoEnfazInvoicePdf,
  listEnfazTracking,
  listEnfazAging,
  listReadyEnfazPoSummaries,
  listEnfazFollowups,
  addEnfazFollowup,
  setEnfazFinanceFlag,
  clearEnfazFinanceFlag,
  savePoEnfazBilling,
  type AddEnfazFollowupRequest,
  type CollectPoEnfazInvoiceRequest,
  type EnfazAgingReportDto,
  type EnfazFollowupDto,
  type PoEnfazBillingDto,
  type PropertyEnfazRevenueDto,
  type SavePoEnfazBillingRequest,
  type SetEnfazFinanceFlagRequest,
} from "@platform/api-client";
import { workOrdersApiConfig, apiErrorMessage } from "./work-orders-api-config";

export async function loadReadyEnfazPoSummaries() {
  const config = workOrdersApiConfig();
  if (!config) return [];
  const result = await listReadyEnfazPoSummaries(config);
  return result.ok ? result.data : [];
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

export async function loadEnfazAgingReport(): Promise<EnfazAgingReportDto> {
  const config = workOrdersApiConfig();
  if (!config) {
    return {
      asOfUtc: new Date().toISOString(),
      totalOutstandingSar: 0,
      openInvoiceCount: 0,
      buckets: [],
      invoices: [],
    };
  }
  const result = await listEnfazAging(config);
  if (!result.ok) {
    throw new Error(apiErrorMessage(result.kind, "تعذّر تحميل تقرير التقادم"));
  }
  return result.data;
}

export async function issueEnfazInvoice(poNumber: string) {
  const config = workOrdersApiConfig();
  if (!config) return null;
  const result = await issuePoEnfazInvoice(config, poNumber);
  return result.ok ? result.data : null;
}

export async function collectEnfazInvoice(
  poNumber: string,
  body: CollectPoEnfazInvoiceRequest,
): Promise<PoEnfazBillingDto | null> {
  const config = workOrdersApiConfig();
  if (!config) return null;
  const result = await collectPoEnfazInvoice(config, poNumber, body);
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
