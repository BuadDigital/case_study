/**
 * Pure nav model behind `AppShell` / `AppShellSidebar`: the grouped NAV runs, the
 * per-role filter, where the active-transactions dropdown anchors, the sidebar
 * insertion plan for the extra groups, and the route flags the shell derives
 * from the pathname. No React, no I/O — the hooks call these and the sidebar
 * only renders their output.
 */
import type { NavItem, PageId, RoleId } from "@platform/types";
import { NAV } from "@platform/app-shared/app-data/constants";

export type NavRun = { label: string | null; items: NavItem[] };

/** Consecutive items that share a `grp` form one labelled run; ungrouped items form unlabelled runs. */
export function buildNavRuns(nav: readonly NavItem[]): NavRun[] {
  const runs: NavRun[] = [];
  let lastGrp: string | null = null;
  let cur: NavRun | null = null;
  for (const item of nav) {
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

// Computed once at module load — NAV is a constant so this never changes.
const ALL_NAV_RUNS: NavRun[] = buildNavRuns(NAV);

/** Transaction parties — fees first, then failures immediately below. */
export function sortPartyFeesBeforeFailures(items: NavItem[]): NavItem[] {
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

export function navRunsForRole(
  rolePages: PageId[],
  role: RoleId,
  runs: NavRun[] = ALL_NAV_RUNS,
): NavRun[] {
  return runs
    .map((run) => {
      let items = run.items.filter((item) => rolePages.includes(item.id));
      if (role === "engineering-office" || role === "field-inspector") {
        items = sortPartyFeesBeforeFailures(items);
      }
      return { ...run, items };
    })
    .filter((run) => run.items.length > 0);
}

/** A plain nav row is active on its own page; the PO row also owns every `/po/...` route. */
export function isNavRowActive(
  itemId: PageId,
  currentPage: PageId,
  inPoSection: boolean,
): boolean {
  return currentPage === itemId || (itemId === "po" && inPoSection);
}

export type ActiveTxInsertion = {
  /** Explicit anchor row (all-transactions, else po) when the role has one. */
  anchor: PageId | null;
  /** Party roles without an anchor get the dropdown before the first run. */
  atNavStart: boolean;
  /** Row after which the dropdown renders; null when it renders at nav start. */
  anchorId: PageId | null;
};

export function resolveActiveTxInsertion(
  rolePages: PageId[],
  role: RoleId,
  navRuns: NavRun[],
): ActiveTxInsertion {
  const anchor: PageId | null = rolePages.includes("all-transactions")
    ? "all-transactions"
    : rolePages.includes("po")
      ? "po"
      : null;
  const atNavStart =
    (role === "engineering-office" ||
      role === "field-inspector" ||
      role === "government-reviewer") &&
    !anchor;
  const anchorId = anchor
    ? anchor
    : atNavStart
      ? null
      : (navRuns.flatMap((run) => run.items)[0]?.id ?? null);
  return { anchor, atNavStart, anchorId };
}

export type SidebarInsert = "active-tx" | "finance" | "general";

export type SidebarNavPlan = {
  /** Groups rendered before the first run. */
  leading: SidebarInsert[];
  runs: { label: string | null; rows: { item: NavItem; after: SidebarInsert[] }[] }[];
  /** Groups that found no anchor row and render after the last run. */
  trailing: SidebarInsert[];
};

export type SidebarNavPlanInput = {
  activeTx: ActiveTxInsertion;
  showActiveTx: boolean;
  showFinancial: boolean;
  showGeneral: boolean;
};

/**
 * Where the extra sidebar groups slot in, per row: finance directly under
 * "suspended transactions", general (system settings) after the last row of
 * the last run, active transactions after its anchor row. Each group is
 * inserted at most once; whatever finds no row falls to `trailing`.
 */
export function planSidebarNav(
  navRuns: NavRun[],
  { activeTx, showActiveTx, showFinancial, showGeneral }: SidebarNavPlanInput,
): SidebarNavPlan {
  const leading: SidebarInsert[] = [];
  let activeTxInserted = false;
  if (activeTx.atNavStart && showActiveTx) {
    leading.push("active-tx");
    activeTxInserted = true;
  }
  let generalInserted = false;
  let financeInserted = false;

  const runs = navRuns.map((run, ri) => ({
    label: run.label,
    rows: run.items.map((item) => {
      const after: SidebarInsert[] = [];
      if (
        item.id === "suspended-transactions" &&
        showFinancial &&
        !financeInserted
      ) {
        financeInserted = true;
        after.push("finance");
      }
      if (
        !generalInserted &&
        showGeneral &&
        run.items[run.items.length - 1]?.id === item.id &&
        ri === navRuns.length - 1
      ) {
        generalInserted = true;
        after.push("general");
      }
      if (
        !activeTxInserted &&
        showActiveTx &&
        activeTx.anchorId !== null &&
        item.id === activeTx.anchorId
      ) {
        activeTxInserted = true;
        after.push("active-tx");
      }
      return { item, after };
    }),
  }));

  const trailing: SidebarInsert[] = [];
  if (!activeTxInserted && showActiveTx) trailing.push("active-tx");
  if (!financeInserted && showFinancial) trailing.push("finance");
  if (!generalInserted && showGeneral) trailing.push("general");
  return { leading, runs, trailing };
}

export type ShellRoute = {
  pathParts: string[];
  currentPage: PageId;
  /** `/po` list and every `/po/...` detail route. */
  inPoSection: boolean;
  onCaseStudyWorkspace: boolean;
  onActiveSurveyRoute: boolean;
  onActiveSurveyEntry: boolean;
  onPropertyAppraisalWorkspace: boolean;
  onFieldInspectionWorkspace: boolean;
  /** Workspace pages lock `#content` scroll — disable shell pull-to-refresh there. */
  contentScrollLocked: boolean;
  /** Field inspection workspace: the in-page back/title card is the only header. */
  hideShellTopbar: boolean;
  caseStudyTaskId: string | null;
  activeSurveyTaskId: string | null;
  propertyAppraisalTaskId: string | null;
  fieldInspectionTaskId: string | null;
};

export function resolveShellRoute(pathname: string | null | undefined): ShellRoute {
  const pathParts = pathname?.split("/").filter(Boolean) ?? [];
  const currentPage = (pathParts[0] ?? "dashboard") as PageId;
  const onCaseStudyWorkspace = pathname?.startsWith("/case-study/") ?? false;
  const onActiveSurveyRoute =
    pathParts[0] === "active-survey" && pathParts.length >= 2;
  const onPropertyAppraisalWorkspace =
    pathParts[0] === "property-appraisal" && pathParts.length >= 2;
  const onActiveInspectionWorkspace =
    pathParts[0] === "active-inspection" && pathParts.length >= 2;
  const onPropertyInspectionWorkspace =
    pathParts[0] === "property-inspection" && pathParts.length >= 2;
  const onFieldInspectionWorkspace =
    onActiveInspectionWorkspace || onPropertyInspectionWorkspace;
  return {
    pathParts,
    currentPage,
    inPoSection: pathname?.startsWith("/po") ?? false,
    onCaseStudyWorkspace,
    onActiveSurveyRoute,
    onActiveSurveyEntry: onActiveSurveyRoute && pathParts[2] === "entry",
    onPropertyAppraisalWorkspace,
    onFieldInspectionWorkspace,
    contentScrollLocked:
      onFieldInspectionWorkspace || pathParts[0] === "property-map",
    hideShellTopbar: onFieldInspectionWorkspace,
    caseStudyTaskId: onCaseStudyWorkspace ? (pathParts[1] ?? null) : null,
    activeSurveyTaskId: onActiveSurveyRoute ? (pathParts[1] ?? null) : null,
    propertyAppraisalTaskId: onPropertyAppraisalWorkspace
      ? (pathParts[1] ?? null)
      : null,
    fieldInspectionTaskId: onFieldInspectionWorkspace
      ? (pathParts[1] ?? null)
      : null,
  };
}
