"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavIcon } from "@/components/views/NavIcon";
import { EjadaLogo } from "@/components/views/EjadaLogo";
import { ThemeSwitch } from "@/components/views/ThemeSwitch";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import {
  prefetchPoRecord,
  prefetchPrototypePage,
  usePoRecordQuery,
  useWorkflowTasksQuery,
} from "@/lib/query/prototype-queries";
import type { PageId, RoleId } from "@platform/types";
import {
  NAV,
  PAGE_BREADCRUMB,
  PAGE_TITLES,
  ROLES,
} from "@platform/app-shared/prototype/constants";
import {
  ACTIVE_TRANSACTIONS_GROUP,
  ACTIVE_TRANSACTIONS_GROUP_ICON,
  activeTransactionNavForRole,
  type ActiveTransactionNavItem,
  isInActiveTransactionsSection,
  isPartyFeesUnderActiveTransactions,
} from "@platform/app-shared/prototype/active-transactions";
import {
  SYSTEM_SETTINGS_GROUP,
  SYSTEM_SETTINGS_GROUP_ICON,
  settingsNavTreeForRole,
  isInSystemSettingsSection,
  isSettingsNavItemActive,
  organizationSettingsLeafTitle,
  type SettingsNavTreeNode,
  type SystemSettingsNavItem,
} from "@platform/app-shared/prototype/system-settings-nav";
import {
  ORPHAN_SCREENS_GROUP,
  ORPHAN_SCREENS_GROUP_ICON,
  orphanScreensNavForRole,
  isInOrphanScreensSection,
  type OrphanScreenNavItem,
} from "@platform/app-shared/prototype/orphan-screens-nav";
import { isPartyTaskPage } from "@platform/app-shared/prototype/party-task-pages";
import { decodeTaskParam, isPartyTaskWorkPath } from "@case-study/mfe";
import { findPropertyForTask } from "@case-study/mfe";
import { formatPropertyDeedDisplay } from "@case-study/mfe";
import { AppBreadcrumb } from "@/components/views/AppBreadcrumb";
import { NotificationCenter } from "@/components/NotificationCenter";
import { OfflineSyncCoordinator } from "@/components/OfflineSyncCoordinator";
import { resolvePoChrome, buildPoPropertyWorkspaceSegments } from "@/lib/po-chrome";
import { slashTrailToSegments } from "@/lib/breadcrumb";
import { resolveMyTasksChrome } from "@/lib/my-tasks-chrome";
import { EngineeringSurveyTopbarActions } from "@engineering-office/mfe";
import { useQuery } from "@tanstack/react-query";
import { loadOperationsTasks } from "@case-study/mfe/lib/prototype/operations-tasks-storage";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import {
  FINANCIAL_GROUP,
  FINANCIAL_GROUP_ICON,
  FINANCIAL_NAV_LEAVES,
  FINANCIAL_TOGGLE_LABEL,
  financeLeafForArea,
  financialHref,
  isFinanceCoreArea,
  isInFinancialSection,
  parseFinanceNavArea,
  showFinancialNavGroup,
  type FinanceNavArea,
} from "@platform/app-shared/prototype/financial-nav";
import { useFinanceNavBadges } from "@/lib/query/use-finance-nav-badges";
import { useActiveTransactionNavBadges } from "@/lib/query/use-active-transaction-nav-badges";
import { useFailuresNavBadge } from "@/lib/query/use-failures-nav-badge";
import { PoNumber } from "@case-study/mfe/components/ui/PoNumber";
import { cn } from "@platform/ui-kit";
import { clearAuthSession, getAuthSession } from "@platform/auth-client";
import { revokeAuthSession } from "@platform/api-client";
import {
  closeOfflineDb,
  countPendingOutbox,
  purgeOfflineData,
} from "@platform/offline-client";
import { unsubscribeFromPushSafe } from "@/lib/push-logout";
import {
  PullToRefreshIndicator,
  usePullToRefresh,
} from "@/components/PullToRefresh";
import { useAppDataRefresh } from "@/hooks/useAppDataRefresh";
import {
  TopbarSvgIcon,
  MenuIcon,
  SidebarPanelsIcon,
  SIDEBAR_COLLAPSED_KEY,
  readSidebarCollapsed,
  CloseIcon,
  mobileTopbarIconBtn,
  topbarActionIconBtn,
  navRunsForRole,
  NavRow,
  FinanceHtmlNav,
  ActiveTransactionsNavDropdown,
  SystemSettingsNavDropdown,
  OrphanScreensNavDropdown,
  ProfileMenu,
} from "./AppShellNavParts";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { role, rolePages } = usePrototype();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const { refresh } = useAppDataRefresh();
  // Read sessionStorage once per render cycle, not multiple times.
  const sessionUser = useMemo(() => getAuthSession()?.user, []);

  const navPages = useMemo(() => rolePages, [rolePages]);

  const settingsNavTree = useMemo(
    () => settingsNavTreeForRole(rolePages, role),
    [rolePages, role],
  );
  const showGeneralGroup = settingsNavTree.some((node) => node.type !== "divider");

  const orphanScreenItems = useMemo(
    () => orphanScreensNavForRole(rolePages),
    [rolePages],
  );
  const showOrphanScreensGroup = orphanScreenItems.length > 0;

  const navRuns = useMemo(() => navRunsForRole(navPages, role), [navPages, role]);

  const activeTransactionItems = useMemo(
    () => activeTransactionNavForRole(rolePages, role),
    [rolePages, role],
  );

  const showActiveTransactionsGroup = activeTransactionItems.length > 0;
  const failuresNavBadge = useFailuresNavBadge();
  const financeNavBadges = useFinanceNavBadges();
  const showFinancialGroup = showFinancialNavGroup(rolePages);
  const searchParams = useSearchParams();
  const financeArea = parseFinanceNavArea(searchParams.get("area"));
  const activeTxInsertAnchor: PageId | null = rolePages.includes("all-transactions")
    ? "all-transactions"
    : rolePages.includes("po")
      ? "po"
      : null;
  const insertActiveTxAtNavStart =
    (role === "engineering-office" ||
      role === "field-inspector" ||
      role === "government-reviewer") &&
    !activeTxInsertAnchor;
  const activeTxAnchorId = useMemo(() => {
    if (activeTxInsertAnchor) return activeTxInsertAnchor;
    if (insertActiveTxAtNavStart) return null;
    return navRuns.flatMap((run) => run.items)[0]?.id ?? null;
  }, [activeTxInsertAnchor, insertActiveTxAtNavStart, navRuns]);

  const prefetchPage = useMemo(
    () => (page: PageId) => prefetchPrototypePage(queryClient, page),
    [queryClient],
  );

  // Parse path parts once so the workspace/taskId derivations below don't
  // each call split+filter separately.
  const pathParts = useMemo(
    () => pathname?.split("/").filter(Boolean) ?? [],
    [pathname],
  );

  /** Workspace pages lock `#content` scroll — disable shell PTR there. */
  const contentScrollLocked =
    ((pathParts[0] === "property-inspection" ||
      pathParts[0] === "active-inspection") &&
      pathParts.length >= 2) ||
    pathParts[0] === "property-map";

  const silentRefresh = useCallback(
    () => refresh({ silent: true }),
    [refresh],
  );
  const {
    pull: ptrPull,
    refreshing: ptrRefreshing,
    threshold: ptrThreshold,
  } = usePullToRefresh(contentRef, silentRefresh, !contentScrollLocked);

  const currentPage = useMemo(
    () => ((pathParts[0] ?? "dashboard") as PageId),
    [pathParts],
  );

  const activeTxNav = useActiveTransactionNavBadges();
  const activeTxBadges = activeTxNav.badges;

  useEffect(() => {
    const run = () => prefetchPrototypePage(queryClient, currentPage);
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(run, { timeout: 2_000 });
      return () => cancelIdleCallback(id);
    }
    const timer = setTimeout(run, 250);
    return () => clearTimeout(timer);
  }, [queryClient, currentPage]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close the mobile drawer after route navigation completes.
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate desktop rail preference after mount.
    setSidebarCollapsed(readSidebarCollapsed());
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SIDEBAR_COLLAPSED_KEY,
        sidebarCollapsed ? "1" : "0",
      );
    } catch {
      /* ignore quota / private mode */
    }
  }, [sidebarCollapsed]);

  const desktopRail = sidebarCollapsed;

  const onCaseStudyWorkspace = pathname?.startsWith("/case-study/") ?? false;
  const onActiveSurveyRoute = pathParts[0] === "active-survey" && pathParts.length >= 2;
  const onActiveSurveyEntry = onActiveSurveyRoute && pathParts[2] === "entry";
  const onPropertyAppraisalWorkspace = pathParts[0] === "property-appraisal" && pathParts.length >= 2;
  const onActiveInspectionWorkspace = pathParts[0] === "active-inspection" && pathParts.length >= 2;
  const onPropertyInspectionWorkspace = pathParts[0] === "property-inspection" && pathParts.length >= 2;
  const onFieldInspectionWorkspace =
    onActiveInspectionWorkspace || onPropertyInspectionWorkspace;
  /**
   * Field inspection workspace: hide shell topbar so the in-page back/title card is the only header.
   */
  const hideShellTopbar = onFieldInspectionWorkspace;
  const caseStudyTaskId = onCaseStudyWorkspace ? (pathParts[1] ?? null) : null;
  const activeSurveyTaskId = onActiveSurveyRoute ? (pathParts[1] ?? null) : null;
  const propertyAppraisalTaskId = onPropertyAppraisalWorkspace ? (pathParts[1] ?? null) : null;
  const fieldInspectionTaskId = onFieldInspectionWorkspace ? (pathParts[1] ?? null) : null;

  const { data: workflowTasks } = useWorkflowTasksQuery();

  const caseStudyTask = useMemo(() => {
    if (!caseStudyTaskId) return null;
    const id = decodeTaskParam(caseStudyTaskId);
    return workflowTasks?.find((t) => t.id === id) ?? null;
  }, [caseStudyTaskId, workflowTasks]);

  const appraisalWorkspaceTask = useMemo(() => {
    if (!propertyAppraisalTaskId) return null;
    const id = decodeTaskParam(propertyAppraisalTaskId);
    return workflowTasks?.find((t) => t.id === id) ?? null;
  }, [propertyAppraisalTaskId, workflowTasks]);

  const propertyWorkspaceTask = onCaseStudyWorkspace
    ? caseStudyTask
    : onPropertyAppraisalWorkspace
      ? appraisalWorkspaceTask
      : null;

  const { data: propertyWorkspacePo } = usePoRecordQuery(
    propertyWorkspaceTask?.poNumber ?? null,
  );

  useEffect(() => {
    if (caseStudyTask?.poNumber) {
      prefetchPrototypePage(queryClient, "active-case-study");
      prefetchPoRecord(queryClient, caseStudyTask.poNumber);
    }
  }, [queryClient, caseStudyTask?.poNumber]);

  useEffect(() => {
    if (appraisalWorkspaceTask?.poNumber) {
      prefetchPoRecord(queryClient, appraisalWorkspaceTask.poNumber);
    }
  }, [queryClient, appraisalWorkspaceTask?.poNumber]);

  const propertyWorkspaceDeedLabel = useMemo(() => {
    if (!propertyWorkspaceTask || !propertyWorkspacePo) return "";
    const prop = findPropertyForTask(propertyWorkspacePo, propertyWorkspaceTask);
    if (!prop) return "";
    const formatted = formatPropertyDeedDisplay(prop);
    if (formatted && formatted !== "—") return formatted;
    return prop.deedNumber.trim();
  }, [propertyWorkspaceTask, propertyWorkspacePo]);

  const caseStudyDeedLabel = propertyWorkspaceDeedLabel;

  const caseStudyBreadcrumb = useMemo(() => {
    if (
      (!onCaseStudyWorkspace && !onPropertyAppraisalWorkspace) ||
      !propertyWorkspaceTask?.poNumber?.trim()
    ) {
      return null;
    }
    return buildPoPropertyWorkspaceSegments(
      propertyWorkspaceTask.poNumber.trim(),
      propertyWorkspaceDeedLabel || undefined,
    );
  }, [
    onCaseStudyWorkspace,
    onPropertyAppraisalWorkspace,
    propertyWorkspaceTask,
    propertyWorkspaceDeedLabel,
  ]);

  const poChrome = useMemo(
    () => (pathname ? resolvePoChrome(pathname) : null),
    [pathname],
  );
  const taskQuery = searchParams.get("task");
  const opsTaskDeepLink =
    currentPage === "operations-tasks" ? taskQuery?.trim() || null : null;
  const { data: operationsTasks } = useQuery({
    queryKey: prototypeKeys.operationsTasks(),
    queryFn: () => loadOperationsTasks(),
    enabled: Boolean(opsTaskDeepLink),
    staleTime: 30_000,
  });
  const opsTaskTitle = useMemo(() => {
    if (!opsTaskDeepLink || !operationsTasks?.length) return undefined;
    const id = decodeTaskParam(opsTaskDeepLink);
    const task =
      operationsTasks.find((t) => t.id === id) ??
      operationsTasks.find((t) => t.displayId === id);
    return task?.title?.trim() || undefined;
  }, [opsTaskDeepLink, operationsTasks]);

  const myTasksChrome = useMemo(
    () =>
      pathname
        ? resolveMyTasksChrome(
            pathname,
            currentPage === "active-primary-data" ||
              currentPage === "all-transactions" ||
              currentPage === "active-distribution" ||
              currentPage === "active-case-study" ||
              currentPage === "operations-tasks" ||
              onCaseStudyWorkspace ||
              onActiveSurveyRoute ||
              onPropertyAppraisalWorkspace ||
              onFieldInspectionWorkspace ||
              isPartyTaskPage(currentPage)
              ? onCaseStudyWorkspace
                ? caseStudyTaskId
                : onActiveSurveyRoute
                  ? activeSurveyTaskId
                  : onPropertyAppraisalWorkspace
                    ? propertyAppraisalTaskId
                    : onFieldInspectionWorkspace
                      ? fieldInspectionTaskId
                      : taskQuery
              : null,
            {
              ...(onCaseStudyWorkspace || onPropertyAppraisalWorkspace
                ? { deedLabel: caseStudyDeedLabel }
                : {}),
              ...(opsTaskDeepLink ? { opsTaskTitle } : {}),
            },
          )
        : null,
    [
      pathname,
      currentPage,
      taskQuery,
      onCaseStudyWorkspace,
      onActiveSurveyRoute,
      onPropertyAppraisalWorkspace,
      onFieldInspectionWorkspace,
      caseStudyTaskId,
      activeSurveyTaskId,
      propertyAppraisalTaskId,
      fieldInspectionTaskId,
      caseStudyDeedLabel,
      opsTaskDeepLink,
      opsTaskTitle,
    ],
  );
  const inPoSection = pathname?.startsWith("/po") ?? false;
  const onTaskWork =
    (currentPage === "active-primary-data" && Boolean(taskQuery)) ||
    (currentPage === "all-transactions" && Boolean(taskQuery)) ||
    (currentPage === "active-distribution" && Boolean(taskQuery)) ||
    onActiveSurveyRoute ||
    onPropertyAppraisalWorkspace ||
    onFieldInspectionWorkspace ||
    (pathname ? isPartyTaskWorkPath(pathname) && Boolean(taskQuery) : false);

  const def = ROLES[role];
  const chipName = sessionUser?.displayName?.trim() || def.name;

  const handleLogout = useCallback(async (): Promise<void> => {
    const session = getAuthSession();
    const userId = session?.user?.id;
    if (userId) {
      try {
        const pending = await Promise.race([
          countPendingOutbox(userId),
          new Promise<number>((resolve) => {
            window.setTimeout(() => resolve(0), 800);
          }),
        ]);
        if (pending > 0) {
          const proceed = window.confirm(
            `هناك ${pending} عناصر لم تُرفع بعد. أبقِ النظام مفتوحاً حتى تكتمل.\nهل تريد تسجيل الخروج على أي حال؟`,
          );
          if (!proceed) return;
        }
      } catch {
        /* continue logout */
      }
    }

    // Network / push / IDB must not block leaving — fire best-effort then navigate hard.
    void unsubscribeFromPushSafe();
    if (session?.refreshToken) {
      void revokeAuthSession(session.refreshToken);
    }
    if (userId) {
      void (async () => {
        try {
          await Promise.race([
            (async () => {
              await purgeOfflineData(userId, "logout");
              await closeOfflineDb();
            })(),
            new Promise<void>((resolve) => {
              window.setTimeout(resolve, 2000);
            }),
          ]);
        } catch {
          /* ignore */
        }
      })();
    }

    clearAuthSession();
    queryClient.clear();
    // Soft router.replace can stall behind hung fetches on localhost.
    window.location.assign("/login");
  }, [queryClient]);

  // These are reset to false at the start of each render, which is correct —
  // they track sidebar insertion within the current JSX pass only.
  // Declared outside JSX (not inside .map) so React Strict Mode double-invoking
  // the render function still gives the right result.
  let activeTransactionsInserted =
    insertActiveTxAtNavStart && showActiveTransactionsGroup;
  let generalNavInserted = false;
  let orphanScreensInserted = false;
  let financialNavInserted = false;

  const onActiveSurveyPropertyDetail = onActiveSurveyEntry;
  // Keys: leaf-only breadcrumb for envelope / fees subviews.
  const keysChrome = useMemo(() => {
    if (currentPage !== "keys") return null;
    const envelope = searchParams.get("envelope")?.trim();
    if (envelope) {
      return {
        title: "ملف الظرف",
        breadcrumb: "ملف الظرف",
      };
    }
    if (searchParams.get("tab") === "fees") {
      return {
        title: "تقرير الأتعاب",
        breadcrumb: "تقرير الأتعاب",
      };
    }
    return null;
  }, [currentPage, searchParams]);

  const orgSettingsChrome = useMemo(() => {
    if (currentPage !== "organization-settings") return null;
    const title = organizationSettingsLeafTitle(searchParams.get("tab"));
    return { title, breadcrumb: title };
  }, [currentPage, searchParams]);

  // Engineering fees under active-transactions — same parent group as other active queues.
  const engineeringFeesCrumb =
    currentPage === "party-fees" && isPartyFeesUnderActiveTransactions(role)
      ? slashTrailToSegments("المعاملات النشطة / فوترة الأتعاب")
      : null;

  const financeLeaf =
    currentPage === "financial" ? financeLeafForArea(financeArea) : null;
  const financialCrumb = financeLeaf
    ? slashTrailToSegments(financeLeaf.crumb)
    : null;

  const breadcrumbSegments =
    poChrome?.segments ??
    caseStudyBreadcrumb ??
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

  const resolvedPageTitle =
    poChrome?.title ??
    myTasksChrome?.title ??
    keysChrome?.title ??
    orgSettingsChrome?.title ??
    financeLeaf?.pageTitle ??
    (currentPage === "party-fees" && isPartyFeesUnderActiveTransactions(role)
      ? "فوترة الأتعاب"
      : PAGE_TITLES[currentPage]) ??
    "";

  // Full trail from PAGE_BREADCRUMB / chrome (including current page label),
  // matching HTML setHeader(title, crumb([…, current])).
  const displayBreadcrumbSegments = breadcrumbSegments ?? [];

  return (
    <div id="app" className="flex h-full max-h-dvh min-h-0 overflow-hidden bg-bg">
      {/* Side nav stays for inspection + government review (mobile off-canvas). */}
      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-label="إغلاق القائمة"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}
        <div
          id="sidebar"
          data-collapsed={desktopRail ? "true" : undefined}
          className={cn(
            "group/sidebar flex h-full min-h-0 w-sidebar shrink-0 flex-col overflow-hidden border-s border-white/[0.06] bg-sidebar text-white [color-scheme:dark]",
            "transition-[width] duration-200 ease-out",
            "max-lg:fixed max-lg:inset-y-0 max-lg:start-0 max-lg:z-50 max-lg:w-sidebar max-lg:shadow-xl max-lg:transition-transform max-lg:duration-200 max-lg:ease-out",
            "max-lg:pt-[env(safe-area-inset-top)] max-lg:pb-[env(safe-area-inset-bottom)]",
            /* Off-canvas: start edge — LTR slides left, RTL slides right. */
            mobileNavOpen
              ? "max-lg:translate-x-0"
              : "max-lg:pointer-events-none max-lg:ltr:-translate-x-full max-lg:rtl:translate-x-full",
            "lg:translate-x-0 lg:pointer-events-auto",
            desktopRail && "lg:w-sidebar-collapsed",
          )}
        >
        <div
          className={cn(
            "relative flex items-center justify-center border-b border-white/[0.08] px-[18px] pb-3 pt-5",
            desktopRail && "lg:px-2 lg:pb-3 lg:pt-4",
          )}
        >
          <EjadaLogo
            className={cn(
              "h-auto w-[155px] max-w-full transition-[width] duration-200",
              desktopRail && "lg:w-11",
            )}
          />
          <button
            type="button"
            className="absolute end-2 top-2 flex size-9 shrink-0 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="إغلاق القائمة"
            onClick={() => setMobileNavOpen(false)}
          >
            <TopbarSvgIcon>
              <CloseIcon />
            </TopbarSvgIcon>
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <nav
            id="nav"
            className={cn(
              "min-h-0 flex-1 overflow-y-auto px-3 pb-[22px] pt-1.5",
              desktopRail && "lg:px-1.5",
            )}
            aria-label="التنقل الرئيسي"
          >
          {insertActiveTxAtNavStart && showActiveTransactionsGroup ? (
            <ActiveTransactionsNavDropdown
              key="active-tx-dropdown-start"
              items={activeTransactionItems}
              currentPage={currentPage}
              onTaskWork={onTaskWork}
              onCaseStudyWorkspace={onCaseStudyWorkspace}
              onPrefetch={prefetchPage}
              badges={activeTxBadges}
              role={role}
              rail={desktopRail}
            />
          ) : null}
          {navRuns.map((run, ri) => {
            const blocks: React.ReactNode[] = [];
            blocks.push(
              <div key={`run-${ri}`}>
                {run.label ? (
                  <div
                    className={cn(
                      "px-3 pb-1.5 pt-2 text-[11px] font-bold tracking-[0.03em] text-[#6f7b90]",
                      desktopRail && "lg:hidden",
                    )}
                  >
                    {run.label}
                  </div>
                ) : null}
                {run.label && desktopRail ? (
                  <div
                    className="mx-auto my-1.5 hidden h-px w-6 bg-white/10 lg:block"
                    aria-hidden
                  />
                ) : null}
                {run.items.map((item) => {
                  const nodes: React.ReactNode[] = [];
                  nodes.push(
                    <NavRow
                      key={item.id}
                      item={item}
                      active={
                        currentPage === item.id ||
                        (item.id === "po" && inPoSection)
                      }
                      onPrefetch={prefetchPage}
                      badgeCount={
                        item.id === "failures" ? failuresNavBadge : undefined
                      }
                      rail={desktopRail}
                    />,
                  );
                  // المالية وبوابات الأطراف — مباشرة تحت «المعاملات المعلقة»
                  if (
                    item.id === "suspended-transactions" &&
                    showFinancialGroup &&
                    !financialNavInserted
                  ) {
                    // eslint-disable-next-line react-hooks/immutability -- render-local marker used only within this render pass.
                    financialNavInserted = true;
                    nodes.push(
                      <FinanceHtmlNav
                        key="finance-html-nav"
                        currentPage={currentPage}
                        activeArea={financeArea}
                        badges={financeNavBadges}
                        rail={desktopRail}
                      />,
                    );
                  }
                  const shouldInsertGeneral =
                    !generalNavInserted &&
                    showGeneralGroup &&
                    run.items[run.items.length - 1]?.id === item.id &&
                    ri === navRuns.length - 1;
                  if (shouldInsertGeneral) {
                    generalNavInserted = true;
                    nodes.push(
                      <div
                        key="general-grp"
                        className={cn(
                          "px-3 pb-1.5 pt-2 text-[11px] font-bold tracking-[0.03em] text-[#6f7b90]",
                          desktopRail && "lg:hidden",
                        )}
                      >
                        عام
                      </div>,
                      desktopRail ? (
                        <div
                          key="general-grp-rail-sep"
                          className="mx-auto my-1.5 hidden h-px w-6 bg-white/10 lg:block"
                          aria-hidden
                        />
                      ) : null,
                      <SystemSettingsNavDropdown
                        key="system-settings-dropdown"
                        tree={settingsNavTree}
                        currentPage={currentPage}
                        search={searchParams.toString()}
                        onPrefetch={prefetchPage}
                        role={role}
                        rail={desktopRail}
                      />,
                    );
                    if (showOrphanScreensGroup) {
                      orphanScreensInserted = true;
                      nodes.push(
                        <OrphanScreensNavDropdown
                          key="orphan-screens-dropdown"
                          items={orphanScreenItems}
                          currentPage={currentPage}
                          onPrefetch={prefetchPage}
                          rail={desktopRail}
                        />,
                      );
                    }
                  }
                  const shouldInsertActiveTx =
                    !activeTransactionsInserted &&
                    showActiveTransactionsGroup &&
                    ((activeTxInsertAnchor && item.id === activeTxInsertAnchor) ||
                      (!activeTxInsertAnchor &&
                        activeTxAnchorId &&
                        item.id === activeTxAnchorId));
                  if (shouldInsertActiveTx) {
                    activeTransactionsInserted = true;
                    nodes.push(
                      <ActiveTransactionsNavDropdown
                        key="active-tx-dropdown"
                        items={activeTransactionItems}
                        currentPage={currentPage}
                        onTaskWork={onTaskWork}
                        onCaseStudyWorkspace={onCaseStudyWorkspace}
                        onPrefetch={prefetchPage}
                        badges={activeTxBadges}
                        role={role}
                        rail={desktopRail}
                      />,
                    );
                  }
                  return nodes;
                })}
              </div>,
            );
            return blocks;
          })}
          {!activeTransactionsInserted && showActiveTransactionsGroup ? (
            <ActiveTransactionsNavDropdown
              key="active-tx-dropdown-fallback"
              items={activeTransactionItems}
              currentPage={currentPage}
              onTaskWork={onTaskWork}
              onCaseStudyWorkspace={onCaseStudyWorkspace}
              onPrefetch={prefetchPage}
              badges={activeTxBadges}
              role={role}
              rail={desktopRail}
            />
          ) : null}
          {!financialNavInserted && showFinancialGroup ? (
            <FinanceHtmlNav
              key="finance-html-nav-fallback"
              currentPage={currentPage}
              activeArea={financeArea}
              badges={financeNavBadges}
              rail={desktopRail}
            />
          ) : null}
          {!generalNavInserted && showGeneralGroup ? (
            <>
              <div
                key="general-grp-fallback"
                className={cn(
                  "px-3 pb-1.5 pt-2 text-[11px] font-bold tracking-[0.03em] text-[#6f7b90]",
                  desktopRail && "lg:hidden",
                )}
              >
                عام
              </div>
              {desktopRail ? (
                <div
                  className="mx-auto my-1.5 hidden h-px w-6 bg-white/10 lg:block"
                  aria-hidden
                />
              ) : null}
              <SystemSettingsNavDropdown
                key="system-settings-dropdown-fallback"
                tree={settingsNavTree}
                currentPage={currentPage}
                search={searchParams.toString()}
                onPrefetch={prefetchPage}
                role={role}
                rail={desktopRail}
              />
            </>
          ) : null}
          {!orphanScreensInserted && showOrphanScreensGroup ? (
            <OrphanScreensNavDropdown
              key="orphan-screens-dropdown-fallback"
              items={orphanScreenItems}
              currentPage={currentPage}
              onPrefetch={prefetchPage}
              rail={desktopRail}
            />
          ) : null}
          </nav>
        </div>
      </div>
      <div id="main" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg">
        {/* Mobile nav access when party work hides the full topbar. */}
        {hideShellTopbar ? (
          <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] lg:hidden">
            <button
              type="button"
              className={cn(mobileTopbarIconBtn, "text-text-2")}
              aria-label="فتح القائمة"
              onClick={() => setMobileNavOpen(true)}
            >
              <TopbarSvgIcon>
                <MenuIcon />
              </TopbarSvgIcon>
            </button>
            <span className="truncate text-[13px] font-bold text-heading">
              {resolvedPageTitle || "مساحة العمل"}
            </span>
          </div>
        ) : null}
        {/* مساحة عمل المعاينة: الشريط (بمسار التنقل) يبقى على الشاشات الكبيرة؛ يُخفى على الجوال حيث بطاقة المهمة هي الرأس. */}
        <div
          id="topbar"
          className={cn(
            "flex min-h-topbar shrink-0 items-center justify-between gap-2 border-b-[0.5px] border-border bg-surface px-4 py-3.5 pt-[max(0.875rem,env(safe-area-inset-top))] sm:gap-3 sm:px-[30px]",
            hideShellTopbar && "max-lg:hidden",
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <button
              type="button"
              className={cn(mobileTopbarIconBtn, "text-text-2")}
              aria-label="فتح القائمة"
              onClick={() => setMobileNavOpen(true)}
            >
              <TopbarSvgIcon>
                <MenuIcon />
              </TopbarSvgIcon>
            </button>
            <button
              type="button"
              className={cn(topbarActionIconBtn, "hidden text-text-2 lg:inline-flex")}
              aria-label={desktopRail ? "توسيع القائمة الجانبية" : "طي القائمة الجانبية"}
              aria-pressed={desktopRail}
              title={desktopRail ? "توسيع القائمة" : "طي القائمة"}
              onClick={() => setSidebarCollapsed((v) => !v)}
            >
              <TopbarSvgIcon>
                <SidebarPanelsIcon />
              </TopbarSvgIcon>
            </button>
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
              <AppBreadcrumb
                segments={displayBreadcrumbSegments}
                className="max-lg:min-w-0 max-lg:flex-1 max-lg:flex-nowrap max-lg:overflow-x-auto max-lg:[&::-webkit-scrollbar]:hidden"
              />
              {!onActiveSurveyPropertyDetail
                ? (() => {
                    if (!resolvedPageTitle && !poChrome?.titlePo) return null;
                    return (
                      <h1
                        className="mt-1 text-[20px] font-extrabold leading-none tracking-[-0.01em] text-heading max-sm:hidden"
                        id="page-title"
                      >
                        {poChrome?.titlePo ? (
                          <span className="inline-flex flex-row flex-wrap items-baseline gap-[0.4em]">
                            <span className="[unicode-bidi:embed]">
                              {poChrome.title}
                            </span>
                            <PoNumber value={poChrome.titlePo} />
                          </span>
                        ) : (
                          resolvedPageTitle
                        )}
                      </h1>
                    );
                  })()
                : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <OfflineSyncCoordinator />
            <NotificationCenter />
            <div className="h-[26px] w-px shrink-0 bg-border-md max-lg:hidden" aria-hidden />
            {onActiveSurveyPropertyDetail ? (
              <EngineeringSurveyTopbarActions />
            ) : null}
            <ProfileMenu
              chipName={chipName}
              initials={def.init}
              dept={def.dept}
              currentPage={currentPage}
              onLogout={handleLogout}
            />
          </div>
        </div>
        <div
          id="content"
          ref={contentRef}
          data-workspace-scroll={
            hideShellTopbar ? "locked" : undefined
          }
          className={cn(
            /* Block layout so tall list pages scroll on #content; workspaces use flex + inner scroll. */
            "relative min-h-0 min-w-0 flex-1 bg-bg p-0",
            hideShellTopbar || currentPage === "property-map"
              ? /* Party work page owns scroll (back/title card inside). */
                "flex flex-col overflow-hidden"
              : "overflow-x-hidden overflow-y-auto max-lg:pb-[env(safe-area-inset-bottom)]",
          )}
        >
          {!contentScrollLocked ? (
            <PullToRefreshIndicator
              pull={ptrPull}
              refreshing={ptrRefreshing}
              threshold={ptrThreshold}
            />
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}
