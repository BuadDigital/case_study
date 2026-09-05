"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { prefetchPrototypePage } from "@/lib/query/app-data-queries";
import type { PageId } from "@platform/types";
import { ROLES } from "@platform/app-shared/app-data/constants";
import { activeTransactionNavForRole } from "@platform/app-shared/app-data/active-transactions";
import { settingsNavTreeForRole } from "@platform/app-shared/app-data/system-settings-nav";
import { AppBreadcrumb } from "@/components/views/AppBreadcrumb";
import { NotificationCenter } from "@/components/NotificationCenter";
import { OfflineSyncCoordinator } from "@/components/OfflineSyncCoordinator";
import {
  EngineeringSurveyTopbarActions,
} from "@engineering-office/mfe/components/EngineeringSurveyTopbarActions";
import {
  parseFinanceNavArea,
  showFinancialNavGroup,
} from "@platform/app-shared/app-data/financial-nav";
import { useFinanceNavBadges } from "@/lib/query/use-finance-nav-badges";
import { useActiveTransactionNavBadges } from "@/lib/query/use-active-transaction-nav-badges";
import { useFailuresNavBadge } from "@/lib/query/use-failures-nav-badge";
import { PoNumber, cn } from "@platform/ui-kit";
import { getAuthSession } from "@platform/auth-client";
import { PullToRefreshIndicator, usePullToRefresh } from "@/components/PullToRefresh";
import { useAppDataRefresh } from "@/hooks/useAppDataRefresh";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import { useAppShellLogout } from "@/hooks/useAppShellLogout";
import { useAppShellChrome } from "@/hooks/useAppShellChrome";
import {
  TopbarSvgIcon,
  MenuIcon,
  SidebarPanelsIcon,
  mobileTopbarIconBtn,
  topbarActionIconBtn,
} from "./AppShellNavPrimitives";
import { ProfileMenu } from "./AppShellProfileMenu";
import { AppShellSidebar, type SidebarNavModel } from "./AppShellSidebar";
import {
  navRunsForRole,
  planSidebarNav,
  resolveActiveTxInsertion,
  resolveShellRoute,
} from "./app-shell-nav-state";
import { PAGE_CHUNK_PRELOAD } from "./AppPageView";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { role, rolePages } = useAppAccess();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useSidebarCollapsed();
  const contentRef = useRef<HTMLDivElement>(null);
  const { refresh } = useAppDataRefresh();
  // Read sessionStorage once per render cycle, not multiple times.
  const sessionUser = useMemo(() => getAuthSession()?.user, []);
  const searchParams = useSearchParams();

  const route = useMemo(() => resolveShellRoute(pathname), [pathname]);
  const { currentPage, hideShellTopbar, contentScrollLocked } = route;

  const settingsNavTree = useMemo(
    () => settingsNavTreeForRole(rolePages, role),
    [rolePages, role],
  );
  const navRuns = useMemo(() => navRunsForRole(rolePages, role), [rolePages, role]);
  const activeTransactionItems = useMemo(
    () => activeTransactionNavForRole(rolePages, role),
    [rolePages, role],
  );
  const activeTxInsertion = useMemo(
    () => resolveActiveTxInsertion(rolePages, role, navRuns),
    [rolePages, role, navRuns],
  );
  const sidebarPlan = useMemo(
    () =>
      planSidebarNav(navRuns, {
        activeTx: activeTxInsertion,
        showActiveTx: activeTransactionItems.length > 0,
        showFinancial: showFinancialNavGroup(rolePages),
        showGeneral: settingsNavTree.some((node) => node.type !== "divider"),
      }),
    [navRuns, activeTxInsertion, activeTransactionItems, rolePages, settingsNavTree],
  );

  const failuresNavBadge = useFailuresNavBadge();
  const financeNavBadges = useFinanceNavBadges();
  const activeTxBadges = useActiveTransactionNavBadges().badges;
  const financeArea = parseFinanceNavArea(searchParams.get("area"));

  const prefetchPage = useMemo(
    () => (page: PageId) => {
      void PAGE_CHUNK_PRELOAD[page]?.();
      prefetchPrototypePage(queryClient, page);
    },
    [queryClient],
  );

  const silentRefresh = useCallback(
    () => refresh({ silent: true }),
    [refresh],
  );
  const {
    pull: ptrPull,
    refreshing: ptrRefreshing,
    threshold: ptrThreshold,
  } = usePullToRefresh(contentRef, silentRefresh, !contentScrollLocked);

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

  const desktopRail = sidebarCollapsed;

  const { breadcrumbSegments, title: resolvedPageTitle, poChrome, onTaskWork } =
    useAppShellChrome({
      pathname,
      route,
      searchParams,
      role,
      financeArea,
      queryClient,
    });

  const def = ROLES[role];
  const chipName = sessionUser?.displayName?.trim() || def.name;
  const handleLogout = useAppShellLogout();
  const onActiveSurveyPropertyDetail = route.onActiveSurveyEntry;

  const sidebarNav: SidebarNavModel = {
    plan: sidebarPlan,
    currentPage,
    inPoSection: route.inPoSection,
    onTaskWork,
    onCaseStudyWorkspace: route.onCaseStudyWorkspace,
    role,
    prefetchPage,
    activeTransactionItems,
    activeTxBadges,
    failuresNavBadge,
    settingsNavTree,
    search: searchParams.toString(),
    financeArea,
    financeNavBadges,
  };

  return (
    <div id="app" className="flex h-full max-h-dvh min-h-0 overflow-hidden bg-bg">
      <AppShellSidebar
        mobileNavOpen={mobileNavOpen}
        onCloseMobileNav={() => setMobileNavOpen(false)}
        desktopRail={desktopRail}
        nav={sidebarNav}
      />
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
        {/* Inspection work area: topbar (with breadcrumb) stays on large screens; hidden on mobile where the task card is the header. */}
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
                segments={breadcrumbSegments}
                className="max-lg:min-w-0 max-lg:flex-1 max-lg:flex-nowrap max-lg:overflow-x-auto max-lg:[&::-webkit-scrollbar]:hidden"
              />
              {!onActiveSurveyPropertyDetail &&
              (resolvedPageTitle || poChrome?.titlePo) ? (
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
              ) : null}
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
