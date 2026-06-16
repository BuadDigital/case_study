"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { NavIcon } from "@/components/views/NavIcon";
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
  personaLabelName,
  ROLE_OPTIONS,
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
  PoListTopbarActions,
  PoPropertyDetailTopbarActions,
  PO_PROPERTY_SEGMENT,
  decodePoParam,
} from "@case-study/mfe";
import { AppBreadcrumb } from "@/components/views/AppBreadcrumb";
import { resolvePoChrome, buildPoPropertyDetailSegments } from "@/lib/po-chrome";
import { resolveMyTasksChrome } from "@/lib/my-tasks-chrome";
import { EngineeringSurveyTopbarActions } from "@engineering-office/mfe";
import { pagesForPrototypeRole } from "@platform/app-shared/prototype/prototype-role-access";
import { ActiveTransactionsSituationBar } from "@case-study/mfe";
import { useActiveTransactionNavBadges } from "@/lib/query/use-active-transaction-nav-badges";
import { useFailuresNavBadge } from "@/lib/query/use-failures-nav-badge";
import { PoNumber } from "@case-study/mfe/components/ui/PoNumber";
import { cn, Select } from "@platform/design-system";

/** Must match `group` on every entry in ROLE_OPTIONS (constants.ts). */
const GROUP_ORDER = [
  "التحول الرقمي",
  "إدارة المنظمة",
  "إدارة التقييم العقاري",
  "قسم دراسة الحالة",
  "قسم التقييم العقاري",
  "المالية والعقود",
  "مزود خارجي",
];

function navItemClasses({
  active = false,
  sub = false,
  locked = false,
  dummy = false,
  toggle = false,
}: {
  active?: boolean;
  sub?: boolean;
  locked?: boolean;
  dummy?: boolean;
  toggle?: boolean;
} = {}) {
  return cn(
    "relative flex cursor-pointer items-center gap-[9px] rounded-none border-e-[3px] border-transparent py-[9px] px-3.5 text-[12.5px] text-sidebar-muted no-underline outline-none transition-[background,color] duration-150",
    "hover:bg-white/5 hover:text-sidebar-muted-strong",
    "[&>svg]:size-4 [&>svg]:shrink-0",
    sub && "gap-[7px] ps-8 text-[11px] [&>svg]:size-3",
    toggle && "w-full border-0 bg-transparent font-inherit",
    active &&
      !dummy &&
      "bg-primary/18 font-medium text-white before:absolute before:inset-y-0 before:start-0 before:w-[3px] before:rounded-e-sm before:bg-primary before:content-['']",
    dummy && "text-red-400 hover:bg-red-400/10",
    dummy &&
      active &&
      "bg-red-500/14 font-medium text-red-300 before:bg-red",
    locked && "cursor-default opacity-35",
  );
}

function navBadgeClasses(teal?: boolean) {
  return cn(
    "ms-auto inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full px-[5px] text-[10px] font-semibold text-white",
    teal ? "bg-primary" : "bg-red",
  );
}

type NavRun = { label: string | null; items: (typeof NAV)[number][] };

function buildNavRuns(): NavRun[] {
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
      if (!cur) {
        cur = { label: null, items: [] };
        runs.push(cur);
      }
      cur.items.push(item);
    }
  }
  return runs;
}

