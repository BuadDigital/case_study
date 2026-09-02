import {
  clearTaskScopedAttachments,
  getCachedTaskAttachment,
  openTaskAttachmentPreview,
  prefetchTaskAttachment,
  uploadTaskScopedAttachment,
} from "@platform/app-shared/app-data/task-attachments-api";
import { getCachedPartySubmission } from "@platform/app-shared/app-data/party-submission-api";
import {
  loadEvaluatorSubmission,
  saveEvaluatorSubmission,
  type EvaluatorPlanImageMetadata,
  type EvaluatorReportMetadata,
} from "./evaluator-submission-storage";

const EVALUATOR_REPORT_SCOPE = "evaluator-report";

export type CachedEvaluatorReport = {
  fileName: string;
  mimeType: string;
  dataUrl?: string;
  sizeBytes?: number;
  attachmentId?: string;
};

export function getCachedEvaluatorReport(
  taskId: string,
): CachedEvaluatorReport | null {
  if (!taskId) return null;

  const cached = getCachedTaskAttachment(EVALUATOR_REPORT_SCOPE, taskId);
  if (cached?.fileName) return cached;

  const dto = getCachedPartySubmission(taskId);
  const metadata = dto?.payload.reportMetadata as
    | EvaluatorReportMetadata
    | undefined;
  if (metadata?.fileName) {
    return {
      fileName: metadata.fileName,
      mimeType: metadata.mimeType,
      sizeBytes: metadata.sizeBytes,
      attachmentId: metadata.attachmentId,
    };
  }

  const sub = loadEvaluatorSubmission(taskId);
  if (sub?.reportFileName) {
    return { fileName: sub.reportFileName, mimeType: "application/pdf" };
  }
  return null;
}

export async function prefetchEvaluatorReport(
  taskId: string,
): Promise<CachedEvaluatorReport | null> {
  if (!taskId) return null;
  return prefetchTaskAttachment(EVALUATOR_REPORT_SCOPE, taskId);
}

export async function cacheIssuedValuationReport(
  taskId: string,
  file: File,
  reportNo: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!taskId) {
    return { ok: false, error: "تعذّر حفظ التقرير." };
  }
  const current = loadEvaluatorSubmission(taskId);
  if (!current) {
    return { ok: false, error: "لا توجد مسودة تقييم." };
  }

  const uploaded = await uploadTaskScopedAttachment(
    EVALUATOR_REPORT_SCOPE,
    taskId,
    file,
  );
  if (!uploaded) {
    return { ok: false, error: "تعذّر حفظ التقرير المولَّد." };
  }

  const reportMetadata: EvaluatorReportMetadata = {
    fileName: file.name,
    mimeType: file.type || "application/pdf",
    sizeBytes: file.size,
    attachmentId: uploaded.attachmentId,
  };

  const dto = getCachedPartySubmission(taskId);
  const planImageMetadata = dto?.payload.planImageMetadata as
    | EvaluatorPlanImageMetadata
    | undefined;

  await saveEvaluatorSubmission(
    { ...current, reportFileName: file.name, reportNo: reportNo.trim() || current.reportNo },
    reportMetadata,
    planImageMetadata,
  );
  return { ok: true };
}

export async function clearCachedEvaluatorReport(taskId: string): Promise<void> {
  if (!taskId) return;
  const current = loadEvaluatorSubmission(taskId);
  if (!current) return;
  await clearTaskScopedAttachments(EVALUATOR_REPORT_SCOPE, taskId);
  await saveEvaluatorSubmission({ ...current, reportFileName: null });
}

export async function openEvaluatorReportPreview(
  taskId: string,
): Promise<boolean> {
  const cached = getCachedEvaluatorReport(taskId);
  if (cached?.dataUrl) {
    openTaskAttachmentPreview(cached);
    return true;
  }
  try {
    const preview = await prefetchEvaluatorReport(taskId);
    if (preview?.dataUrl) {
      openTaskAttachmentPreview(preview);
      return true;
    }
  } catch (err: unknown) {
    console.warn("Evaluator report prefetch failed:", err);
  }
  return false;
}
