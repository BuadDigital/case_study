import { listWorkflowTasks } from "@platform/api-client";
import { workOrdersApiConfig } from "@platform/app-shared/prototype/work-orders-api-config";

export type SurveyRequestStats = {
  total: number;
  completed: number;
  inProgress: number;
  unassigned: number;
};

const EMPTY_STATS: SurveyRequestStats = {
  total: 0,
  completed: 0,
  inProgress: 0,
  unassigned: 0,
};

export function computeSurveyRequestStats(
  tasks: { kind: string; status: string; assigneeId?: string }[],
): SurveyRequestStats {
  const surveyTasks = tasks.filter((t) => t.kind === "engineering-survey");
  if (surveyTasks.length === 0) return EMPTY_STATS;

  let completed = 0;
  let inProgress = 0;
  let unassigned = 0;

  for (const task of surveyTasks) {
    if (task.status === "completed") {
      completed += 1;
      continue;
    }
    if (task.status === "open") {
      inProgress += 1;
      if (!task.assigneeId?.trim()) unassigned += 1;
    }
  }

  return {
    total: surveyTasks.length,
    completed,
    inProgress,
    unassigned,
  };
}

export async function loadSurveyRequestStats(): Promise<SurveyRequestStats> {
  const config = workOrdersApiConfig();
  if (!config) return EMPTY_STATS;

  const result = await listWorkflowTasks(config);
  if (!result.ok) return EMPTY_STATS;

  return computeSurveyRequestStats(result.data);
}
