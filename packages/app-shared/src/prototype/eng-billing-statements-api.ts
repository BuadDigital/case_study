import {
  closeEngBillingStatement,
  createEngBillingStatement,
  deferEngBillingLines,
  downloadAttachmentBlob,
  getEngBillingStatement,
  issueEngBillingStatement,
  listEngBillingReadyLines,
  listEngBillingStatements,
  uploadAttachment,
  type CloseEngBillingStatementRequest,
  type CreateEngBillingStatementRequest,
  type DeferEngBillingLinesRequest,
  type EngBillingReadyLineDto,
  type EngBillingStatementDto,
} from "@platform/api-client";
import { prototypeModulesApiConfig } from "./prototype-modules-api-config";
import {
  workOrdersApiConfig,
  apiErrorMessage,
  resolveApiError,
} from "./work-orders-api-config";

/** Attachments scope for transfer-receipt files on eng-office billing close-out. */
export const ENG_BILLING_TRANSFER_RECEIPT_SCOPE =
  "eng-billing-transfer-receipt";

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function loadEngBillingReadyLines(
  assigneeId?: string,
): Promise<EngBillingReadyLineDto[]> {
  const config = workOrdersApiConfig();
  if (!config) return [];
  const result = await listEngBillingReadyLines(config, assigneeId);
  return result.ok ? result.data : [];
}

export async function loadEngBillingStatements(query?: {
  assigneeId?: string;
  status?: string;
  issuedOrLaterOnly?: boolean;
}): Promise<EngBillingStatementDto[]> {
  const config = workOrdersApiConfig();
  if (!config) return [];
  const result = await listEngBillingStatements(config, query ?? {});
  return result.ok ? result.data : [];
}

export async function loadEngBillingStatement(
  statementId: string,
): Promise<EngBillingStatementDto | null> {
  const config = workOrdersApiConfig();
  if (!config) return null;
  const result = await getEngBillingStatement(config, statementId);
  return result.ok ? result.data : null;
}

export async function runCreateEngBillingStatement(
  body: CreateEngBillingStatementRequest,
): Promise<
  | { ok: true; statement: EngBillingStatementDto; deferredCount: number }
  | { ok: false; error: string }
> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await createEngBillingStatement(config, body);
  if (!result.ok) {
    return {
      ok: false,
      error:
        ("message" in result && result.message) ||
        apiErrorMessage(result.kind, "تعذّر إنشاء كشف الفوترة"),
    };
  }
  if (result.data.error || !result.data.statement) {
    return {
      ok: false,
      error: result.data.error ?? "تعذّر إنشاء كشف الفوترة",
    };
  }
  return {
    ok: true,
    statement: result.data.statement,
    deferredCount: result.data.deferredLines.length,
  };
}

export async function runIssueEngBillingStatement(
  statementId: string,
): Promise<
  { ok: true; statement: EngBillingStatementDto } | { ok: false; error: string }
> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await issueEngBillingStatement(config, statementId);
  if (!result.ok) {
    return {
      ok: false,
      error:
        ("message" in result && result.message) ||
        apiErrorMessage(result.kind, "تعذّر إرسال كشف الفوترة"),
    };
  }
  return { ok: true, statement: result.data };
}

export async function runCloseEngBillingStatement(
  statementId: string,
  body: CloseEngBillingStatementRequest,
): Promise<
  { ok: true; statement: EngBillingStatementDto } | { ok: false; error: string }
> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await closeEngBillingStatement(config, statementId, body);
  if (!result.ok) {
    return {
      ok: false,
      error:
        ("message" in result && result.message) ||
        apiErrorMessage(result.kind, "تعذّر إقفال كشف الفوترة"),
    };
  }
  return { ok: true, statement: result.data };
}

export async function runDeferEngBillingLines(
  body: DeferEngBillingLinesRequest,
): Promise<
  | { ok: true; deferredCount: number; failedCount: number }
  | { ok: false; error: string }
> {
  const config = workOrdersApiConfig();
  if (!config) return { ok: false, error: apiErrorMessage("auth") };
  const result = await deferEngBillingLines(config, body);
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

export async function uploadEngBillingTransferReceipt(
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

export async function openEngBillingAttachment(
  attachmentId: string,
  fileName = "إيصال-التحويل",
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
    // Popup blocked — fall back to download.
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
