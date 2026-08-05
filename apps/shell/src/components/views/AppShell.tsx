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
  SYSTEM_FIELDS_GROUP,
  SYSTEM_FIELDS_GROUP_ICON,
  systemSettingsPrimaryNavForRole,
  systemSettingsFieldsNavForRole,
  isInSystemSettingsSection,
  type SystemSettingsNavItem,
  type SystemFieldsNavItem,
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
  PARTY_PORTAL_NAV_LEAVES,
  PARTY_PORTALS_GROUP,
  financeLeafForArea,
  financialHref,
  isFinanceCoreArea,
  isInFinancialSection,
  isPartyPortalArea,
  parseFinanceNavArea,
  showFinancialNavGroup,
  type FinanceNavArea,
} from "@platform/app-shared/prototype/financial-nav";
import { useFinanceNavBadges } from "@/lib/query/use-finance-nav-badges";
import { useActiveTransactionNavBadges } from "@/lib/query/use-active-transaction-nav-badges";
import { useFailuresNavBadge } from "@/lib/query/use-failures-nav-badge";
import { PoNumber } from "@case-study/mfe/components/ui/PoNumber";
import { cn } from "@platform/design-system";
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

function TopbarSvgIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex size-5 shrink-0 items-center justify-center [&_svg]:size-5">
      {children}
    </span>
  );
}

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

/** Design ref: topbar toggle — collapsed icon-rail sidebar. */
function SidebarPanelsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M9 4v16" />
    </svg>
  );
}

const SIDEBAR_COLLAPSED_KEY = "ejada.sidebar.collapsed";

function readSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17l5-5-5-5M15 12H3" />
    </svg>
  );
}

const mobileTopbarIconBtn =
  "flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-surface text-text shadow-[0_1px_2px_rgba(15,52,96,0.06)] transition-colors hover:bg-surface-2 active:scale-[0.98] lg:hidden";

const topbarActionIconBtn =
  "flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-surface text-text shadow-[0_1px_2px_rgba(15,52,96,0.06)] transition-colors hover:bg-surface-2 active:scale-[0.98]";

function navItemClasses({
  active = false,
  sub = false,
  locked = false,
  toggle = false,
  rail = false,
}: {
  active?: boolean;
  sub?: boolean;
  locked?: boolean;
  toggle?: boolean;
  /** Desktop icon-rail mode (labels hidden via group on #sidebar). */
  rail?: boolean;
} = {}) {
  return cn(
    "relative flex cursor-pointer items-center gap-[11px] rounded-lg px-3 py-[9px] text-[13.5px] font-medium text-[#aeb6c4] no-underline outline-none transition-[background,color] duration-150",
    "hover:bg-white/[0.06] hover:text-white",
    "[&>svg]:size-[18px] [&>svg]:shrink-0",
    sub && "gap-[9px] ps-8 text-[12.5px] [&>svg]:size-3.5",
    toggle && "w-full border-0 bg-transparent font-inherit",
    rail &&
      "lg:justify-center lg:gap-0 lg:px-0 lg:py-2.5 lg:before:hidden",
    rail && sub && "lg:ps-0",
    active &&
      "bg-[color-mix(in_srgb,var(--gold)_18%,transparent)] font-bold text-gold-2 before:absolute before:inset-y-0 before:start-0 before:w-[3px] before:rounded-e-sm before:bg-gold before:content-['']",
    locked && "cursor-default opacity-35",
  );
}

function navBadgeClasses(rail = false) {
  return cn(
    "ms-auto inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-danger px-[5px] text-[10px] font-semibold text-white",
    rail &&
      "lg:absolute lg:end-0.5 lg:top-0.5 lg:ms-0 lg:h-[16px] lg:min-w-[16px] lg:px-[4px] lg:text-[9px]",
  );
}

function navLabelClasses(rail = false) {
  return cn(rail && "lg:sr-only");
}

function navChevronClasses(rail = false) {
  return cn(rail && "lg:hidden");
}

type NavRun = { label: string | null; items: (typeof NAV)[number][] };

