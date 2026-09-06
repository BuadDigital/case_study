"use client";

/** Sidebar rows and dropdowns. Icons/class recipes live in AppShellNavPrimitives; the nav model in app-shell-nav-state. */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@platform/ui-kit";
import { NavIcon } from "@/components/views/NavIcon";
import type { NavItem, PageId, RoleId } from "@platform/types";
import {
  ACTIVE_TRANSACTIONS_GROUP,
  ACTIVE_TRANSACTIONS_GROUP_ICON,
  type ActiveTransactionNavItem,
  isInActiveTransactionsSection,
} from "@platform/app-shared/app-data/active-transactions";
import {
  SYSTEM_SETTINGS_GROUP,
  SYSTEM_SETTINGS_GROUP_ICON,
  isInSystemSettingsSection,
  isSettingsNavItemActive,
  type SettingsNavTreeNode,
  type SystemSettingsNavItem,
} from "@platform/app-shared/app-data/system-settings-nav";
import {
  FINANCIAL_GROUP,
  FINANCIAL_GROUP_ICON,
  FINANCIAL_NAV_LEAVES,
  FINANCIAL_TOGGLE_LABEL,
  financialHref,
  isFinanceCoreArea,
  isInFinancialSection,
  type FinanceNavArea,
} from "@platform/app-shared/app-data/financial-nav";
import { useRailFlyoutDismiss } from "@/hooks/useRailFlyoutDismiss";
import {
  ChevronDownIcon,
  NavDropdownChevron,
  NavFlyoutPanel,
  NavPending,
  NavRailSeparator,
  navBadgeClasses,
  navGroupLabelClasses,
  navItemClasses,
  navLabelClasses,
} from "./AppShellNavPrimitives";

export function NavRow({
  item,
  active,
  onPrefetch,
  badgeCount,
  rail = false,
}: {
  item: NavItem;
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
      <NavPending fallback={badge} />
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
  href,
}: {
  id: PageId;
  label: string;
  icon: string;
  available: boolean;
  badgeCount?: number;
  active: boolean;
  onPrefetch: (page: PageId) => void;
  rail?: boolean;
  href?: string;
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
        <span className="ms-auto inline-flex shrink-0 items-center gap-1.5">
          <span className={navBadgeClasses(rail)}>{badgeCount}</span>
        </span>
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
      href={href ?? `/${id}`}
      className={cls}
      title={rail ? label : undefined}
      prefetch
      onMouseEnter={() => onPrefetch(id)}
      onFocus={() => onPrefetch(id)}
    >
      {inner}
      <NavPending />
    </Link>
  );
}

/**
 * Dropdown body rendered in one of three places: inline (expanded sidebar),
 * inline but hidden on desktop (rail, mobile drawer), and the rail flyout.
 */
function NavDropdownBody({
  id,
  label,
  open,
  rail,
  borderClass,
  children,
}: {
  id: string;
  label: string;
  open: boolean;
  rail: boolean;
  borderClass: string;
  children: () => React.ReactNode;
}) {
  if (!open) return null;
  if (!rail) {
    return (
      <div id={id} className={borderClass} role="group" aria-label={label}>
        {children()}
      </div>
    );
  }
  return (
    <>
      <div
        id={id}
        className={cn(borderClass, "lg:hidden")}
        role="group"
        aria-label={label}
      >
        {children()}
      </div>
      <NavFlyoutPanel label={label}>{children()}</NavFlyoutPanel>
    </>
  );
}

// Preload the finance-area chunk on hover/focus of its leaf (bundle-preload).
const preloadFinanceAreaChunk = (area: FinanceNavArea) =>
  void import("@financial/mfe/components/FinanceWorkspace").then((m) =>
    m.FINANCE_AREA_CHUNK_PRELOAD[area]?.(),
  );

/**
 * Finance.html sidebar (literally):
 *   nav-group: Finance
 *   fin-subnav leaves (My tasks · Revenue · Costs)
 *     — in-app: under "Finance & billing" because navActive/crumbs point there
 *   nav-group: Party portals — for impact demo
 *   nav-item: eng · inspector
 */
