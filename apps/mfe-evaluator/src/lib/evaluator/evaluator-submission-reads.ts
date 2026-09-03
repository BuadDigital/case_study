import {
  fetchPartySubmission,
  prefetchPartySubmissionsForTasks,
} from "@platform/app-shared/app-data/party-submission-api";
import type { EvaluatorSubmission } from "./evaluator-window-data";
import { dtoToSubmission } from "./evaluator-submission-model";

export async function fetchEvaluatorSubmission(
  taskId: string,
): Promise<EvaluatorSubmission | null> {
  const dto = await fetchPartySubmission(taskId);
  return dtoToSubmission(dto);
}

export const fetchEvaluatorSubmissionSnapshot = fetchEvaluatorSubmission;

export async function prefetchEvaluatorSubmissions(
  taskIds: string[],
): Promise<void> {
  await prefetchPartySubmissionsForTasks(taskIds);
}