// Computed once at module load — NAV is a constant so this never changes.
const ALL_NAV_RUNS: NavRun[] = (() => {
  const runs: NavRun[] = [];
  let lastGrp: string | null = null;
  let cur: NavRun | null = null;
  for (const item of NAV) {
    if (item.grp && item.grp !== lastGrp) {
      lastGrp = item.grp;
      cur = { label: item.grp, items: [] };
      runs.push(cur);
      cur.items.push(item);
    } else if (!item.grp && lastGrp) {
      lastGrp = null;
      cur = { label: null, items: [] };
      runs.push(cur);
      cur.items.push(item);
    } else {
      if (!cur) { cur = { label: null, items: [] }; runs.push(cur); }
      cur.items.push(item);
    }
  }
  return runs;
})();

function navRunsForRole(rolePages: PageId[], role: RoleId): NavRun[] {
  return ALL_NAV_RUNS
    .map((run) => {
      let items = run.items.filter((item) => rolePages.includes(item.id));
      if (role === "engineering-office" || role === "field-inspector") {
        items = sortPartyFeesBeforeFailures(items);
      }
      return { ...run, items };
    })
    .filter((run) => run.items.length > 0);
}

/** أطراف المعاملة — الاتعاب ثم التعذرات تحتها مباشرة. */
function sortPartyFeesBeforeFailures(
  items: (typeof NAV)[number][],
): (typeof NAV)[number][] {
  const order: PageId[] = ["party-fees", "failures"];
  return [...items].sort((a, b) => {
    const ai = order.indexOf(a.id);
    const bi = order.indexOf(b.id);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return -1;
    if (bi === -1) return 1;
    return ai - bi;
  });
}

function NavRow({
  item,
  active,
  onPrefetch,
  badgeCount,
  rail = false,
}: {
  item: (typeof NAV)[number];
  active: boolean;
  onPrefetch: (page: PageId) => void;
  badgeCount?: number;
  rail?: boolean;
}) {
  const badgeValue =
    badgeCount != null && badgeCount > 0
      ? String(badgeCount)
      : item.badge;
  const badge = badgeValue ? (
    <span className={navBadgeClasses(rail)}>{badgeValue}</span>
  ) : null;
  return (
    <Link
      href={`/${item.id}`}
      className={navItemClasses({
        active,
        rail,
      })}
      title={rail ? item.label : undefined}
      prefetch
      onMouseEnter={() => onPrefetch(item.id)}
      onFocus={() => onPrefetch(item.id)}
    >
      <NavIcon d={item.icon} size={16} />
      <span className={navLabelClasses(rail)}>{item.label}</span>
      {badge}
    </Link>
  );
}

function ActiveTransactionNavRow({
  id,
  label,
  icon,
  available,
  badgeCount,
  active,
  onPrefetch,
  rail = false,
}: {
  id: PageId;
  label: string;
  icon: string;
  available: boolean;
  badgeCount?: number;
  active: boolean;
  onPrefetch: (page: PageId) => void;
  rail?: boolean;
}) {
  const cls = navItemClasses({
    active,
    sub: !rail,
    locked: !available,
    rail,
  });
  const inner = (
    <>
      <NavIcon d={icon} size={rail ? 16 : 12} />
      <span className={navLabelClasses(rail)}>{label}</span>
      {badgeCount != null && badgeCount > 0 ? (
        <span className={navBadgeClasses(rail)}>{badgeCount}</span>
      ) : !available ? (
        <span className={cn(navBadgeClasses(), navLabelClasses(rail), "opacity-70")}>
          بدون صلاحية
        </span>
      ) : null}
    </>
  );
  if (!available) {
    return (
      <div className={cls} title={rail ? label : undefined}>
        {inner}
      </div>
    );
  }
  return (
    <Link
      href={`/${id}`}
      className={cls}
      title={rail ? label : undefined}
      prefetch
      onMouseEnter={() => onPrefetch(id)}
      onFocus={() => onPrefetch(id)}
    >
      {inner}
    </Link>
  );
}

