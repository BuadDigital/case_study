import type { PageId } from "@platform/types";
import { isPartyTaskPage } from "@platform/app-shared/prototype/party-task-pages";
import { poPropertyInspectionInputPath } from "./po-routes";
import type { WorkflowTask } from "./prototype/tasks-storage";

export function myTasksPath(): string {
  return "/active-primary-data";
}

export function activeDistributionPath(): string {
  return "/active-distribution";
}

export function distributionTaskPath(taskId: string): string {
  return `/active-distribution?task=${encodeURIComponent(taskId)}`;
}

export function activeCaseStudyPath(): string {
  return "/active-case-study";
}

export function systemUploadPath(): string {
  return "/system-upload";
}

export function caseStudyWorkspacePath(taskId: string): string {
  return `/case-study/${encodeURIComponent(taskId)}`;
}

/** Queue deep-link; redirects to full workspace when opened with ?task= */
export function caseStudyTaskPath(taskId: string): string {
  return caseStudyWorkspacePath(taskId);
}

export function partyTaskPath(pageId: PageId): string {
  return `/${pageId}`;
}

export function partyTaskTaskPath(pageId: PageId, taskId: string): string {
  return `/${pageId}?task=${encodeURIComponent(taskId)}`;
}

/** Full-page workspace for the engineering office (survey). */
export function activeSurveyWorkspacePath(taskId: string): string {
  return `/active-survey/${encodeURIComponent(taskId)}`;
}

/** Data-entry page for survey (editable form). */
export function activeSurveyEntryPath(taskId: string): string {
  return `/active-survey/${encodeURIComponent(taskId)}/entry`;
}

/** Full-page workspace for the property appraiser (property valuation). */
export function propertyAppraisalWorkspacePath(taskId: string): string {
  return `/property-appraisal/${encodeURIComponent(taskId)}`;
}

/** Full-page workspace for the field inspector — official path under active transactions. */
export function activeInspectionWorkspacePath(taskId: string): string {
  return `/active-inspection/${encodeURIComponent(taskId)}`;
}

/** Full-page workspace for the field inspector (property inspection — orphan screen). */
export function propertyInspectionWorkspacePath(taskId: string): string {
  return `/property-inspection/${encodeURIComponent(taskId)}`;
}

/** Resolve full-page inspection workspace from party task page id. */
export function fieldInspectionWorkspacePath(
  pageId: PageId,
  taskId: string,
): string {
  return pageId === "property-inspection"
    ? propertyInspectionWorkspacePath(taskId)
    : activeInspectionWorkspacePath(taskId);
}

export function operationsTaskPath(taskId: string): string {
  return `/operations-tasks?task=${encodeURIComponent(taskId)}`;
}

export function isPartyTaskWorkPath(pathname: string): boolean {
  const page = pathname.split("/").filter(Boolean)[0] ?? "";
  return isPartyTaskPage(page as PageId);
}

export function primaryDataTaskPath(taskId: string): string {
  return `/active-primary-data?task=${encodeURIComponent(taskId)}`;
}

export function allTransactionsPath(): string {
  return "/all-transactions";
}

export function allTransactionsTaskPath(taskId: string): string {
  return `/all-transactions?task=${encodeURIComponent(taskId)}`;
}

export function favoritesPath(): string {
  return "/favorites";
}

export function favoritesTaskPath(taskId: string): string {
  return `/favorites?task=${encodeURIComponent(taskId)}`;
}

/** Full-page workspace for distributed party tasks opened from all-transactions. */
export function partyTaskWorkspacePath(task: WorkflowTask): string | undefined {
  switch (task.kind) {
    case "field-inspection": {
      const propertyId = task.propertyId?.trim();
      if (propertyId) {
        return poPropertyInspectionInputPath(task.poNumber, propertyId);
      }
      return activeInspectionWorkspacePath(task.id);
    }
    case "engineering-survey":
      return activeSurveyWorkspacePath(task.id);
    case "property-appraisal":
      return propertyAppraisalWorkspacePath(task.id);
    default:
      return undefined;
  }
}

export function decodeTaskParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
