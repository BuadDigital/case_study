import {
  fetchPartySubmission,
  prefetchPartySubmissionsForTasks,
} from "@platform/app-shared/app-data/party-submission-api";
import {
  jeddahDefaultCoords,
  shouldUseJeddahDefaultCoords,
} from "@platform/app-shared/domain/jeddah-default-coords";
import {
  normalizeEngineeringSurveyChecklist,
  type EngineeringSurveySubmission,
  ENGINEERING_SURVEY_CHECKLIST_ITEMS,
} from "./engineering-survey-data";
import {
  dtoToSubmission,
  loadEngineeringSurveySubmission,
} from "./engineering-survey-submission-model";
export { loadEngineeringSurveySubmission } from "./engineering-survey-submission-model";

/**
 * Normalization repair persists the draft, so the write lives on the command
 * side. Loaded lazily to keep the static import graph one-way
 * (commands → reads).
 */
async function persistNormalizedSubmission(
  submission: EngineeringSurveySubmission,
): Promise<void> {
  const { saveEngineeringSurveySubmission } = await import(
    "./engineering-survey-submission-commands"
  );
  await saveEngineeringSurveySubmission(submission);
}

export async function fetchEngineeringSurveySubmission(
  taskId: string,
  options?: { persistFixes?: boolean },
): Promise<EngineeringSurveySubmission | null> {
  const dto = await fetchPartySubmission(taskId);
  let sub = dtoToSubmission(dto);
  if (!sub) return null;

  let dirty = false;
  const checklistValid =
    Array.isArray(sub.checklist) &&
    sub.checklist.length === ENGINEERING_SURVEY_CHECKLIST_ITEMS.length;
  if (!checklistValid) {
    sub = {
      ...sub,
      checklist: normalizeEngineeringSurveyChecklist(sub.checklist),
    };
    dirty = true;
  }
  if (
    sub.status !== "submitted" &&
    shouldUseJeddahDefaultCoords(sub.latitude, sub.longitude)
  ) {
    const defaults = jeddahDefaultCoords();
    sub = { ...sub, ...defaults };
    dirty = true;
  }
  // Viewers (specialist advisory / read-only) must not PUT — only the
  // assigned party may persist normalization fixes.
  if (dirty && options?.persistFixes) {
    await persistNormalizedSubmission(sub);
  }
  return sub;
}

/** Load from API for advisory / read-only panels — never creates a draft. */
export async function loadEngineeringSurveySubmissionAsync(input: {
  taskId: string;
  propertyId?: string;
  poNumber?: string;
}): Promise<EngineeringSurveySubmission | null> {
  const cached = loadEngineeringSurveySubmission(input.taskId);
  if (cached) return cached;
  return fetchEngineeringSurveySubmission(input.taskId);
}

export async function prefetchEngineeringSurveySubmissions(
  taskIds: string[],
): Promise<void> {
  await prefetchPartySubmissionsForTasks(taskIds);
}
