/**
 * Pure topbar chrome behind `AppShell`: which task the workspace route points
 * at, whether the sidebar treats the route as "task work", the keys /
 * organization-settings leaf chrome, and the breadcrumb + title precedence.
 * No React, no I/O — `useAppShellChrome` feeds these from queries and the
 * topbar only renders their output.
 */
import type { PageId, RoleId } from "@platform/types";
import {
  PAGE_BREADCRUMB,
  PAGE_TITLES,
} from "@platform/app-shared/app-data/constants";
import { isPartyFeesUnderActiveTransactions } from "@platform/app-shared/app-data/active-transactions";
import { organizationSettingsLeafTitle } from "@platform/app-shared/app-data/system-settings-nav";
import { isPartyTaskPage } from "@platform/app-shared/app-data/party-task-pages";
import {
  financeLeafForArea,
  type FinanceNavArea,
} from "@platform/app-shared/app-data/financial-nav";
import { decodeTaskParam, isPartyTaskWorkPath } from "@case-study/mfe/lib/my-task-routes";
import { formatPropertyDeedDisplay } from "@case-study/mfe/lib/app-data/po-intake-data";
import { slashTrailToSegments, type BreadcrumbSegment } from "../../lib/breadcrumb";
import { buildPoPropertyWorkspaceSegments } from "../../lib/po-chrome";
import type { ShellRoute } from "./app-shell-nav-state";

/** Minimal read surface of `URLSearchParams` so tests can pass a plain map. */
export type SearchLike = { get(name: string): string | null };

export type LeafChrome = { title: string; breadcrumb: string };

/** Keys: leaf-only breadcrumb for envelope / fees subviews. */
export function resolveKeysChrome(
  currentPage: PageId,
  search: SearchLike,
): LeafChrome | null {
  if (currentPage !== "keys") return null;
  const envelope = search.get("envelope")?.trim();
  if (envelope) return { title: "ملف الظرف", breadcrumb: "ملف الظرف" };
  if (search.get("tab") === "fees") {
    return { title: "تقرير الأتعاب", breadcrumb: "تقرير الأتعاب" };
  }
  return null;
}

export function resolveOrgSettingsChrome(
  currentPage: PageId,
  search: SearchLike,
): LeafChrome | null {
  if (currentPage !== "organization-settings") return null;
  const title = organizationSettingsLeafTitle(search.get("tab"));
  return { title, breadcrumb: title };
}

const TASK_QUEUE_PAGES: readonly PageId[] = [
  "active-primary-data",
  "all-transactions",
  "active-distribution",
  "active-case-study",
  "operations-tasks",
];

/**
 * Task id handed to `resolveMyTasksChrome`: the workspace route's own id when on
 * one, else the `?task=` query on queue/party pages, else nothing.
 */
export function resolveMyTasksTaskId(
  route: ShellRoute,
  taskQuery: string | null,
): string | null {
  const taskPage =
    TASK_QUEUE_PAGES.includes(route.currentPage) ||
    route.onCaseStudyWorkspace ||
    route.onActiveSurveyRoute ||
    route.onPropertyAppraisalWorkspace ||
    route.onFieldInspectionWorkspace ||
    isPartyTaskPage(route.currentPage);
  if (!taskPage) return null;
  if (route.onCaseStudyWorkspace) return route.caseStudyTaskId;
  if (route.onActiveSurveyRoute) return route.activeSurveyTaskId;
  if (route.onPropertyAppraisalWorkspace) return route.propertyAppraisalTaskId;
  if (route.onFieldInspectionWorkspace) return route.fieldInspectionTaskId;
  return taskQuery;
}

/** True while the user is inside a task (drives the active-transactions dropdown highlight). */
export function isOnTaskWork(
  route: ShellRoute,
  pathname: string | null | undefined,
  taskQuery: string | null,
): boolean {
  const hasTask = Boolean(taskQuery);
  return (
    (route.currentPage === "active-primary-data" && hasTask) ||
    (route.currentPage === "all-transactions" && hasTask) ||
    (route.currentPage === "active-distribution" && hasTask) ||
    route.onActiveSurveyRoute ||
    route.onPropertyAppraisalWorkspace ||
    route.onFieldInspectionWorkspace ||
    (pathname ? isPartyTaskWorkPath(pathname) && hasTask : false)
  );
}

export type WorkspaceTaskRef = { poNumber: string; propertyId: string | undefined };

/** The PO/property a workspace route param points at, or null when unknown. */
export function pickWorkspaceTaskRef<
  T extends { id: string; poNumber: string; propertyId?: string },