function navRunsForRole(rolePages: PageId[]): NavRun[] {
  return buildNavRuns()
    .map((run) => ({
      ...run,
      items: run.items.filter((item) => rolePages.includes(item.id)),
    }))
    .filter((run) => run.items.length > 0);
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
  const badgeTeal = item.id === "po";
  const badge = badgeValue ? (
    <span className={navBadgeClasses(badgeTeal)}>{badgeValue}</span>
  ) : null;
  return (
    <Link
      href={`/${item.id}`}
      className={navItemClasses({
        active,
        dummy: item.placeholder,
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
  placeholder,
  badgeCount,
  active,
  onPrefetch,
}: {
  id: PageId;
  label: string;
  icon: string;
  available: boolean;
  placeholder?: boolean;
  badgeCount?: number;
  active: boolean;
  onPrefetch: (page: PageId) => void;
}) {
  const cls = navItemClasses({
    active,
    sub: true,
    locked: !available,
    dummy: placeholder,
  });
  const inner = (
    <>
      <NavIcon d={icon} size={12} />
      <span>{label}</span>
      {badgeCount != null && badgeCount > 0 ? (
        <span className={navBadgeClasses()}>{badgeCount}</span>
      ) : !available ? (
        <span className={cn(navBadgeClasses(), "opacity-70")}>قريباً</span>
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
    if (inSection) setOpen(true);
  }, [inSection]);

  const childActive = (tx: ActiveTransactionNavItem) =>
    currentPage === tx.id ||
    (tx.id === "active-case-study" && onCaseStudyWorkspace) ||
    (isPartyTaskPage(tx.id) && onTaskWork) ||
    ((tx.id === "active-primary-data" || tx.id === "active-distribution") &&
      onTaskWork);

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
              placeholder={tx.placeholder}
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

function FooterNavDropdown({
  groupLabel,
  groupIcon,
  panelId,
  items,
  currentPage,
  inSection,
  onPrefetch,
}: {
  groupLabel: string;
  groupIcon: string;
  panelId: string;
  items: (SettingsNavItem | SystemFieldsNavItem)[];
  currentPage: PageId;
  inSection: boolean;
  onPrefetch: (page: PageId) => void;
}) {
  const [open, setOpen] = useState(inSection);

  useEffect(() => {
    if (inSection) setOpen(true);
  }, [inSection]);

  return (
    <div className="my-0">
      <button
        type="button"
        className={navItemClasses({
          active: inSection,
          toggle: true,
        })}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <NavIcon d={groupIcon} size={16} />
        <span>{groupLabel}</span>
        <NavDropdownChevron open={open} />
      </button>
      {open ? (
        <div
          id={panelId}
          className="ms-3 flex flex-col border-s border-white/[0.06] py-0.5 pb-1"
          role="group"
          aria-label={groupLabel}
        >
          {items.map((item) => (
            <ActiveTransactionNavRow
              key={item.id}
              id={item.id}
              label={item.label}
              icon={item.icon}
              available={item.available}
              placeholder={item.placeholder}
              badgeCount={
                "badge" in item && item.badge
                  ? Number(item.badge) || undefined
                  : undefined
              }
              active={currentPage === item.id}
              onPrefetch={onPrefetch}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { role, personaId, setPersona, rolePages } = usePrototype();

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

  const navRuns = useMemo(() => navRunsForRole(navPages), [navPages]);

  const activeTransactionItems = useMemo(
    () => activeTransactionNavForRole(rolePages),
    [rolePages],
  );

  const showActiveTransactionsGroup = activeTransactionItems.length > 0;
  const activeTxBadges = useActiveTransactionNavBadges();
  const failuresNavBadge = useFailuresNavBadge();
  const insertActiveTxAfterPo = rolePages.includes("po");

  const prefetchPage = useMemo(
    () => (page: PageId) => prefetchPrototypePage(queryClient, page),
    [queryClient],
  );

  const currentPage = useMemo(() => {
    const seg = pathname?.split("/").filter(Boolean)[0];
    return (seg ?? "dashboard") as PageId;
  }, [pathname]);

  useEffect(() => {
    prefetchPrototypePage(queryClient, currentPage);
  }, [queryClient, currentPage]);

  const searchParams = useSearchParams();
  const onCaseStudyWorkspace = pathname?.startsWith("/case-study/") ?? false;
  const onActiveSurveyWorkspace =
    (pathname?.startsWith("/active-survey/") &&
      pathname.split("/").filter(Boolean).length >= 2) ??
    false;
  const onPropertyAppraisalWorkspace =
    (pathname?.startsWith("/property-appraisal/") &&
      pathname.split("/").filter(Boolean).length >= 2) ??
    false;
  const onPropertyInspectionWorkspace =
    (pathname?.startsWith("/property-inspection/") &&
      pathname.split("/").filter(Boolean).length >= 2) ??
    false;
  const onGovernmentReviewWorkspace =
    (pathname?.startsWith("/government-review/") &&
      pathname.split("/").filter(Boolean).length >= 2) ??
    false;
  const onValuationCoordinationWorkspace =
    (pathname?.startsWith("/valuation-coordination/") &&
      pathname.split("/").filter(Boolean).length >= 2) ??
    false;
  const caseStudyTaskId = onCaseStudyWorkspace
    ? pathname.split("/").filter(Boolean)[1] ?? null
    : null;
  const activeSurveyTaskId = onActiveSurveyWorkspace
    ? pathname.split("/").filter(Boolean)[1] ?? null
    : null;
  const propertyAppraisalTaskId = onPropertyAppraisalWorkspace
    ? pathname.split("/").filter(Boolean)[1] ?? null
    : null;
  const propertyInspectionTaskId = onPropertyInspectionWorkspace
    ? pathname.split("/").filter(Boolean)[1] ?? null
    : null;
  const governmentReviewTaskId = onGovernmentReviewWorkspace
    ? pathname.split("/").filter(Boolean)[1] ?? null
    : null;
  const valuationCoordinationTaskId = onValuationCoordinationWorkspace
    ? pathname.split("/").filter(Boolean)[1] ?? null
    : null;

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
    if (!onActiveSurveyWorkspace || !activeSurveyTask?.poNumber?.trim()) {
      return null;
    }
    return buildPoPropertyDetailSegments(
      activeSurveyTask.poNumber.trim(),
      activeSurveyDeedLabel || undefined,
    );
  }, [
    onActiveSurveyWorkspace,
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
    if (!pathname) return null;
    const parts = pathname.split("/").filter(Boolean);
    if (
      parts[0] !== "po" ||
      parts[2] !== PO_PROPERTY_SEGMENT ||
      parts.length !== 4 ||
      parts[3] === "new"
    ) {
      return null;
    }
    return {
      poNumber: decodePoParam(parts[1]),
      propertyId: decodePoParam(parts[3]),
    };
  }, [pathname]);

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
              currentPage === "active-distribution" ||
              currentPage === "active-case-study" ||
              onCaseStudyWorkspace ||
              onActiveSurveyWorkspace ||
              onPropertyAppraisalWorkspace ||
              onPropertyInspectionWorkspace ||
              onGovernmentReviewWorkspace ||
              onValuationCoordinationWorkspace ||
              isPartyTaskPage(currentPage)
              ? onCaseStudyWorkspace
                ? caseStudyTaskId
                : onActiveSurveyWorkspace
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
      onActiveSurveyWorkspace,
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
    (currentPage === "active-distribution" && Boolean(taskQuery)) ||
    onActiveSurveyWorkspace ||
    onPropertyAppraisalWorkspace ||
    onPropertyInspectionWorkspace ||
    onGovernmentReviewWorkspace ||
    onValuationCoordinationWorkspace ||
    (pathname ? isPartyTaskWorkPath(pathname) && Boolean(taskQuery) : false);

  const showActiveTransactionsSituation =
    isInActiveTransactionsSection(currentPage, onTaskWork) ||
    onActiveSurveyWorkspace ||
    onPropertyAppraisalWorkspace ||
    onPropertyInspectionWorkspace ||
    onGovernmentReviewWorkspace ||
    onValuationCoordinationWorkspace;

  const def = ROLES[role];
  /** يطابق «تبديل الدور» — اسم الشخصية وليس displayName من تسجيل الدخول */
  const chipName = personaLabelName(personaId) ?? def.name;

  function onPersonaChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setPersona(id);
    const opt = ROLE_OPTIONS.find((o) => o.id === id);
    const nextRole = opt?.value ?? role;
    const nextPages = pagesForPrototypeRole(nextRole);
    if (!nextPages.includes(currentPage)) {
      router.push("/dashboard");
    }
  }

  let activeTransactionsInserted = false;
  let generalNavInserted = false;

  const onPoPropertyDetail = Boolean(poChrome?.propertyDetail);
  const onActiveSurveyPropertyDetail = onActiveSurveyWorkspace;
  const onPoList = pathname === "/po";
  const breadcrumbSegments =
    poChrome?.segments ??
    activeSurveyBreadcrumb ??
    caseStudyBreadcrumb ??
    (myTasksChrome?.breadcrumb
      ? myTasksChrome.breadcrumb
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
    PAGE_TITLES[currentPage] ??
    "";

  const displayBreadcrumbSegments = (() => {
    if (
      onPoPropertyDetail ||
      onActiveSurveyPropertyDetail ||
      !breadcrumbSegments?.length
    ) {
      return breadcrumbSegments ?? [];
    }
    const lastLabel =
      breadcrumbSegments[breadcrumbSegments.length - 1]!.label.trim();
    const titleTrimmed = resolvedPageTitle.trim();
    if (!poChrome?.titlePo && titleTrimmed && titleTrimmed === lastLabel) {
      return breadcrumbSegments.slice(0, -1);
    }
    return breadcrumbSegments;
  })();

  return (
    <div id="app" className="flex h-svh bg-bg">
      <div
        id="sidebar"
        className="flex w-sidebar shrink-0 flex-col overflow-hidden border-s border-white/[0.06] bg-sidebar text-white [color-scheme:dark]"
      >
        <div className="flex items-center gap-2 border-b border-sidebar-border px-3.5 py-4">
          <div
            className="flex shrink-0 items-center justify-center text-primary [&>svg]:size-[18px]"
            aria-hidden
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 21h18" />
              <path d="M9 8h1" />
              <path d="M9 12h1" />
              <path d="M9 16h1" />
              <path d="M14 8h1" />
              <path d="M14 12h1" />
              <path d="M14 16h1" />
              <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
            </svg>
          </div>
          <span className="text-[13px] font-semibold leading-snug text-white">
            إجادة للتقييم
          </span>
        </div>
        <div className="border-b border-sidebar-border px-3.5 py-2.5">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-sidebar-label">
            تبديل الدور
          </div>
          <Select
            variant="sidebar"
            value={personaId}
            onChange={onPersonaChange}
            aria-label="تبديل الدور"
          >
            {GROUP_ORDER.map((g) => (
              <optgroup key={g} label={g}>
                {ROLE_OPTIONS.filter((o) => o.group === g).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>
        <nav
          id="nav"
          className="min-h-0 flex-1 overflow-y-auto pb-1"
          aria-label="التنقل الرئيسي"
        >
          {navRuns.map((run, ri) => {
            const blocks: React.ReactNode[] = [];
            blocks.push(
              <div key={`run-${ri}`}>
                {run.label ? (
                  <div>
                    <div className="px-3.5 pb-1.5 pt-3.5 text-[10px] font-medium uppercase tracking-wider text-sidebar-label">
                      {run.label}
                    </div>
                  </div>
                ) : null}
                {run.items.map((item) => {
                  const nodes: React.ReactNode[] = [];
                  const shouldInsertGeneral =
                    !generalNavInserted &&
                    showGeneralGroup &&
                    item.id === "financial";
                  if (shouldInsertGeneral) {
                    generalNavInserted = true;
                    nodes.push(
                      <div key="general-grp">
                        <div className="px-3.5 pb-1.5 pt-3.5 text-[10px] font-medium uppercase tracking-wider text-sidebar-label">
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
                  const shouldInsertActiveTx =
                    !activeTransactionsInserted &&
                    showActiveTransactionsGroup &&
                    ((insertActiveTxAfterPo && item.id === "po") ||
                      (!insertActiveTxAfterPo && item.id === "dashboard"));
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
                <div className="px-3.5 pb-1.5 pt-3.5 text-[10px] font-medium uppercase tracking-wider text-sidebar-label">
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
        <div
          className="shrink-0 border-t border-sidebar-border bg-sidebar px-0 py-1.5 pb-2.5"
          aria-label="قوائم النظام"
        >
          {showSystemFieldsGroup ? (
            <FooterNavDropdown
              groupLabel={SYSTEM_FIELDS_GROUP}
              groupIcon={SYSTEM_FIELDS_GROUP_ICON}
              panelId="nav-system-fields"
              items={systemFieldsNavItems}
              currentPage={currentPage}
              inSection={isInSystemFieldsSection(currentPage)}
              onPrefetch={prefetchPage}
            />
          ) : null}
          {showSettingsGroup ? (
            <FooterNavDropdown
              groupLabel={SETTINGS_GROUP}
              groupIcon={SETTINGS_GROUP_ICON}
              panelId="nav-settings"
              items={settingsNavItems}
              currentPage={currentPage}
              inSection={isInSettingsSection(currentPage)}
              onPrefetch={prefetchPage}
            />
          ) : null}
        </div>
      </div>
      <div id="main" className="flex min-w-0 flex-1 flex-col overflow-hidden bg-bg">
        <div
          id="topbar"
          className="flex h-topbar shrink-0 items-center justify-between gap-3 border-b-[0.5px] border-border bg-surface px-6"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <AppBreadcrumb segments={displayBreadcrumbSegments} />
            {!onPoPropertyDetail && !onActiveSurveyPropertyDetail
              ? (() => {
                  if (!resolvedPageTitle && !poChrome?.titlePo) return null;
                  return (
                    <div
                      className="text-sm font-semibold text-text"
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
                    </div>
                  );
                })()
              : null}
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            {onPoList ? <PoListTopbarActions /> : null}
            {poChrome?.propertyDetail ? (
              <PoPropertyDetailTopbarActions
                poNumber={poChrome.propertyDetail.poNumber}
                propertyId={poChrome.propertyDetail.propertyId}
              />
            ) : null}
            {onActiveSurveyPropertyDetail ? (
              <EngineeringSurveyTopbarActions />
            ) : null}
            <div className="flex items-center gap-[7px] rounded-[20px] border-[0.5px] border-border-md bg-surface-2 py-1 ps-1.5 pe-2.5">
              <div
                className="flex size-[26px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                id="uav"
                style={{ background: def.bg, color: def.tc }}
              >
                {def.init}
              </div>
              <div>
                <div className="text-xs font-medium" id="uname">
                  {chipName}
                </div>
                <div className="text-[10px] text-text-3" id="udept">
                  {def.dept}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          id="content"
          className="flex min-h-0 flex-1 flex-col items-stretch overflow-y-auto bg-bg p-0"
        >
          {showActiveTransactionsSituation &&
          currentPage !== "active-survey" &&
          !onActiveSurveyWorkspace &&
          !onCaseStudyWorkspace ? (
            <ActiveTransactionsSituationBar />
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}
