import {
  clearTaskScopedAttachments,
  getCachedTaskAttachment,
  uploadTaskScopedAttachment,
} from "@platform/app-shared/app-data/task-attachments-api";
import { getCachedPartySubmission } from "@platform/app-shared/app-data/party-submission-api";
import { MAX_EVALUATOR_PDF_BYTES } from "./evaluator-window-data";
import {
  loadEvaluatorSubmission,
  saveEvaluatorSubmission,
  type EvaluatorPlanImageMetadata,
  type EvaluatorReportMetadata,
} from "./evaluator-submission-storage";

const EVALUATOR_DEPOSIT_SCOPE = "evaluator-deposit-certificate";

export type CachedEvaluatorDepositCertificate = {
  fileName: string;
  mimeType: string;
  dataUrl?: string;
  sizeBytes?: number;
  attachmentId?: string;
};

function isAcceptedDepositFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  if (file.type === "application/pdf" || lower.endsWith(".pdf")) return true;
  if (file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif)$/i.test(lower);
}

export function getCachedEvaluatorDepositCertificate(
  taskId: string,
): CachedEvaluatorDepositCertificate | null {
  if (!taskId) return null;

  const cached = getCachedTaskAttachment(EVALUATOR_DEPOSIT_SCOPE, taskId);
  if (cached?.fileName) return cached;

  const dto = getCachedPartySubmission(taskId);
  const metadata = dto?.payload.depositCertificateMetadata as
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
  if (sub?.depositCertificateFileName) {
    return {
      fileName: sub.depositCertificateFileName,
      mimeType: "application/pdf",
    };
  }
  return null;
}

export async function cacheEvaluatorDepositCertificate(
  taskId: string,
  file: File,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!taskId) {
    return { ok: false, error: "تعذّر حفظ الملف." };
  }
  if (!isAcceptedDepositFile(file)) {
    return { ok: false, error: "يُقبل ملف PDF أو صورة." };
  }
  if (file.size > MAX_EVALUATOR_PDF_BYTES) {
    return { ok: false, error: "الحجم الأقصى 20 ميجابايت." };
  }

  const current = loadEvaluatorSubmission(taskId);
  if (!current) {
    return { ok: false, error: "لا توجد مسودة تقييم." };
  }

  const uploaded = await uploadTaskScopedAttachment(
    EVALUATOR_DEPOSIT_SCOPE,
    taskId,
    file,
  );
  if (!uploaded) {
    return { ok: false, error: "تعذّر حفظ الملف." };
  }

  const dto = getCachedPartySubmission(taskId);
  const reportMetadata = dto?.payload.reportMetadata as
    | EvaluatorReportMetadata
    | undefined;
  const planImageMetadata = dto?.payload.planImageMetadata as
    | EvaluatorPlanImageMetadata
    | undefined;

  await saveEvaluatorSubmission(
    { ...current, depositCertificateFileName: file.name },
    reportMetadata,
    planImageMetadata,
  );
  return { ok: true };
}

export async function clearCachedEvaluatorDepositCertificate(
  taskId: string,
): Promise<void> {
  if (!taskId) return;
  const current = loadEvaluatorSubmission(taskId);
  if (!current) return;
  await clearTaskScopedAttachments(EVALUATOR_DEPOSIT_SCOPE, taskId);
  await saveEvaluatorSubmission({
    ...current,
    depositCertificateFileName: null,
  });
}
