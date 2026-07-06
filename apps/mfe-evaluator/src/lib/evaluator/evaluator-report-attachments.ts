import {
  clearTaskScopedAttachments,
  getCachedTaskAttachment,
  openTaskAttachmentPreview,
  prefetchTaskAttachment,
  uploadTaskScopedAttachment,
} from "@platform/app-shared/prototype/task-attachments-api";
import { getCachedPartySubmission } from "@platform/app-shared/prototype/party-submission-api";
import { MAX_EVALUATOR_PDF_BYTES } from "./evaluator-window-data";
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

export async function cacheEvaluatorReport(
  taskId: string,
  file: File,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!taskId) {
    return { ok: false, error: "تعذّر حفظ الملف." };
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return { ok: false, error: "يُقبل ملف PDF فقط." };
  }
  if (file.size > MAX_EVALUATOR_PDF_BYTES) {
    return { ok: false, error: "الحجم الأقصى 20 ميجابايت." };
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
    return { ok: false, error: "تعذّر حفظ الملف." };
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
    { ...current, reportFileName: file.name },
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

export function openEvaluatorReportPreview(taskId: string): void {
  const cached = getCachedEvaluatorReport(taskId);
  if (!cached) return;
  if (cached.dataUrl) {
    openTaskAttachmentPreview(cached);
    return;
  }
  void prefetchEvaluatorReport(taskId)
    .then((preview) => {
      if (preview) openTaskAttachmentPreview(preview);
    })
    .catch((err: unknown) => {
      console.warn("Evaluator report prefetch failed:", err);
    });
}