export function FinanceHtmlNav({
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
  /** Expand the tree when working in My tasks / Revenue / Costs. */
  const [open, setOpen] = useState(onCore);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- open/close with route.
    if (onCore) setOpen(true);
  }, [onCore]);

  useRailFlyoutDismiss(open, rail, rootRef, setOpen);

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
          onMouseEnter={() => preloadFinanceAreaChunk(leaf.area)}
          onFocus={() => preloadFinanceAreaChunk(leaf.area)}
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
      {/* .nav-group: Finance */}
      <div
        className={cn(
          "px-3 pb-1.5 pt-2 text-[11px] font-bold tracking-[0.04em] text-[#6f7b90]",
          rail && "lg:hidden",
        )}
      >
        {FINANCIAL_GROUP}
      </div>
      {rail ? <NavRailSeparator /> : null}

      {/* .nav-item toggle: Finance & billing */}
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

      <NavDropdownBody
        id="nav-financial-leaves"
        label={FINANCIAL_TOGGLE_LABEL}
        open={open}
        rail={rail}
        borderClass="ms-3 flex flex-col border-s border-white/[0.07] py-0.5"
      >
        {finLeaves}
      </NavDropdownBody>
    </div>
  );
}

export function ActiveTransactionsNavDropdown({
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

  useRailFlyoutDismiss(open, rail, rootRef, setOpen);

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
      <NavDropdownBody
        id="nav-active-transactions"
        label={ACTIVE_TRANSACTIONS_GROUP}
        open={open}
        rail={rail}
        borderClass="ms-3 flex flex-col border-s border-white/[0.06] py-0.5 pb-1"
      >
        {renderRows}
      </NavDropdownBody>
    </div>
  );
}

export function SystemSettingsNavDropdown({
  tree,
  currentPage,
  search,
  onPrefetch,
  role,
  rail = false,
}: {
  tree: SettingsNavTreeNode[];
  currentPage: PageId;
  search: string;
  onPrefetch: (page: PageId) => void;
  role: RoleId;
  rail?: boolean;
}) {
  const inSection = isInSystemSettingsSection(currentPage, role);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const node of tree) {
      if (node.type === "group") init[node.id] = false;
    }
    return init;
  });

  useEffect(() => {
    setExpanded((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const node of tree) {
        if (node.type !== "group") continue;
        if (next[node.id] === undefined) {
          next[node.id] = false;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [tree]);

  useEffect(() => {
    if (!inSection) return;
    setExpanded((prev) => {
      const next = { ...prev };
      for (const node of tree) {
        if (node.type !== "group") continue;
        if (
          node.items.some((item) =>
            isSettingsNavItemActive(item, currentPage, "", search),
          )
        ) {
          next[node.id] = true;
        }
      }
      return next;
    });
  }, [currentPage, inSection, search, tree]);

  useRailFlyoutDismiss(open, rail, rootRef, setOpen);

  const renderItem = (item: SystemSettingsNavItem) => (
    <ActiveTransactionNavRow
      key={item.navKey}
      id={item.id}
      href={item.href}
      label={item.label}
      icon={item.icon}
      available
      active={isSettingsNavItemActive(item, currentPage, "", search)}
      onPrefetch={onPrefetch}
    />
  );

  const renderBody = () => (
    <>
      {tree.map((node, index) => {
        if (node.type === "divider") {
          return (
            <div
              key={`div-${index}`}
              className="mx-1 my-1.5 h-px bg-white/[0.08]"
            />
          );
        }
        if (node.type === "item") return renderItem(node.item);
        const groupOpen = !!expanded[node.id];
        return (
          <div key={node.id} className="flex flex-col">
            <button
              type="button"
              className="flex w-full items-center justify-between border-0 bg-transparent px-2.5 py-1.5 text-start font-inherit text-[11.5px] font-bold text-white/45"
              onClick={() =>
                setExpanded((prev) => ({ ...prev, [node.id]: !prev[node.id] }))
              }
            >
              <span>{node.label}</span>
              <span
                className={cn(
                  "inline-flex opacity-60 transition-transform duration-150",
                  groupOpen ? "rotate-0" : "-rotate-90",
                )}
                aria-hidden
              >
                <ChevronDownIcon />
              </span>
            </button>
            {groupOpen ? node.items.map(renderItem) : null}
          </div>
        );
      })}
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
      <NavDropdownBody
        id="nav-system-settings"
        label={SYSTEM_SETTINGS_GROUP}
        open={open}
        rail={rail}
        borderClass="ms-3 flex flex-col border-s border-white/[0.06] py-0.5 pb-1"
      >
        {renderBody}
      </NavDropdownBody>
    </div>
  );
}

/** "عام" heading + system settings dropdown — shared by the anchored and fallback slots. */
export function GeneralSettingsNavGroup({
  rail,
  ...dropdown
}: Omit<Parameters<typeof SystemSettingsNavDropdown>[0], "rail"> & { rail: boolean }) {
  return (
    <>
      <div className={navGroupLabelClasses(rail)}>عام</div>
      {rail ? <NavRailSeparator /> : null}
      <SystemSettingsNavDropdown rail={rail} {...dropdown} />
    </>
  );
}
