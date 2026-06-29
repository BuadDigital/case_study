import type { PageId } from "@platform/types";
import { isPartyTaskPage } from "@platform/app-shared/prototype/party-task-pages";

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

/** Full-page workspace for المراجع الحكومي (المراجعة الحكومية). */
export function governmentReviewWorkspacePath(taskId: string): string {
  return `/government-review/${encodeURIComponent(taskId)}`;
}

export function isGovernmentReviewWorkspacePath(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  return parts[0] === "government-review" && parts.length >= 2;
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

export function decodeTaskParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