function NavDropdownChevron({ open, rail = false }: { open: boolean; rail?: boolean }) {
  return (
    <svg
      className={cn(
        "ms-auto shrink-0 opacity-45 transition-transform duration-200 ease-in-out",
        open && "-rotate-90 opacity-70",
        navChevronClasses(rail),
      )}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function NavFlyoutPanel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="absolute end-full top-0 z-[60] me-2 hidden min-w-[210px] rounded-[10px] border border-white/[0.1] bg-sidebar p-2 shadow-lg lg:block"
      role="group"
      aria-label={label}
    >
      <div className="px-2.5 pb-1.5 pt-1 text-[11px] font-bold tracking-[0.03em] text-[#6f7b90]">
        {label}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

/**
 * Finance.html sidebar (حرفياً):
 *   nav-group: المالية
 *   fin-subnav leaves (مهامي · الإيرادات · التكاليف)
 *     — في التطبيق: تحت «المالية والفوترة» لأن navActive/الـ crumbs تشير لها
 *   nav-group: بوابات الأطراف — لتجربة الأثر
 *   nav-item: eng · inspector
 */
function FinanceHtmlNav({
  currentPage,
  activeArea,
  badges,
  rail = false,
}: {
  currentPage: PageId;
  activeArea: FinanceNavArea;
  badges: Partial<Record<FinanceNavArea, number>>;
  rail?: boolean;
}) {
  const inSection = isInFinancialSection(currentPage);
  const onCore = inSection && isFinanceCoreArea(activeArea);
  const onPortal = inSection && isPartyPortalArea(activeArea);
  /** افتح الشجرة عند العمل في مهامي/إيراد/تكاليف فقط — لا على البوابات (مثل HTML) */
  const [open, setOpen] = useState(onCore);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- open/close with route.
    if (onCore) setOpen(true);
    if (onPortal && !rail) setOpen(false);
  }, [onCore, onPortal, rail]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (rail) setOpen(false);
  }, [rail]);

  useEffect(() => {
    if (!open || !rail) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, rail]);

  const finLeaves = () =>
    FINANCIAL_NAV_LEAVES.map((leaf) => {
      const active = inSection && activeArea === leaf.area;
      const count = badges[leaf.area];
      return (
        <Link
          key={leaf.area}
          href={financialHref(leaf.area)}
          className={navItemClasses({
            active,
            sub: true,
            rail,
          })}
          title={rail ? leaf.label : undefined}
          prefetch
        >
          <NavIcon d={leaf.icon} size={rail ? 16 : 14} />
          <span className={navLabelClasses(rail)}>{leaf.label}</span>
          {count != null && count > 0 ? (
            <span className={navBadgeClasses(rail)}>{count}</span>
          ) : null}
        </Link>
      );
    });

  return (
    <div className="my-0.5" ref={rootRef}>
      {/* .nav-group: المالية */}
      <div
        className={cn(
          "px-3 pb-1.5 pt-2 text-[11px] font-bold tracking-[0.04em] text-[#6f7b90]",
          rail && "lg:hidden",
        )}
      >
        {FINANCIAL_GROUP}
      </div>
      {rail ? (
        <div
          className="mx-auto my-1.5 hidden h-px w-6 bg-white/10 lg:block"
          aria-hidden
        />
      ) : null}

      {/* .nav-item toggle: المالية والفوترة */}
      <button
        type="button"
        className={navItemClasses({
          active: onCore,
          toggle: true,
          rail,
        })}
        title={rail ? FINANCIAL_TOGGLE_LABEL : undefined}
        aria-expanded={open}
        aria-controls="nav-financial-leaves"
        onClick={() => setOpen((v) => !v)}
      >
        <NavIcon d={FINANCIAL_GROUP_ICON} size={16} />
        <span className={navLabelClasses(rail)}>{FINANCIAL_TOGGLE_LABEL}</span>
        <NavDropdownChevron open={open} rail={rail} />
      </button>

      {open && !rail ? (
        <div
          id="nav-financial-leaves"
          className="ms-3 flex flex-col border-s border-white/[0.07] py-0.5"
          role="group"
          aria-label={FINANCIAL_TOGGLE_LABEL}
        >
          {finLeaves()}
        </div>
      ) : null}
      {open && rail ? (
        <>
          <div
            id="nav-financial-leaves"
            className="ms-3 flex flex-col border-s border-white/[0.07] py-0.5 lg:hidden"
            role="group"
            aria-label={FINANCIAL_TOGGLE_LABEL}
          >
            {finLeaves()}
          </div>
          <NavFlyoutPanel label={FINANCIAL_TOGGLE_LABEL}>
            {finLeaves()}
          </NavFlyoutPanel>
        </>
      ) : null}

      {/* .nav-group: بوابات – لتجربة الأثر */}
      <div
        className={cn(
          "mt-2 border-t border-white/[0.06] px-3 pb-1.5 pt-3 text-[11px] font-bold tracking-[0.04em] text-[#6f7b90]",
          rail && "lg:mt-1.5 lg:border-0 lg:hidden lg:pt-0",
        )}
      >
        {PARTY_PORTALS_GROUP}
      </div>
      {rail ? (
        <div
          className="mx-auto my-1.5 hidden h-px w-6 bg-white/10 lg:block"
          aria-hidden
        />
      ) : null}

      {PARTY_PORTAL_NAV_LEAVES.map((leaf) => {
        const active = inSection && activeArea === leaf.area;
        const count = badges[leaf.area];
        return (
          <Link
            key={leaf.area}
            href={financialHref(leaf.area)}
            className={navItemClasses({
              active,
              rail,
            })}
            title={rail ? leaf.label : undefined}
            prefetch
          >
            <NavIcon d={leaf.icon} size={16} />
            <span className={navLabelClasses(rail)}>{leaf.label}</span>
            {count != null && count > 0 ? (
              <span className={navBadgeClasses(rail)}>{count}</span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

function ActiveTransactionsNavDropdown({
  items,
  currentPage,
  onTaskWork,
  onCaseStudyWorkspace,
  onPrefetch,
  badges,
  role,
  rail = false,
}: {
  items: ActiveTransactionNavItem[];
  currentPage: PageId;
  onTaskWork: boolean;
  onCaseStudyWorkspace: boolean;
  onPrefetch: (page: PageId) => void;
  badges: Partial<Record<PageId, number>>;
  role: RoleId;
  rail?: boolean;
}) {
  const inSection =
    isInActiveTransactionsSection(currentPage, onTaskWork, role) ||
    onCaseStudyWorkspace;
  const [open, setOpen] = useState(inSection);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-expand the active section when navigation enters it.
    if (inSection && !rail) setOpen(true);
  }, [inSection, rail]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- avoid leftover open flyouts when entering icon-rail.
    if (rail) setOpen(false);
  }, [rail]);

  useEffect(() => {
    if (!open || !rail) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, rail]);

  const childActive = (tx: ActiveTransactionNavItem) =>
    currentPage === tx.id ||
    (tx.id === "active-case-study" && onCaseStudyWorkspace);

  const renderRows = () =>
    items.map((tx) => (
      <ActiveTransactionNavRow
        key={tx.id}
        id={tx.id}
        label={tx.label}
        icon={tx.icon}
        available={tx.available}
        badgeCount={badges[tx.id]}
        active={childActive(tx)}
        onPrefetch={onPrefetch}
      />
    ));

  return (
    <div className="relative my-0.5" ref={rootRef}>
      <button
        type="button"
        className={navItemClasses({
          active: inSection,
          toggle: true,
          rail,
        })}
        title={rail ? ACTIVE_TRANSACTIONS_GROUP : undefined}
        aria-expanded={open}
        aria-controls="nav-active-transactions"
        onClick={() => setOpen((v) => !v)}
      >
        <NavIcon d={ACTIVE_TRANSACTIONS_GROUP_ICON} size={16} />
        <span className={navLabelClasses(rail)}>{ACTIVE_TRANSACTIONS_GROUP}</span>
        <NavDropdownChevron open={open} rail={rail} />
      </button>
      {open && !rail ? (
        <div
          id="nav-active-transactions"
          className="ms-3 flex flex-col border-s border-white/[0.06] py-0.5 pb-1"
          role="group"
          aria-label={ACTIVE_TRANSACTIONS_GROUP}
        >
          {renderRows()}
        </div>
      ) : null}
      {open && rail ? (
        <>
          <div
            id="nav-active-transactions"
            className="ms-3 flex flex-col border-s border-white/[0.06] py-0.5 pb-1 lg:hidden"
            role="group"
            aria-label={ACTIVE_TRANSACTIONS_GROUP}
          >
            {renderRows()}
          </div>
          <NavFlyoutPanel label={ACTIVE_TRANSACTIONS_GROUP}>
            {renderRows()}
          </NavFlyoutPanel>
        </>
      ) : null}
    </div>
  );
}

function SystemSettingsNavDropdown({
  primaryItems,
  fieldsItems,
  currentPage,
  onPrefetch,
  role,
  rail = false,
}: {
  primaryItems: SystemSettingsNavItem[];
  fieldsItems: SystemFieldsNavItem[];
  currentPage: PageId;
  onPrefetch: (page: PageId) => void;
  role: RoleId;
  rail?: boolean;
}) {
  const inSection = isInSystemSettingsSection(currentPage, role);
  const [open, setOpen] = useState(inSection);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-expand when route is under system settings.
    if (inSection && !rail) setOpen(true);
  }, [inSection, rail]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- avoid leftover open flyouts when entering icon-rail.
    if (rail) setOpen(false);
  }, [rail]);

  useEffect(() => {
    if (!open || !rail) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, rail]);

  const renderBody = () => (
    <>
      {primaryItems.map((item) => (
        <ActiveTransactionNavRow
          key={item.id}
          id={item.id}
          label={item.label}
          icon={item.icon}
          available
          active={currentPage === item.id}
          onPrefetch={onPrefetch}
        />
      ))}
      {fieldsItems.length > 0 ? (
        <>
          <div className="mx-2 mb-0.5 mt-1.5 flex items-center gap-1.5 px-2.5 pb-1 pt-1 text-[10px] font-medium tracking-wider text-[#6f7b90]">
            <NavIcon d={SYSTEM_FIELDS_GROUP_ICON} size={11} />
            <span>{SYSTEM_FIELDS_GROUP}</span>
          </div>
          {fieldsItems.map((item) => (
            <ActiveTransactionNavRow
              key={item.id}
              id={item.id}
              label={item.label}
              icon={item.icon}
              available
              active={currentPage === item.id}
              onPrefetch={onPrefetch}
            />
          ))}
        </>
      ) : null}
    </>
  );

  return (
    <div className="relative my-0.5" ref={rootRef}>
      <button
        type="button"
        className={navItemClasses({
          active: inSection,
          toggle: true,
          rail,
        })}
        title={rail ? SYSTEM_SETTINGS_GROUP : undefined}
        aria-expanded={open}
        aria-controls="nav-system-settings"
        onClick={() => setOpen((v) => !v)}
      >
        <NavIcon d={SYSTEM_SETTINGS_GROUP_ICON} size={16} />
        <span className={navLabelClasses(rail)}>{SYSTEM_SETTINGS_GROUP}</span>
        <NavDropdownChevron open={open} rail={rail} />
      </button>
      {open && !rail ? (
        <div
          id="nav-system-settings"
          className="ms-3 flex flex-col border-s border-white/[0.06] py-0.5 pb-1"
          role="group"
          aria-label={SYSTEM_SETTINGS_GROUP}
        >
          {renderBody()}
        </div>
      ) : null}
      {open && rail ? (
        <>
          <div
            id="nav-system-settings"
            className="ms-3 flex flex-col border-s border-white/[0.06] py-0.5 pb-1 lg:hidden"
            role="group"
            aria-label={SYSTEM_SETTINGS_GROUP}
          >
            {renderBody()}
          </div>
          <NavFlyoutPanel label={SYSTEM_SETTINGS_GROUP}>
            {renderBody()}
          </NavFlyoutPanel>
        </>
      ) : null}
    </div>
  );
}

function OrphanScreensNavDropdown({
  items,
  currentPage,
  onPrefetch,
  rail = false,
}: {
  items: OrphanScreenNavItem[];
  currentPage: PageId;
  onPrefetch: (page: PageId) => void;
  rail?: boolean;
}) {
  const inSection = isInOrphanScreensSection(currentPage);
  const [open, setOpen] = useState(inSection);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-expand when route is under orphan screens.
    if (inSection && !rail) setOpen(true);
  }, [inSection, rail]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- avoid leftover open flyouts when entering icon-rail.
    if (rail) setOpen(false);
  }, [rail]);

  useEffect(() => {
    if (!open || !rail) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, rail]);

  const renderRows = () =>
    items.map((item) => (
      <ActiveTransactionNavRow
        key={item.id}
        id={item.id}
        label={item.label}
        icon={item.icon}
        available={item.available}
        active={currentPage === item.id}
        onPrefetch={onPrefetch}
      />
    ));

  return (
    <div className="relative my-0.5" ref={rootRef}>
      <button
        type="button"
        className={navItemClasses({
          active: inSection,
          toggle: true,
          rail,
        })}
        title={rail ? ORPHAN_SCREENS_GROUP : undefined}
        aria-expanded={open}
        aria-controls="nav-orphan-screens"
        onClick={() => setOpen((v) => !v)}
      >
        <NavIcon d={ORPHAN_SCREENS_GROUP_ICON} size={16} />
        <span className={navLabelClasses(rail)}>{ORPHAN_SCREENS_GROUP}</span>
        <NavDropdownChevron open={open} rail={rail} />
      </button>
      {open && !rail ? (
        <div
          id="nav-orphan-screens"
          className="ms-3 flex flex-col border-s border-white/[0.06] py-0.5 pb-1"
          role="group"
          aria-label={ORPHAN_SCREENS_GROUP}
        >
          {renderRows()}
        </div>
      ) : null}
      {open && rail ? (
        <>
          <div
            id="nav-orphan-screens"
            className="ms-3 flex flex-col border-s border-white/[0.06] py-0.5 pb-1 lg:hidden"
            role="group"
            aria-label={ORPHAN_SCREENS_GROUP}
          >
            {renderRows()}
          </div>
          <NavFlyoutPanel label={ORPHAN_SCREENS_GROUP}>
            {renderRows()}
          </NavFlyoutPanel>
        </>
      ) : null}
    </div>
  );
}

