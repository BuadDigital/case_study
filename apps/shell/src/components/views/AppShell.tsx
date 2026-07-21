"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
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
} from "@platform/app-shared/prototype/active-transactions";
import {
  SETTINGS_GROUP,
  SETTINGS_GROUP_ICON,
  settingsNavForRole,
  type SettingsNavItem,
  isInSettingsSection,
} from "@platform/app-shared/prototype/settings-nav";
import {
  SYSTEM_FIELDS_GROUP,
  SYSTEM_FIELDS_GROUP_ICON,
  systemFieldsNavForRole,
  type SystemFieldsNavItem,
  isInSystemFieldsSection,
} from "@platform/app-shared/prototype/system-fields-nav";
import {
  SYSTEM_FIELDS_CATALOG_NAV_ITEM,
  isSystemFieldsCatalogPage,
} from "@platform/app-shared/prototype/system-fields-catalog-nav";
import {
  SYSTEM_SCREEN_CATALOG_NAV_ITEM,
  isSystemScreenCatalogPage,
} from "@platform/app-shared/prototype/system-screen-catalog-nav";
import { isPartyTaskPage } from "@platform/app-shared/prototype/party-task-pages";
import { decodeTaskParam, isPartyTaskWorkPath } from "@case-study/mfe";
import { findPropertyForTask } from "@case-study/mfe";
import {
  formatPropertyDeedDisplay,
  PoPropertyDetailTopbarActions,
  PO_PROPERTY_SEGMENT,
  decodePoParam,
  poPropertiesPath,
} from "@case-study/mfe";
import { AppBreadcrumb } from "@/components/views/AppBreadcrumb";
import { NotificationCenter } from "@/components/NotificationCenter";
import { resolvePoChrome, buildPoPropertyDetailSegments } from "@/lib/po-chrome";
import { resolveMyTasksChrome } from "@/lib/my-tasks-chrome";
import { EngineeringSurveyTopbarActions } from "@engineering-office/mfe";
import { useActiveTransactionNavBadges } from "@/lib/query/use-active-transaction-nav-badges";
import { useFailuresNavBadge } from "@/lib/query/use-failures-nav-badge";
import { PoNumber } from "@case-study/mfe/components/ui/PoNumber";
import { cn } from "@platform/design-system";
import { clearAuthSession, getAuthSession } from "@platform/auth-client";

function TopbarSvgIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex size-5 shrink-0 items-center justify-center [&>svg]:size-5">
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

function BackChevronIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4 shrink-0 text-text-3"
      aria-hidden
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

const mobileTopbarIconBtn =
  "flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-surface text-text shadow-[0_1px_2px_rgba(15,52,96,0.06)] transition-colors hover:bg-surface-2 active:scale-[0.98] lg:hidden";

function navItemClasses({
  active = false,
  sub = false,
  locked = false,
  toggle = false,
}: {
  active?: boolean;
  sub?: boolean;
  locked?: boolean;
  toggle?: boolean;
} = {}) {
  return cn(
    "relative flex cursor-pointer items-center gap-[11px] rounded-lg px-3 py-[9px] text-[13.5px] font-medium text-[#aeb6c4] no-underline outline-none transition-[background,color] duration-150",
    "hover:bg-white/[0.06] hover:text-white",
    "[&>svg]:size-[18px] [&>svg]:shrink-0",
    sub && "gap-[9px] ps-8 text-[12.5px] [&>svg]:size-3.5",
    toggle && "w-full border-0 bg-transparent font-inherit",
    active &&
      "bg-[color-mix(in_srgb,var(--gold)_18%,transparent)] font-bold text-gold-2 before:absolute before:inset-y-0 before:start-0 before:w-[3px] before:rounded-e-sm before:bg-gold before:content-['']",
    locked && "cursor-default opacity-35",
  );
}

