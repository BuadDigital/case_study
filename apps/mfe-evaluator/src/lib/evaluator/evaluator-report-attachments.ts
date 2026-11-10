import {
  getCachedTaskAttachment,
  prefetchTaskAttachment,
} from "@platform/app-shared/app-data/task-attachments-api";
import { getCachedPartySubmission } from "@platform/app-shared/app-data/party-submission-api";
import type { EvaluatorReportMetadata } from "./evaluator-submission-model";

const EVALUATOR_REPORT_SCOPE = "evaluator-report";

type CachedEvaluatorReport = {
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

  // 2026-11-10: the old fallback to the submission's reportFileName is gone — nothing ever wrote it.
  return null;
}

export async function prefetchEvaluatorReport(
  taskId: string,
): Promise<CachedEvaluatorReport | null> {
  if (!taskId) return null;
  return prefetchTaskAttachment(EVALUATOR_REPORT_SCOPE, taskId);
}