>(tasks: T[], param: string | null): WorkspaceTaskRef | null {
  if (!param) return null;
  const id = decodeTaskParam(param);
  const task = tasks.find((t) => t.id === id);
  if (!task) return null;
  return { poNumber: task.poNumber, propertyId: task.propertyId };
}

export function resolveOpsTaskTitle(
  deepLink: string | null,
  tasks: { id: string; displayId?: string | null; title?: string | null }[] | undefined,
): string | undefined {
  if (!deepLink || !tasks?.length) return undefined;
  const id = decodeTaskParam(deepLink);
  const task = tasks.find((t) => t.id === id) ?? tasks.find((t) => t.displayId === id);
  return task?.title?.trim() || undefined;
}

type DeedProperty = Parameters<typeof formatPropertyDeedDisplay>[0] & { id: string };

/** Deed label for the workspace breadcrumb; empty when the property is unknown. */
export function propertyWorkspaceDeedLabel(
  task: { propertyId?: string } | null,
  po: { properties: DeedProperty[] } | null | undefined,
): string {
  if (!task?.propertyId || !po) return "";
  const prop = po.properties.find((p) => p.id === task.propertyId) ?? null;
  if (!prop) return "";
  const formatted = formatPropertyDeedDisplay(prop);
  if (formatted && formatted !== "—") return formatted;
  return prop.deedNumber.trim();
}

export function resolvePropertyWorkspaceBreadcrumb(
  route: Pick<ShellRoute, "onCaseStudyWorkspace" | "onPropertyAppraisalWorkspace">,
  task: { poNumber: string } | null,
  deedLabel: string,
): BreadcrumbSegment[] | null {
  if (
    (!route.onCaseStudyWorkspace && !route.onPropertyAppraisalWorkspace) ||
    !task?.poNumber?.trim()
  ) {
    return null;
  }
  return buildPoPropertyWorkspaceSegments(task.poNumber.trim(), deedLabel || undefined);
}

export type PageChromeInput = {
  currentPage: PageId;
  role: RoleId;
  financeArea: FinanceNavArea;
  poChrome: { segments: BreadcrumbSegment[]; title: string } | null;
  propertyWorkspaceBreadcrumb: BreadcrumbSegment[] | null;
  myTasksChrome: LeafChrome | null;
  keysChrome: LeafChrome | null;
  orgSettingsChrome: LeafChrome | null;
};

export type PageChrome = {
  /** Full trail (including the current page) — matches HTML setHeader(title, crumb([…, current])). */
  breadcrumbSegments: BreadcrumbSegment[];
  title: string;
};

/** Breadcrumb and title precedence for the topbar. */
export function resolvePageChrome({
  currentPage,
  role,
  financeArea,
  poChrome,
  propertyWorkspaceBreadcrumb,
  myTasksChrome,
  keysChrome,
  orgSettingsChrome,
}: PageChromeInput): PageChrome {
  const partyFeesUnderActiveTx =
    currentPage === "party-fees" && isPartyFeesUnderActiveTransactions(role);
  // Engineering fees under active-transactions — same parent group as other active queues.
  const engineeringFeesCrumb = partyFeesUnderActiveTx
    ? slashTrailToSegments("المعاملات النشطة / فوترة الأتعاب")
    : null;
  const financeLeaf =
    currentPage === "financial" ? financeLeafForArea(financeArea) : null;
  const financialCrumb = financeLeaf ? slashTrailToSegments(financeLeaf.crumb) : null;

  const breadcrumbSegments =
    poChrome?.segments ??
    propertyWorkspaceBreadcrumb ??
    engineeringFeesCrumb ??
    financialCrumb ??
    (myTasksChrome?.breadcrumb
      ? slashTrailToSegments(myTasksChrome.breadcrumb)
      : keysChrome?.breadcrumb
        ? slashTrailToSegments(keysChrome.breadcrumb)
        : orgSettingsChrome?.breadcrumb
          ? slashTrailToSegments(orgSettingsChrome.breadcrumb)
          : PAGE_BREADCRUMB[currentPage]
            ? slashTrailToSegments(PAGE_BREADCRUMB[currentPage])
            : undefined);

  const title =
    poChrome?.title ??
    myTasksChrome?.title ??
    keysChrome?.title ??
    orgSettingsChrome?.title ??
    financeLeaf?.pageTitle ??
    (partyFeesUnderActiveTx ? "فوترة الأتعاب" : PAGE_TITLES[currentPage]) ??
    "";

  return { breadcrumbSegments: breadcrumbSegments ?? [], title };
}
