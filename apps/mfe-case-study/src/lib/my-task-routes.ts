import type { PageId } from "@platform/types";
import { isPartyTaskPage } from "@platform/app-shared/prototype/party-task-pages";
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

/** Full-page workspace for المكتب الهندسي (الرفع المساحي). */
export function activeSurveyWorkspacePath(taskId: string): string {
  return `/active-survey/${encodeURIComponent(taskId)}`;
}

/** Data-entry page for الرفع المساحي (editable form). */
export function activeSurveyEntryPath(taskId: string): string {
  return `/active-survey/${encodeURIComponent(taskId)}/entry`;
}

export function isActiveSurveyWorkspacePath(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  return parts[0] === "active-survey" && parts.length >= 2 && parts[2] !== "entry";
}

export function isActiveSurveyEntryPath(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  return parts[0] === "active-survey" && parts.length >= 3 && parts[2] === "entry";
}

/** Full-page workspace for المقيم العقاري (تقييم العقار). */
export function propertyAppraisalWorkspacePath(taskId: string): string {
  return `/property-appraisal/${encodeURIComponent(taskId)}`;
}

export function isPropertyAppraisalWorkspacePath(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  return parts[0] === "property-appraisal" && parts.length >= 2;
}

/** Full-page workspace for المعاين الميداني (معاينة العقار). */
export function propertyInspectionWorkspacePath(taskId: string): string {
  return `/property-inspection/${encodeURIComponent(taskId)}`;
}

export function isPropertyInspectionWorkspacePath(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  return parts[0] === "property-inspection" && parts.length >= 2;
}

/** Full-page workspace for legacy party government-review tasks (CDO / in-flight). */
export function governmentReviewWorkspacePath(taskId: string): string {
  return `/government-review/${encodeURIComponent(taskId)}`;
}

export function isGovernmentReviewWorkspacePath(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  return parts[0] === "government-review" && parts.length >= 2;
}

/** Operations tasks hub (court visits / reviewer work). */
export function operationsTasksPath(): string {
  return "/operations-tasks";
}

export function operationsTaskPath(taskId: string): string {
  return `/operations-tasks?task=${encodeURIComponent(taskId)}`;
}

/** Full-page workspace for منسق التقييم (استلام التقييم). */
export function valuationCoordinationWorkspacePath(taskId: string): string {
  return `/valuation-coordination/${encodeURIComponent(taskId)}`;
}

export function isValuationCoordinationWorkspacePath(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  return parts[0] === "valuation-coordination" && parts.length >= 2;
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

/** Full-page workspace for distributed party tasks opened from جميع المعاملات. */
export function partyTaskWorkspacePath(task: WorkflowTask): string | undefined {
  switch (task.kind) {
    case "field-inspection":
      return propertyInspectionWorkspacePath(task.id);
    case "engineering-survey":
      return activeSurveyWorkspacePath(task.id);
    case "property-appraisal":
      return propertyAppraisalWorkspacePath(task.id);
    case "valuation-coordination":
      return valuationCoordinationWorkspacePath(task.id);
    case "government-review":
      // Reviewer/CDO hub is operations-tasks; party form remains at
      // governmentReviewWorkspacePath for GovernmentReviewView only.
      return operationsTasksPath();
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
