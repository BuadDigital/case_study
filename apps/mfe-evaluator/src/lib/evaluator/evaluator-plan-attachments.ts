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

const EVALUATOR_PLAN_SCOPE = "evaluator-plan-image";

export type CachedEvaluatorPlanImage = {
  fileName: string;
  mimeType: string;
  dataUrl?: string;
  sizeBytes?: number;
  attachmentId?: string;
};

function isAcceptedPlanFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  if (file.type === "application/pdf" || lower.endsWith(".pdf")) return true;
  if (file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif)$/i.test(lower);
}

export function getCachedEvaluatorPlanImage(
  taskId: string,
): CachedEvaluatorPlanImage | null {
  if (!taskId) return null;

  const cached = getCachedTaskAttachment(EVALUATOR_PLAN_SCOPE, taskId);
  if (cached?.fileName) return cached;

  const dto = getCachedPartySubmission(taskId);
  const metadata = dto?.payload.planImageMetadata as
    | EvaluatorPlanImageMetadata
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
  if (sub?.planImageFileName) {
    return {
      fileName: sub.planImageFileName,
      mimeType: "application/pdf",
    };
  }
  return null;
}

export async function prefetchEvaluatorPlanImage(
  taskId: string,
): Promise<CachedEvaluatorPlanImage | null> {
  if (!taskId) return null;
  return prefetchTaskAttachment(EVALUATOR_PLAN_SCOPE, taskId);
}

export async function cacheEvaluatorPlanImage(
  taskId: string,
  file: File,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!taskId) {
    return { ok: false, error: "تعذّر حفظ الملف." };
  }
  if (!isAcceptedPlanFile(file)) {
    return { ok: false, error: "يُقبل ملف PDF أو صورة (JPG, PNG, WebP)." };
  }
  if (file.size > MAX_EVALUATOR_PDF_BYTES) {
    return { ok: false, error: "الحجم الأقصى 20 ميجابايت." };
  }

  const current = loadEvaluatorSubmission(taskId);
  if (!current) {
    return { ok: false, error: "لا توجد مسودة تقييم." };
  }

  const uploaded = await uploadTaskScopedAttachment(
    EVALUATOR_PLAN_SCOPE,
    taskId,
    file,
  );
  if (!uploaded) {
    return { ok: false, error: "تعذّر حفظ الملف." };
  }

  const planImageMetadata: EvaluatorPlanImageMetadata = {
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    attachmentId: uploaded.attachmentId,
  };

  const dto = getCachedPartySubmission(taskId);
  const reportMetadata = dto?.payload.reportMetadata as
    | EvaluatorReportMetadata
    | undefined;

  await saveEvaluatorSubmission(
    { ...current, planImageFileName: file.name },
    reportMetadata,
    planImageMetadata,
  );
  return { ok: true };
}

export function openEvaluatorPlanImagePreview(taskId: string): void {
  const cached = getCachedEvaluatorPlanImage(taskId);
  if (!cached) return;
  if (cached.dataUrl) {
    openTaskAttachmentPreview(cached);
    return;
  }
  void prefetchEvaluatorPlanImage(taskId)
    .then((preview) => {
      if (preview) openTaskAttachmentPreview(preview);
    })
    .catch((err: unknown) => {
      console.warn("Evaluator plan image prefetch failed:", err);
    });
}

export async function clearCachedEvaluatorPlanImage(taskId: string): Promise<void> {
  if (!taskId) return;
  const current = loadEvaluatorSubmission(taskId);
  if (!current) return;
  await clearTaskScopedAttachments(EVALUATOR_PLAN_SCOPE, taskId);
  await saveEvaluatorSubmission({ ...current, planImageFileName: null });
}