function navBadgeClasses() {
  return cn(
    "ms-auto inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-danger px-[5px] text-[10px] font-semibold text-white",
  );
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
}: {
  item: (typeof NAV)[number];
  active: boolean;
  onPrefetch: (page: PageId) => void;
  badgeCount?: number;
}) {
  const badgeValue =
    badgeCount != null && badgeCount > 0
      ? String(badgeCount)
      : item.badge;
  const badge = badgeValue ? (
    <span className={navBadgeClasses()}>{badgeValue}</span>
  ) : null;
  return (
    <Link
      href={`/${item.id}`}
      className={navItemClasses({
        active,
      })}
      prefetch
      onMouseEnter={() => onPrefetch(item.id)}
      onFocus={() => onPrefetch(item.id)}
    >
      <NavIcon d={item.icon} size={16} />
      <span>{item.label}</span>
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
}: {
  id: PageId;
  label: string;
  icon: string;
  available: boolean;
  badgeCount?: number;
  active: boolean;
  onPrefetch: (page: PageId) => void;
}) {
  const cls = navItemClasses({
    active,
    sub: true,
    locked: !available,
  });
  const inner = (
    <>
      <NavIcon d={icon} size={12} />
      <span>{label}</span>
      {badgeCount != null && badgeCount > 0 ? (
        <span className={navBadgeClasses()}>{badgeCount}</span>
      ) : !available ? (
        <span className={cn(navBadgeClasses(), "opacity-70")}>بدون صلاحية</span>
      ) : null}
    </>
  );
  if (!available) {
    return <div className={cls}>{inner}</div>;
  }
  return (
    <Link
      href={`/${id}`}
      className={cls}
      prefetch
      onMouseEnter={() => onPrefetch(id)}
      onFocus={() => onPrefetch(id)}
    >
      {inner}
    </Link>
  );
}

