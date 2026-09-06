"use client";

import { cn } from "@platform/ui-kit";
import type { PageId, RoleId } from "@platform/types";
import type { ActiveTransactionNavItem } from "@platform/app-shared/app-data/active-transactions";
import type { SettingsNavTreeNode } from "@platform/app-shared/app-data/system-settings-nav";
import type { FinanceNavArea } from "@platform/app-shared/app-data/financial-nav";
import { EjadaLogo } from "@/components/views/EjadaLogo";
import {
  CloseIcon,
  NavRailSeparator,
  TopbarSvgIcon,
  navGroupLabelClasses,
} from "./AppShellNavPrimitives";
import {
  ActiveTransactionsNavDropdown,
  FinanceHtmlNav,
  GeneralSettingsNavGroup,
  NavRow,
} from "./AppShellNavParts";
import {
  isNavRowActive,
  type SidebarInsert,
  type SidebarNavPlan,
} from "./app-shell-nav-state";

/** Everything the sidebar needs to render the plan — built once in `AppShell`. */
export type SidebarNavModel = {
  plan: SidebarNavPlan;
  currentPage: PageId;
  inPoSection: boolean;
  onTaskWork: boolean;
  onCaseStudyWorkspace: boolean;
  role: RoleId;
  prefetchPage: (page: PageId) => void;
  activeTransactionItems: ActiveTransactionNavItem[];
  activeTxBadges: Partial<Record<PageId, number>>;
  failuresNavBadge: number | undefined;
  settingsNavTree: SettingsNavTreeNode[];
  /** `searchParams.toString()` — settings leaf activity depends on the query. */
  search: string;
  financeArea: FinanceNavArea;
  financeNavBadges: Partial<Record<FinanceNavArea, number>>;
};

export function AppShellSidebar({
  mobileNavOpen,
  onCloseMobileNav,
  desktopRail,
  nav,
}: {
  mobileNavOpen: boolean;
  onCloseMobileNav: () => void;
  desktopRail: boolean;
  nav: SidebarNavModel;
}) {
  const renderInsert = (kind: SidebarInsert, keySuffix: string) => {
    if (kind === "active-tx") {
      return (
        <ActiveTransactionsNavDropdown
          key={`active-tx-dropdown${keySuffix}`}
          items={nav.activeTransactionItems}
          currentPage={nav.currentPage}
          onTaskWork={nav.onTaskWork}
          onCaseStudyWorkspace={nav.onCaseStudyWorkspace}
          onPrefetch={nav.prefetchPage}
          badges={nav.activeTxBadges}
          role={nav.role}
          rail={desktopRail}
        />
      );
    }
    if (kind === "finance") {
      return (
        <FinanceHtmlNav
          key={`finance-html-nav${keySuffix}`}
          currentPage={nav.currentPage}
          activeArea={nav.financeArea}
          badges={nav.financeNavBadges}
          rail={desktopRail}
        />
      );
    }
    return (
      <GeneralSettingsNavGroup
        key={`system-settings-dropdown${keySuffix}`}
        tree={nav.settingsNavTree}
        currentPage={nav.currentPage}
        search={nav.search}
        onPrefetch={nav.prefetchPage}
        role={nav.role}
        rail={desktopRail}
      />
    );
  };

  return (
    <>
      {/* Side nav stays for inspection + government review (mobile off-canvas). */}
      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-label="إغلاق القائمة"
          onClick={onCloseMobileNav}
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
            onClick={onCloseMobileNav}
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
            {nav.plan.leading.map((kind) => renderInsert(kind, "-start"))}
            {nav.plan.runs.map((run, ri) => (
              <div key={`run-${ri}`}>
                {run.label ? (
                  <div className={navGroupLabelClasses(desktopRail)}>{run.label}</div>
                ) : null}
                {run.label && desktopRail ? <NavRailSeparator /> : null}
                {run.rows.map(({ item, after }) => [
                  <NavRow
                    key={item.id}
                    item={item}
                    active={isNavRowActive(item.id, nav.currentPage, nav.inPoSection)}
                    onPrefetch={nav.prefetchPage}
                    badgeCount={
                      item.id === "failures" ? nav.failuresNavBadge : undefined
                    }
                    rail={desktopRail}
                  />,
                  ...after.map((kind) => renderInsert(kind, "")),
                ])}
              </div>
            ))}
            {nav.plan.trailing.map((kind) => renderInsert(kind, "-fallback"))}
          </nav>
        </div>
      </div>
    </>
  );
}