function ProfileMenu({
  chipName,
  initials,
  dept,
  currentPage,
  onLogout,
}: {
  chipName: string;
  initials: string;
  dept: string;
  currentPage: PageId;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const inMenuSection = currentPage === "profile";

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const avatar = (
    <div
      className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-[color-mix(in_srgb,var(--gold)_16%,var(--surface))] text-[13px] font-bold text-gold-d"
      id="uav"
    >
      {initials || "—"}
    </div>
  );

  const identity = (
    <div className="hidden min-w-0 sm:block">
      <div
        className="truncate text-[13px] font-bold leading-[1.25] text-heading"
        id="uname"
      >
        {chipName}
      </div>
      <div className="truncate text-[11px] text-text-3" id="udept">
        {dept}
      </div>
    </div>
  );

  return (
    <div className="relative flex items-center" ref={panelRef}>
      <Link
        href="/profile"
        className={cn(
          "flex items-center gap-2.5 rounded-lg py-1 pe-2 ps-2.5 no-underline transition-colors",
          "max-lg:min-h-11 max-lg:ps-1.5",
          "hover:bg-surface-2",
          inMenuSection && "bg-surface-2",
        )}
        aria-label="البروفايل"
        aria-current={inMenuSection ? "page" : undefined}
      >
        {avatar}
        {identity}
      </Link>
      <button
        type="button"
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg text-text-3 transition-colors",
          "max-lg:size-11",
          "hover:bg-surface-2 hover:text-text",
          open && "bg-surface-2 text-text",
        )}
        aria-label="قائمة الحساب"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          className={cn(
            "size-3.5 transition-transform",
            open && "rotate-180",
          )}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
        {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            aria-label="إغلاق القائمة"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute end-0 top-[calc(100%+6px)] z-50 w-64 overflow-hidden rounded-md border border-border bg-surface shadow-modal max-lg:fixed max-lg:inset-x-3 max-lg:bottom-[max(0.75rem,env(safe-area-inset-bottom))] max-lg:top-auto max-lg:w-auto max-lg:rounded-[14px]"
            role="menu"
            aria-label="قائمة الحساب"
          >
            <div className="border-b border-border px-3 py-2.5">
              <div className="truncate text-sm font-semibold text-text">
                {chipName}
              </div>
              <div className="truncate text-[11px] text-text-3">{dept}</div>
            </div>
            <div>
              <ThemeSwitch />
            </div>
            <div className="border-t border-border p-1.5">
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-semibold text-danger-text transition-colors hover:bg-[color-mix(in_srgb,var(--red)_10%,transparent)] max-lg:min-h-11 [&>svg]:size-4 [&>svg]:shrink-0"
                onClick={() => {
                  setOpen(false);
                  onLogout();
                }}
                data-no-action-toast
              >
                <LogoutIcon />
                <span>تسجيل الخروج</span>
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

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

  const systemSettingsPrimaryItems = useMemo(
    () => systemSettingsPrimaryNavForRole(rolePages, role),
    [rolePages, role],
  );
  const systemSettingsFieldsItems = useMemo(
    () => systemSettingsFieldsNavForRole(rolePages),
    [rolePages],
  );
  const showGeneralGroup =
    systemSettingsPrimaryItems.length > 0 ||
    systemSettingsFieldsItems.length > 0;

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
  const activeTxBadges = useActiveTransactionNavBadges();
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
    (pathParts[0] === "property-inspection" ||
      pathParts[0] === "active-inspection") &&
    pathParts.length >= 2;

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
  const onGovernmentReviewWorkspace = pathParts[0] === "government-review" && pathParts.length >= 2;
  const caseStudyTaskId = onCaseStudyWorkspace ? (pathParts[1] ?? null) : null;
  const activeSurveyTaskId = onActiveSurveyRoute ? (pathParts[1] ?? null) : null;
  const propertyAppraisalTaskId = onPropertyAppraisalWorkspace ? (pathParts[1] ?? null) : null;
  const fieldInspectionTaskId = onFieldInspectionWorkspace ? (pathParts[1] ?? null) : null;
  const governmentReviewTaskId = onGovernmentReviewWorkspace ? (pathParts[1] ?? null) : null;

  const { data: workflowTasks } = useWorkflowTasksQuery();

  const caseStudyTask = useMemo(() => {
    if (!caseStudyTaskId) return null;
    const id = decodeTaskParam(caseStudyTaskId);
    return workflowTasks?.find((t) => t.id === id) ?? null;
  }, [caseStudyTaskId, workflowTasks]);

  const { data: caseStudyPo } = usePoRecordQuery(
    caseStudyTask?.poNumber ?? null,
  );

  useEffect(() => {
    if (caseStudyTask?.poNumber) {
      prefetchPrototypePage(queryClient, "active-case-study");
      prefetchPoRecord(queryClient, caseStudyTask.poNumber);
    }
  }, [queryClient, caseStudyTask?.poNumber]);

  const caseStudyDeedLabel = useMemo(() => {
    if (!caseStudyTask || !caseStudyPo) return "";
    const prop = findPropertyForTask(caseStudyPo, caseStudyTask);
    if (!prop) return "";
    const formatted = formatPropertyDeedDisplay(prop);
    if (formatted && formatted !== "—") return formatted;
    return prop.deedNumber.trim();
  }, [caseStudyTask, caseStudyPo]);

  const caseStudyBreadcrumb = useMemo(() => {
    if (!onCaseStudyWorkspace || !caseStudyTask?.poNumber?.trim()) {
      return null;
    }
    return buildPoPropertyWorkspaceSegments(
      caseStudyTask.poNumber.trim(),
      caseStudyDeedLabel || undefined,
    );
  }, [onCaseStudyWorkspace, caseStudyTask, caseStudyDeedLabel]);

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
              onGovernmentReviewWorkspace ||
              isPartyTaskPage(currentPage)
              ? onCaseStudyWorkspace
                ? caseStudyTaskId
                : onActiveSurveyRoute
                  ? activeSurveyTaskId
                  : onPropertyAppraisalWorkspace
                    ? propertyAppraisalTaskId
                    : onFieldInspectionWorkspace
                      ? fieldInspectionTaskId
                      : onGovernmentReviewWorkspace
                        ? governmentReviewTaskId
                        : taskQuery
              : null,
            {
              ...(onCaseStudyWorkspace
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
      onGovernmentReviewWorkspace,
      caseStudyTaskId,
      activeSurveyTaskId,
      propertyAppraisalTaskId,
      fieldInspectionTaskId,
      governmentReviewTaskId,
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
    onGovernmentReviewWorkspace ||
    (pathname ? isPartyTaskWorkPath(pathname) && Boolean(taskQuery) : false);

  const def = ROLES[role];
  const chipName = sessionUser?.displayName?.trim() || def.name;

  async function handleLogout(): Promise<void> {
    const session = getAuthSession();
    const userId = session?.user?.id;
    if (userId) {
      try {
        const pending = await countPendingOutbox(userId);
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

    await unsubscribeFromPushSafe();
    if (session?.refreshToken) {
      try {
        await revokeAuthSession(session.refreshToken);
      } catch {
        /* continue */
      }
    }
    if (userId) {
      try {
        await purgeOfflineData(userId, "logout");
        await closeOfflineDb();
      } catch {
        /* continue */
      }
    }
    clearAuthSession();
    queryClient.clear();
    router.replace("/login");
  }

  // These are reset to false at the start of each render, which is correct —
  // they track sidebar insertion within the current JSX pass only.
  // Declared outside JSX (not inside .map) so React Strict Mode double-invoking
  // the render function still gives the right result.
  let activeTransactionsInserted =
    insertActiveTxAtNavStart && showActiveTransactionsGroup;
  let generalNavInserted = false;
  let orphanScreensInserted = false;

  const onActiveSurveyPropertyDetail = onActiveSurveyEntry;
  // Keys HTML setHeader: list / fees report / envelope file.
  const keysChrome = useMemo(() => {
    if (currentPage !== "keys") return null;
    const envelope = searchParams.get("envelope")?.trim();
    if (envelope) {
      return {
        title: "ملف الظرف",
        breadcrumb: "دراسة الحالة / محفظة المفاتيح / ملف الظرف",
      };
    }
    if (searchParams.get("tab") === "fees") {
      return {
        title: "تقرير الأتعاب",
        breadcrumb: "دراسة الحالة / محفظة المفاتيح / تقرير الأتعاب",
      };
    }
    return null;
  }, [currentPage, searchParams]);

  // Case Study.html renderEngFees:
  // setHeader('فوترة الأتعاب', crumb(['لوحة التحكم','فوترة الأتعاب']))
  const engineeringFeesCrumb =
    currentPage === "party-fees" && isPartyFeesUnderActiveTransactions(role)
      ? slashTrailToSegments("لوحة التحكم / فوترة الأتعاب")
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
        : PAGE_BREADCRUMB[currentPage]
          ? slashTrailToSegments(PAGE_BREADCRUMB[currentPage])
          : undefined);

  const resolvedPageTitle =
    poChrome?.title ??
    myTasksChrome?.title ??
    keysChrome?.title ??
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
      {/* Field-inspection workspace = standalone page (no shell chrome). */}
      {!onFieldInspectionWorkspace && mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-label="إغلاق القائمة"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}
        {!onFieldInspectionWorkspace ? (
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
          {showFinancialGroup ? (
            <FinanceHtmlNav
              key="finance-html-nav"
              currentPage={currentPage}
              activeArea={financeArea}
              badges={financeNavBadges}
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
                  const shouldInsertGeneral =
                    !generalNavInserted &&
                    showGeneralGroup &&
                    run.items[run.items.length - 1]?.id === item.id &&
                    ri === navRuns.length - 1;
                  if (shouldInsertGeneral) {
                    // eslint-disable-next-line react-hooks/immutability -- render-local marker used only within this render pass.
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
                        primaryItems={systemSettingsPrimaryItems}
                        fieldsItems={systemSettingsFieldsItems}
                        currentPage={currentPage}
                        onPrefetch={prefetchPage}
                        role={role}
                        rail={desktopRail}
                      />,
                    );
                    if (showOrphanScreensGroup) {
                      // eslint-disable-next-line react-hooks/immutability -- render-local marker used only within this render pass.
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
                primaryItems={systemSettingsPrimaryItems}
                fieldsItems={systemSettingsFieldsItems}
                currentPage={currentPage}
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
        ) : null}
      <div id="main" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg">
        {/* Field-inspection workspace = standalone page (no shell topbar/sidebar). */}
        {!onFieldInspectionWorkspace ? (
        <div
          id="topbar"
          className="flex min-h-topbar shrink-0 items-center justify-between gap-2 border-b-[0.5px] border-border bg-surface px-4 py-3.5 pt-[max(0.875rem,env(safe-area-inset-top))] sm:gap-3 sm:px-[30px]"
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
        ) : null}
        <div
          id="content"
          ref={contentRef}
          data-workspace-scroll={
            onFieldInspectionWorkspace ? "locked" : undefined
          }
          className={cn(
            /* Block layout so tall list pages scroll on #content; workspaces use flex + inner scroll. */
            "relative min-h-0 min-w-0 flex-1 bg-bg p-0",
            onFieldInspectionWorkspace
              ? /* Standalone inspect page — fullscreen content, no shell chrome. */
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