function NavDropdownChevron({ open }: { open: boolean }) {
  return (
    <svg
      className={cn(
        "ms-auto shrink-0 opacity-45 transition-transform duration-200 ease-in-out",
        open && "-rotate-90 opacity-70",
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

function ActiveTransactionsNavDropdown({
  items,
  currentPage,
  onTaskWork,
  onCaseStudyWorkspace,
  onPrefetch,
  badges,
}: {
  items: ActiveTransactionNavItem[];
  currentPage: PageId;
  onTaskWork: boolean;
  onCaseStudyWorkspace: boolean;
  onPrefetch: (page: PageId) => void;
  badges: Partial<Record<PageId, number>>;
}) {
  const inSection =
    isInActiveTransactionsSection(currentPage, onTaskWork) ||
    onCaseStudyWorkspace;
  const [open, setOpen] = useState(inSection);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-expand the active section when navigation enters it.
    if (inSection) setOpen(true);
  }, [inSection]);

  const childActive = (tx: ActiveTransactionNavItem) =>
    currentPage === tx.id ||
    (tx.id === "active-case-study" && onCaseStudyWorkspace);

  return (
    <div className="my-0.5">
      <button
        type="button"
        className={navItemClasses({
          active: inSection,
          toggle: true,
        })}
        aria-expanded={open}
        aria-controls="nav-active-transactions"
        onClick={() => setOpen((v) => !v)}
      >
        <NavIcon d={ACTIVE_TRANSACTIONS_GROUP_ICON} size={16} />
        <span>{ACTIVE_TRANSACTIONS_GROUP}</span>
        <NavDropdownChevron open={open} />
      </button>
      {open ? (
        <div
          id="nav-active-transactions"
          className="ms-3 flex flex-col border-s border-white/[0.06] py-0.5 pb-1"
          role="group"
          aria-label={ACTIVE_TRANSACTIONS_GROUP}
        >
          {items.map((tx) => (
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
          ))}
        </div>
      ) : null}
    </div>
  );
}

type ProfileMenuItem = SettingsNavItem | SystemFieldsNavItem;

function ProfileMenuLink({
  item,
  active,
  onPrefetch,
  onNavigate,
}: {
  item: ProfileMenuItem;
  active: boolean;
  onPrefetch: (page: PageId) => void;
  onNavigate: () => void;
}) {
  const cls = cn(
    "flex items-center gap-2 rounded-md px-2.5 py-2 text-[12.5px] no-underline transition-colors",
    active
      ? "bg-primary/10 font-medium text-primary"
      : "text-text-2 hover:bg-surface-2 hover:text-text",
    !item.available && "cursor-default opacity-45",
  );
  const inner = (
    <>
      <NavIcon d={item.icon} size={14} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {!item.available ? (
        <span className="shrink-0 text-[10px] text-text-3">بدون صلاحية</span>
      ) : null}
    </>
  );
  if (!item.available) {
    return <div className={cls}>{inner}</div>;
  }
  return (
    <Link
      href={`/${item.id}`}
      className={cls}
      prefetch
      onMouseEnter={() => onPrefetch(item.id)}
      onFocus={() => onPrefetch(item.id)}
      onClick={onNavigate}
    >
      {inner}
    </Link>
  );
}

function ProfileMenu({
  chipName,
  initials,
  dept,
  systemFieldsItems,
  settingsItems,
  currentPage,
  onPrefetch,
  onLogout,
}: {
  chipName: string;
  initials: string;
  dept: string;
  systemFieldsItems: SystemFieldsNavItem[];
  settingsItems: SettingsNavItem[];
  currentPage: PageId;
  onPrefetch: (page: PageId) => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const hasMenu = systemFieldsItems.length > 0 || settingsItems.length > 0;
  const inMenuSection =
    isInSystemFieldsSection(currentPage) || isInSettingsSection(currentPage);

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
      className="flex size-[34px] shrink-0 items-center justify-center rounded-lg text-[14px] font-bold text-gold-2"
      id="uav"
    >
      {initials}
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
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        className={cn(
          "flex items-center gap-2.5 rounded-lg py-1 pe-1.5 ps-2.5 transition-colors",
          "hover:bg-surface-2",
          (open || inMenuSection) && "bg-surface-2",
        )}
        aria-label="قائمة الملف الشخصي"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        {avatar}
        {identity}
        <svg
          className={cn(
            "ms-0.5 hidden size-3.5 shrink-0 text-text-3 transition-transform sm:block",
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
        <div
          className="absolute end-0 top-[calc(100%+6px)] z-50 w-64 overflow-hidden rounded-md border border-border bg-surface shadow-modal"
          role="menu"
          aria-label="قائمة الملف الشخصي"
        >
          <div className="border-b border-border px-3 py-2.5">
            <div className="truncate text-sm font-semibold text-text">
              {chipName}
            </div>
            <div className="truncate text-[11px] text-text-3">{dept}</div>
          </div>
          {hasMenu ? (
          <div className="max-h-80 overflow-y-auto py-1.5">
            {systemFieldsItems.length > 0 ? (
              <div className="px-1.5 pb-1" role="group" aria-label={SYSTEM_FIELDS_GROUP}>
                <div className="flex items-center gap-1.5 px-2.5 pb-1 pt-1 text-[10px] font-medium uppercase tracking-wider text-text-3">
                  <NavIcon d={SYSTEM_FIELDS_GROUP_ICON} size={12} />
                  <span>{SYSTEM_FIELDS_GROUP}</span>
                </div>
                {systemFieldsItems.map((item) => (
                  <ProfileMenuLink
                    key={item.id}
                    item={item}
                    active={currentPage === item.id}
                    onPrefetch={onPrefetch}
                    onNavigate={() => setOpen(false)}
                  />
                ))}
              </div>
            ) : null}
            {systemFieldsItems.length > 0 && settingsItems.length > 0 ? (
              <div className="mx-2 my-1 border-t border-border" />
            ) : null}
            {settingsItems.length > 0 ? (
              <div className="px-1.5 pb-1" role="group" aria-label={SETTINGS_GROUP}>
                <div className="flex items-center gap-1.5 px-2.5 pb-1 pt-1 text-[10px] font-medium uppercase tracking-wider text-text-3">
                  <NavIcon d={SETTINGS_GROUP_ICON} size={12} />
                  <span>{SETTINGS_GROUP}</span>
                </div>
                {settingsItems.map((item) => (
                  <ProfileMenuLink
                    key={item.id}
                    item={item}
                    active={currentPage === item.id}
                    onPrefetch={onPrefetch}
                    onNavigate={() => setOpen(false)}
                  />
                ))}
              </div>
            ) : null}
          </div>
          ) : null}
          <div className={cn(hasMenu && "border-t border-border")}>
            <ThemeSwitch />
          </div>
          <div className="border-t border-border p-1.5">
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-semibold text-danger-text transition-colors hover:bg-[color-mix(in_srgb,var(--red)_10%,transparent)] [&>svg]:size-4 [&>svg]:shrink-0"
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
  // Read sessionStorage once per render cycle, not multiple times.
  const sessionUser = useMemo(() => getAuthSession()?.user, []);

  const navPages = useMemo(() => rolePages, [rolePages]);

  const settingsNavItems = useMemo(
    () => settingsNavForRole(rolePages),
    [rolePages],
  );

  const systemFieldsNavItems = useMemo(
    () => systemFieldsNavForRole(rolePages),
    [rolePages],
  );

  const showSystemFieldsCatalog = rolePages.includes(
    SYSTEM_FIELDS_CATALOG_NAV_ITEM.id,
  );
  const showSystemScreenCatalog = rolePages.includes(
    SYSTEM_SCREEN_CATALOG_NAV_ITEM.id,
  );
  const showGeneralGroup = showSystemFieldsCatalog || showSystemScreenCatalog;

  const showSystemFieldsGroup = systemFieldsNavItems.some((i) => i.available);
  const showSettingsGroup = settingsNavItems.some((i) => i.available);

  const navRuns = useMemo(() => navRunsForRole(navPages, role), [navPages, role]);

  const activeTransactionItems = useMemo(
    () => activeTransactionNavForRole(rolePages),
    [rolePages],
  );

  const showActiveTransactionsGroup = activeTransactionItems.length > 0;
  const activeTxBadges = useActiveTransactionNavBadges();
  const failuresNavBadge = useFailuresNavBadge();
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

  const searchParams = useSearchParams();

  // Parse path parts once so the workspace/taskId derivations below don't
  // each call split+filter separately.
  const pathParts = useMemo(
    () => pathname?.split("/").filter(Boolean) ?? [],
    [pathname],
  );

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

  const onCaseStudyWorkspace = pathname?.startsWith("/case-study/") ?? false;
  const onActiveSurveyRoute = pathParts[0] === "active-survey" && pathParts.length >= 2;
  const onActiveSurveyEntry = onActiveSurveyRoute && pathParts[2] === "entry";
  const onPropertyAppraisalWorkspace = pathParts[0] === "property-appraisal" && pathParts.length >= 2;
  const onPropertyInspectionWorkspace = pathParts[0] === "property-inspection" && pathParts.length >= 2;
  const onGovernmentReviewWorkspace = pathParts[0] === "government-review" && pathParts.length >= 2;
  const onValuationCoordinationWorkspace = pathParts[0] === "valuation-coordination" && pathParts.length >= 2;
  const caseStudyTaskId = onCaseStudyWorkspace ? (pathParts[1] ?? null) : null;
  const activeSurveyTaskId = onActiveSurveyRoute ? (pathParts[1] ?? null) : null;
  const propertyAppraisalTaskId = onPropertyAppraisalWorkspace ? (pathParts[1] ?? null) : null;
  const propertyInspectionTaskId = onPropertyInspectionWorkspace ? (pathParts[1] ?? null) : null;
  const governmentReviewTaskId = onGovernmentReviewWorkspace ? (pathParts[1] ?? null) : null;
  const valuationCoordinationTaskId = onValuationCoordinationWorkspace ? (pathParts[1] ?? null) : null;

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

  const activeSurveyTask = useMemo(() => {
    if (!activeSurveyTaskId) return null;
    const id = decodeTaskParam(activeSurveyTaskId);
    return workflowTasks?.find((t) => t.id === id) ?? null;
  }, [activeSurveyTaskId, workflowTasks]);

  const { data: activeSurveyPo } = usePoRecordQuery(
    activeSurveyTask?.poNumber ?? null,
  );

  const activeSurveyDeedLabel = useMemo(() => {
    if (!activeSurveyTask || !activeSurveyPo) return "";
    const prop = findPropertyForTask(activeSurveyPo, activeSurveyTask);
    if (!prop) return "";
    const formatted = formatPropertyDeedDisplay(prop);
    if (formatted && formatted !== "—") return formatted;
    return prop.deedNumber.trim();
  }, [activeSurveyTask, activeSurveyPo]);

  const activeSurveyBreadcrumb = useMemo(() => {
    if (!onActiveSurveyRoute || !activeSurveyTask?.poNumber?.trim()) {
      return null;
    }
    return buildPoPropertyDetailSegments(
      activeSurveyTask.poNumber.trim(),
      activeSurveyDeedLabel || undefined,
    );
  }, [
    onActiveSurveyRoute,
    activeSurveyTask,
    activeSurveyDeedLabel,
  ]);

  const caseStudyBreadcrumb = useMemo(() => {
    if (!onCaseStudyWorkspace || !caseStudyTask?.poNumber?.trim()) {
      return null;
    }
    return buildPoPropertyDetailSegments(
      caseStudyTask.poNumber.trim(),
      caseStudyDeedLabel || undefined,
    );
  }, [onCaseStudyWorkspace, caseStudyTask, caseStudyDeedLabel]);

  const poPropertyDetailContext = useMemo(() => {
    if (
      pathParts[0] !== "po" ||
      pathParts[2] !== PO_PROPERTY_SEGMENT ||
      pathParts.length !== 4 ||
      pathParts[3] === "new"
    ) {
      return null;
    }
    return {
      poNumber: decodePoParam(pathParts[1]!),
      propertyId: decodePoParam(pathParts[3]!),
    };
  }, [pathParts]);

  const { data: poPropertyDetailRecord } = usePoRecordQuery(
    poPropertyDetailContext?.poNumber ?? null,
  );

  const poPropertyDeedLabel = useMemo(() => {
    if (!poPropertyDetailContext || !poPropertyDetailRecord) return undefined;
    const property = poPropertyDetailRecord.properties.find(
      (p) => p.id === poPropertyDetailContext.propertyId,
    );
    if (!property) return undefined;
    const formatted = formatPropertyDeedDisplay(property);
    if (formatted && formatted !== "—") return formatted;
    return property.deedNumber.trim() || undefined;
  }, [poPropertyDetailContext, poPropertyDetailRecord]);

  const poChrome = useMemo(
    () =>
      pathname
        ? resolvePoChrome(pathname, { deedLabel: poPropertyDeedLabel })
        : null,
    [pathname, poPropertyDeedLabel],
  );
  const taskQuery = searchParams.get("task");
  const myTasksChrome = useMemo(
    () =>
      pathname
        ? resolveMyTasksChrome(
            pathname,
            currentPage === "active-primary-data" ||
              currentPage === "all-transactions" ||
              currentPage === "active-distribution" ||
              currentPage === "active-case-study" ||
              onCaseStudyWorkspace ||
              onActiveSurveyRoute ||
              onPropertyAppraisalWorkspace ||
              onPropertyInspectionWorkspace ||
              onGovernmentReviewWorkspace ||
              onValuationCoordinationWorkspace ||
              isPartyTaskPage(currentPage)
              ? onCaseStudyWorkspace
                ? caseStudyTaskId
                : onActiveSurveyRoute
                  ? activeSurveyTaskId
                  : onPropertyAppraisalWorkspace
                    ? propertyAppraisalTaskId
                    : onPropertyInspectionWorkspace
                      ? propertyInspectionTaskId
                      : onGovernmentReviewWorkspace
                        ? governmentReviewTaskId
                        : onValuationCoordinationWorkspace
                          ? valuationCoordinationTaskId
                          : taskQuery
              : null,
            onCaseStudyWorkspace
              ? { deedLabel: caseStudyDeedLabel }
              : undefined,
          )
        : null,
    [
      pathname,
      currentPage,
      taskQuery,
      onCaseStudyWorkspace,
      onActiveSurveyRoute,
      onPropertyAppraisalWorkspace,
      onPropertyInspectionWorkspace,
      onGovernmentReviewWorkspace,
      onValuationCoordinationWorkspace,
      caseStudyTaskId,
      activeSurveyTaskId,
      propertyAppraisalTaskId,
      propertyInspectionTaskId,
      governmentReviewTaskId,
      valuationCoordinationTaskId,
      caseStudyDeedLabel,
    ],
  );
  const inPoSection = pathname?.startsWith("/po") ?? false;
  const onTaskWork =
    (currentPage === "active-primary-data" && Boolean(taskQuery)) ||
    (currentPage === "all-transactions" && Boolean(taskQuery)) ||
    (currentPage === "active-distribution" && Boolean(taskQuery)) ||
    onActiveSurveyRoute ||
    onPropertyAppraisalWorkspace ||
    onPropertyInspectionWorkspace ||
    onGovernmentReviewWorkspace ||
    onValuationCoordinationWorkspace ||
    (pathname ? isPartyTaskWorkPath(pathname) && Boolean(taskQuery) : false);

  const def = ROLES[role];
  const chipName = sessionUser?.displayName?.trim() || def.name;

  function handleLogout(): void {
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

  const onPoPropertyDetail = Boolean(poChrome?.propertyDetail);
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

  const breadcrumbSegments =
    poChrome?.segments ??
    activeSurveyBreadcrumb ??
    caseStudyBreadcrumb ??
    (myTasksChrome?.breadcrumb
      ? myTasksChrome.breadcrumb
          .split(" / ")
          .map((label) => ({ label: label.trim() }))
          .filter((s) => s.label)
      : keysChrome?.breadcrumb
        ? keysChrome.breadcrumb
            .split(" / ")
            .map((label) => ({ label: label.trim() }))
            .filter((s) => s.label)
        : PAGE_BREADCRUMB[currentPage]
          ? PAGE_BREADCRUMB[currentPage]
              .split(" / ")
              .map((label) => ({ label: label.trim() }))
              .filter((s) => s.label)
          : undefined);

  const resolvedPageTitle =
    poChrome?.title ??
    myTasksChrome?.title ??
    keysChrome?.title ??
    PAGE_TITLES[currentPage] ??
    "";

  // Full trail from PAGE_BREADCRUMB / chrome (including current page label),
  // matching HTML setHeader(title, crumb([…, current])).
  const displayBreadcrumbSegments = breadcrumbSegments ?? [];

  return (
    <div id="app" className="flex h-svh overflow-hidden bg-bg">
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
        className={cn(
          "flex h-svh w-sidebar shrink-0 flex-col overflow-hidden border-s border-white/[0.06] bg-sidebar text-white [color-scheme:dark]",
          "max-lg:fixed max-lg:inset-y-0 max-lg:start-0 max-lg:z-50 max-lg:shadow-xl max-lg:transition-transform max-lg:duration-200 max-lg:ease-out",
          mobileNavOpen ? "max-lg:translate-x-0" : "max-lg:translate-x-full",
          "lg:translate-x-0",
        )}
      >
        <div className="relative flex items-center justify-center border-b border-white/[0.08] px-[18px] pb-[18px] pt-5">
          <EjadaLogo className="h-auto w-[155px] max-w-full" />
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
            className="min-h-0 flex-1 overflow-y-auto px-3 pb-[22px] pt-3"
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
            />
          ) : null}
          {navRuns.map((run, ri) => {
            const blocks: React.ReactNode[] = [];
            blocks.push(
              <div key={`run-${ri}`}>
                {run.label ? (
                  <div>
                    <div className="px-3 pb-[7px] pt-[18px] text-[11px] font-bold tracking-[0.03em] text-[#6f7b90]">
                      {run.label}
                    </div>
                  </div>
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
                    />,
                  );
                  const shouldInsertGeneral =
                    !generalNavInserted &&
                    showGeneralGroup &&
                    item.id === "financial";
                  if (shouldInsertGeneral) {
                    // eslint-disable-next-line react-hooks/immutability -- render-local marker used only within this render pass.
                    generalNavInserted = true;
                    nodes.push(
                      <div key="general-grp">
                        <div className="px-3 pb-[7px] pt-[18px] text-[11px] font-bold tracking-[0.03em] text-[#6f7b90]">
                          عام
                        </div>
                      </div>,
                    );
                    if (showSystemFieldsCatalog) {
                      nodes.push(
                        <NavRow
                          key={SYSTEM_FIELDS_CATALOG_NAV_ITEM.id}
                          item={SYSTEM_FIELDS_CATALOG_NAV_ITEM}
                          active={isSystemFieldsCatalogPage(currentPage)}
                          onPrefetch={prefetchPage}
                        />,
                      );
                    }
                    if (showSystemScreenCatalog) {
                      nodes.push(
                        <NavRow
                          key={SYSTEM_SCREEN_CATALOG_NAV_ITEM.id}
                          item={SYSTEM_SCREEN_CATALOG_NAV_ITEM}
                          active={isSystemScreenCatalogPage(currentPage)}
                          onPrefetch={prefetchPage}
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
            />
          ) : null}
          {!generalNavInserted && showGeneralGroup ? (
            <>
              <div key="general-grp-fallback">
                <div className="px-3 pb-[7px] pt-[18px] text-[11px] font-bold tracking-[0.03em] text-[#6f7b90]">
                  عام
                </div>
              </div>
              {showSystemFieldsCatalog ? (
                <NavRow
                  key={SYSTEM_FIELDS_CATALOG_NAV_ITEM.id}
                  item={SYSTEM_FIELDS_CATALOG_NAV_ITEM}
                  active={isSystemFieldsCatalogPage(currentPage)}
                  onPrefetch={prefetchPage}
                />
              ) : null}
              {showSystemScreenCatalog ? (
                <NavRow
                  key={SYSTEM_SCREEN_CATALOG_NAV_ITEM.id}
                  item={SYSTEM_SCREEN_CATALOG_NAV_ITEM}
                  active={isSystemScreenCatalogPage(currentPage)}
                  onPrefetch={prefetchPage}
                />
              ) : null}
            </>
          ) : null}
          </nav>
        </div>
      </div>
      <div id="main" className="flex min-w-0 flex-1 flex-col overflow-hidden bg-bg">
        <div
          id="topbar"
          className="flex min-h-topbar shrink-0 items-center justify-between gap-2 border-b-[0.5px] border-border bg-surface px-4 py-3.5 sm:gap-3 sm:px-[30px]"
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
            {onPoPropertyDetail && poChrome?.propertyDetail ? (
              <Link
                href={poPropertiesPath(poChrome.propertyDetail.poNumber)}
                className="flex min-w-0 flex-1 items-center gap-1 truncate text-[13px] font-medium text-text no-underline transition-colors hover:text-primary lg:hidden"
              >
                <BackChevronIcon />
                <PoNumber value={poChrome.propertyDetail.poNumber} />
              </Link>
            ) : null}
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
              <AppBreadcrumb
                segments={displayBreadcrumbSegments}
                className={cn(
                  "max-lg:min-w-0 max-lg:flex-1 max-lg:flex-nowrap max-lg:overflow-x-auto max-lg:[&::-webkit-scrollbar]:hidden",
                  onPoPropertyDetail && "max-lg:hidden",
                )}
              />
              {!onPoPropertyDetail && !onActiveSurveyPropertyDetail
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
          <div className="flex shrink-0 items-center gap-3">
            <NotificationCenter />
            <div className="h-[26px] w-px shrink-0 bg-border-md" aria-hidden />
            {poChrome?.propertyDetail ? (
              <div className="max-lg:hidden">
                <PoPropertyDetailTopbarActions
                  poNumber={poChrome.propertyDetail.poNumber}
                  propertyId={poChrome.propertyDetail.propertyId}
                />
              </div>
            ) : null}
            {onActiveSurveyPropertyDetail ? (
              <EngineeringSurveyTopbarActions />
            ) : null}
            <ProfileMenu
              chipName={chipName}
              initials={def.init}
              dept={def.dept}
              systemFieldsItems={
                showSystemFieldsGroup ? systemFieldsNavItems : []
              }
              settingsItems={showSettingsGroup ? settingsNavItems : []}
              currentPage={currentPage}
              onPrefetch={prefetchPage}
              onLogout={handleLogout}
            />
          </div>
        </div>
        <div
          id="content"
          data-workspace-scroll={
            onPropertyInspectionWorkspace ? "locked" : undefined
          }
          className={cn(
            "flex min-h-0 flex-1 flex-col items-stretch bg-bg p-0",
            onPropertyInspectionWorkspace ? "overflow-hidden" : "overflow-y-auto",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
