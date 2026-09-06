import {
  closePartyBillingStatement,
  createPartyBillingStatement,
  createMonthVendorStatements,
  deferPartyBillingLines,
  downloadAttachmentBlob,
  getPartyBillingStatement,
  issuePartyBillingStatement,
  listPartyBillingReadyLines,
  listPartyBillingReadyLinesPage,
  listPartyBillingStatements,
  listPartyBillingStatementsPage,
  matchVendorInvoice,
  rejectVendorInvoice,
  cancelPartyBillingStatement,
  submitVendorInvoice,
  uploadAttachment,
  type CancelPartyBillingStatementRequest,
  type ClosePartyBillingStatementRequest,
  type CreatePartyBillingStatementRequest,
  type DeferPartyBillingLinesRequest,
  type PagedResultDto,
  type PartyBillingReadyLineDto,
  type PartyBillingReadyLineListQuery,
  type PartyBillingStatementDto,
  type PartyBillingStatementListQuery,
  type RejectVendorInvoiceRequest,
  type SubmitVendorInvoiceRequest,
} from "@platform/api-client";
import { prototypeModulesApiConfig } from "./modules-api-config";
import {
  workOrdersApiConfig,
  apiErrorMessage,
  requireWorkOrdersApiConfig,
  resolveApiError,
  unwrapApiResult,
} from "./work-orders-api-config";
import { fileToBase64 } from "@platform/app-shared/media/file-encoding";

/** Attachments scope for transfer-receipt files on party billing close-out. */
export const ENG_BILLING_TRANSFER_RECEIPT_SCOPE =
  "eng-billing-transfer-receipt";

export const PARTY_BILLING_VENDOR_INVOICE_SCOPE = "party-billing-vendor-invoice";

export async function loadPartyBillingReadyLines(
  assigneeId?: string,
): Promise<PartyBillingReadyLineDto[]> {
  const config = workOrdersApiConfig();
  if (!config) return [];
  const result = await listPartyBillingReadyLines(config, assigneeId);
  return result.ok ? result.data : [];
}

export async function loadPartyBillingStatements(query?: {
  assigneeId?: string;
  status?: string;
  issuedOrLaterOnly?: boolean;
}): Promise<PartyBillingStatementDto[]> {
  const config = workOrdersApiConfig();
  if (!config) return [];
  const result = await listPartyBillingStatements(config, query ?? {});
  return result.ok ? result.data : [];
}

/** One server page of statements (pagination-contract §9.1); throws so React Query shows the error. */
export async function loadPartyBillingStatementsPage(
  query: PartyBillingStatementListQuery,
): Promise<PagedResultDto<PartyBillingStatementDto>> {
  const config = requireWorkOrdersApiConfig();
  const result = await listPartyBillingStatementsPage(config, query);
  return unwrapApiResult(result, "تعذّر تحميل مسيرات وأوامر الصرف");
}

/** One server page of ready dues (pagination-contract §9.2). */
export async function loadPartyBillingReadyLinesPage(
  query: PartyBillingReadyLineListQuery,
): Promise<PagedResultDto<PartyBillingReadyLineDto>> {
  const config = requireWorkOrdersApiConfig();
  const result = await listPartyBillingReadyLinesPage(config, query);
  return unwrapApiResult(result, "تعذّر تحميل المستحقات");
}

/** One statement by id; null when it does not exist or the actor may not see it. */
export async function loadPartyBillingStatement(
  statementId: string,
): Promise<PartyBillingStatementDto | null> {
  const config = workOrdersApiConfig();
  if (!config) return null;
  const result = await getPartyBillingStatement(config, statementId);
  if (!result.ok) {
    if (result.kind === "not_found") return null;
    throw new Error(apiErrorMessage(result.kind, "تعذّر تحميل المسير"));
  }
  return result.data;
}

export async function runCreatePartyBillingStatement(
  body: CreatePartyBillingStatementRequest,
): Promise<
  | { ok: true; statement: PartyBillingStatementDto; deferredCount: number }
  | { ok: false; error: string }
> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await createPartyBillingStatement(config, body);
  if (!result.ok) {
    return {
      ok: false,
      error:
        ("message" in result && result.message) ||
        apiErrorMessage(result.kind, "تعذّر إنشاء المسير"),
    };
  }
  if (result.data.error || !result.data.statement) {
    return {
      ok: false,
      error: result.data.error ?? "تعذّر إنشاء المسير",
    };
  }
  return {
    ok: true,
    statement: result.data.statement,
    deferredCount: result.data.deferredLines.length,
  };
}

export async function runCreateMonthVendorStatements(): Promise<
  | {
      ok: true;
      created: number;
      linesIncluded: number;
      error: string | null;
    }
  | { ok: false; error: string }
> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await createMonthVendorStatements(config);
  if (!result.ok) {
    return {
      ok: false,
      error:
        ("message" in result && result.message) ||
        apiErrorMessage(result.kind, "تعذّر إنشاء مسيرات الشهر"),
    };
  }
  if (result.data.created.length === 0 && result.data.error) {
    return { ok: false, error: result.data.error };
  }
  return {
    ok: true,
    created: result.data.created.length,
    linesIncluded: result.data.linesIncluded,
    error: result.data.error ?? null,
  };
}

export async function runIssuePartyBillingStatement(
  statementId: string,
): Promise<
  { ok: true; statement: PartyBillingStatementDto } | { ok: false; error: string }
> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await issuePartyBillingStatement(config, statementId);
  if (!result.ok) {
    return {
      ok: false,
      error:
        ("message" in result && result.message) ||
        apiErrorMessage(result.kind, "تعذّر إرسال المسير"),
    };
  }
  return { ok: true, statement: result.data };
}

export async function runSubmitVendorInvoice(
  statementId: string,
  body: SubmitVendorInvoiceRequest,
): Promise<
  { ok: true; statement: PartyBillingStatementDto } | { ok: false; error: string }
> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await submitVendorInvoice(config, statementId, body);
  if (!result.ok) {
    return {
      ok: false,
      error:
        ("message" in result && result.message) ||
        apiErrorMessage(result.kind, "تعذّر رفع فاتورة المورّد"),
    };
  }
  return { ok: true, statement: result.data };
}

export async function runMatchVendorInvoice(
  statementId: string,
): Promise<
  { ok: true; statement: PartyBillingStatementDto } | { ok: false; error: string }
> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await matchVendorInvoice(config, statementId);
  if (!result.ok) {
    return {
      ok: false,
      error:
        ("message" in result && result.message) ||
        apiErrorMessage(result.kind, "تعذّر إقرار المطابقة"),
    };
  }
  return { ok: true, statement: result.data };
}

export async function runRejectVendorInvoice(
  statementId: string,
  body: RejectVendorInvoiceRequest,
): Promise<
  { ok: true; statement: PartyBillingStatementDto } | { ok: false; error: string }
> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await rejectVendorInvoice(config, statementId, body);
  if (!result.ok) {
    return {
      ok: false,
      error:
        ("message" in result && result.message) ||
        apiErrorMessage(result.kind, "تعذّر إعادة الفاتورة"),
    };
  }
  return { ok: true, statement: result.data };
}

export async function runCancelPartyBillingStatement(
  statementId: string,
  body: CancelPartyBillingStatementRequest,
): Promise<
  { ok: true; statement: PartyBillingStatementDto } | { ok: false; error: string }
> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await cancelPartyBillingStatement(config, statementId, body);
  if (!result.ok) {
    return {
      ok: false,
      error:
        ("message" in result && result.message) ||
        apiErrorMessage(result.kind, "تعذّر إلغاء المستند"),
    };
  }
  return { ok: true, statement: result.data };
}

export async function runClosePartyBillingStatement(
  statementId: string,
  body: ClosePartyBillingStatementRequest,
  idempotencyKey?: string,
): Promise<
  { ok: true; statement: PartyBillingStatementDto } | { ok: false; error: string }
> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await closePartyBillingStatement(
    config,
    statementId,
    body,
    idempotencyKey,
  );
  if (!result.ok) {
    return {
      ok: false,
      error:
        ("message" in result && result.message) ||
        apiErrorMessage(result.kind, "تعذّر توثيق الصرف"),
    };
  }
  return { ok: true, statement: result.data };
}

export async function runDeferPartyBillingLines(
  body: DeferPartyBillingLinesRequest,
): Promise<
  | { ok: true; deferredCount: number; failedCount: number }
  | { ok: false; error: string }
> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await deferPartyBillingLines(config, body);
  if (!result.ok) {
    return {
      ok: false,
      error: apiErrorMessage(result.kind, "تعذّر ترحيل البنود"),
    };
  }
  return {
    ok: true,
    deferredCount: result.data.deferred.length,
    failedCount: result.data.failed.length,
  };
}

export async function uploadPartyBillingTransferReceipt(
  statementId: string,
  file: File,
): Promise<
  | { ok: true; id: string; fileName: string }
  | { ok: false; error: string }
> {
  const config = prototypeModulesApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };

  const upload = await uploadAttachment(config, {
    scope: ENG_BILLING_TRANSFER_RECEIPT_SCOPE,
    scopeKey: statementId.trim() || "draft",
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
    contentBase64: await fileToBase64(file),
  });

  if (!upload.ok) {
    return {
      ok: false,
      error: resolveApiError(upload.kind, undefined, "تعذّر رفع إيصال التحويل"),
    };
  }

  return {
    ok: true,
    id: upload.data.id,
    fileName: upload.data.fileName,
  };
}

export async function uploadPartyBillingVendorInvoice(
  statementId: string,
  file: File,
): Promise<
  | { ok: true; id: string; fileName: string }
  | { ok: false; error: string }
> {
  const config = prototypeModulesApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };

  const upload = await uploadAttachment(config, {
    scope: PARTY_BILLING_VENDOR_INVOICE_SCOPE,
    scopeKey: statementId.trim() || "draft",
    fileName: file.name,
    contentType: file.type || "application/pdf",
    contentBase64: await fileToBase64(file),
  });

  if (!upload.ok) {
    return {
      ok: false,
      error: resolveApiError(upload.kind, undefined, "تعذّر رفع فاتورة المورّد"),
    };
  }

  return {
    ok: true,
    id: upload.data.id,
    fileName: upload.data.fileName,
  };
}

export async function openPartyBillingAttachment(
  attachmentId: string,
  fileName = "مرفق-مالي",
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = attachmentId.trim();
  if (!id) return { ok: false, error: "لا يوجد مرفق" };

  const config = prototypeModulesApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };

  const result = await downloadAttachmentBlob(config, id);
  if (!result.ok) {
    return {
      ok: false,
      error: resolveApiError(result.kind, undefined, "تعذّر فتح المرفق"),
    };
  }

  const blobUrl = URL.createObjectURL(result.data);
  const opened = window.open(blobUrl, "_blank", "noopener,noreferrer");
  if (!opened) {
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  return { ok: true };
}
