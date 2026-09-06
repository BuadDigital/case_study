import { describe, expect, it } from "vitest";
import type { NavItem, PageId } from "@platform/types";
import {
  buildNavRuns,
  isNavRowActive,
  navRunsForRole,
  planSidebarNav,
  resolveActiveTxInsertion,
  resolveShellRoute,
  sortPartyFeesBeforeFailures,
  type NavRun,
} from "../app-shell-nav-state";

const nav = (id: string, grp: string | null = null): NavItem =>
  ({ id: id as PageId, label: id, icon: "", grp }) as NavItem;

describe("buildNavRuns", () => {
  it("splits consecutive groups into labelled runs and ungrouped items into unlabelled runs", () => {
    const runs = buildNavRuns([
      nav("dashboard"),
      nav("po", "A"),
      nav("keys", "A"),
      nav("failures", "B"),
      nav("profile"),
      nav("users"),
    ]);
    expect(runs.map((r) => [r.label, r.items.map((i) => i.id)])).toEqual([
      [null, ["dashboard"]],
      ["A", ["po", "keys"]],
      ["B", ["failures"]],
      [null, ["profile", "users"]],
    ]);
  });

  it("returns no runs for an empty nav", () => {
    expect(buildNavRuns([])).toEqual([]);
  });
});

describe("navRunsForRole", () => {
  const runs: NavRun[] = [
    { label: null, items: [nav("dashboard")] },
    { label: "A", items: [nav("failures", "A"), nav("po", "A"), nav("party-fees", "A")] },
  ];

  it("drops rows the role cannot see and empty runs", () => {
    expect(navRunsForRole(["po"], "cdo", runs)).toEqual([
      { label: "A", items: [nav("po", "A")] },
    ]);
  });

  it("puts party fees ahead of failures for party roles only", () => {
    const pages: PageId[] = ["failures", "po", "party-fees"];
    expect(
      navRunsForRole(pages, "field-inspector", runs)[0]!.items.map((i) => i.id),
    ).toEqual(["po", "party-fees", "failures"]);
    expect(navRunsForRole(pages, "cdo", runs)[0]!.items.map((i) => i.id)).toEqual([
      "failures",
      "po",
      "party-fees",
    ]);
  });

  it("keeps unrelated rows in place when sorting fees before failures", () => {
    expect(
      sortPartyFeesBeforeFailures([nav("failures"), nav("keys"), nav("party-fees")]).map(
        (i) => i.id,
      ),
    ).toEqual(["keys", "party-fees", "failures"]);
  });
});

describe("isNavRowActive", () => {
  it("matches the current page and lets the PO row own the PO section", () => {
    expect(isNavRowActive("keys", "keys", false)).toBe(true);
    expect(isNavRowActive("keys", "po", false)).toBe(false);
    expect(isNavRowActive("po", "dashboard", true)).toBe(true);
  });
});

describe("resolveActiveTxInsertion", () => {
  const runs: NavRun[] = [{ label: null, items: [nav("dashboard"), nav("po")] }];

  it("anchors on all-transactions before po", () => {
    expect(resolveActiveTxInsertion(["po", "all-transactions"], "cdo", runs)).toEqual({
      anchor: "all-transactions",
      atNavStart: false,
      anchorId: "all-transactions",
    });
    expect(resolveActiveTxInsertion(["po"], "cdo", runs).anchorId).toBe("po");
  });

  it("puts party roles without an anchor at the nav start", () => {
    expect(resolveActiveTxInsertion(["operations-tasks"], "field-inspector", runs)).toEqual({
      anchor: null,
      atNavStart: true,
      anchorId: null,
    });
    expect(resolveActiveTxInsertion(["po"], "field-inspector", runs).atNavStart).toBe(false);
  });

  it("falls back to the first visible row for other roles", () => {
    expect(resolveActiveTxInsertion(["dashboard"], "cdo", runs).anchorId).toBe("dashboard");
    expect(resolveActiveTxInsertion([], "cdo", []).anchorId).toBeNull();
  });
});

describe("planSidebarNav", () => {
  const runs: NavRun[] = [
    { label: null, items: [nav("dashboard")] },
    { label: "A", items: [nav("po", "A"), nav("suspended-transactions", "A")] },
  ];

  it("slots finance under suspended transactions, general after the last row, active-tx after its anchor", () => {
    const plan = planSidebarNav(runs, {
      activeTx: { anchor: "po", atNavStart: false, anchorId: "po" },
      showActiveTx: true,
      showFinancial: true,
      showGeneral: true,
    });
    expect(plan.leading).toEqual([]);
    expect(plan.runs.map((r) => r.rows.map((row) => [row.item.id, row.after]))).toEqual([
      [["dashboard", []]],
      [
        ["po", ["active-tx"]],
        ["suspended-transactions", ["finance", "general"]],
      ],
    ]);
    expect(plan.trailing).toEqual([]);
  });

  it("renders active-tx before the first run for party roles and never twice", () => {
    const plan = planSidebarNav(runs, {
      activeTx: { anchor: null, atNavStart: true, anchorId: null },
      showActiveTx: true,
      showFinancial: false,
      showGeneral: false,
    });
    expect(plan.leading).toEqual(["active-tx"]);
    expect(plan.runs.flatMap((r) => r.rows.flatMap((row) => row.after))).toEqual([]);
    expect(plan.trailing).toEqual([]);
  });

  it("falls back to trailing groups in a fixed order when no row anchors them", () => {
    const plan = planSidebarNav([{ label: null, items: [] }], {
      activeTx: { anchor: null, atNavStart: false, anchorId: "po" },
      showActiveTx: true,
      showFinancial: true,
      showGeneral: true,
    });
    expect(plan.trailing).toEqual(["active-tx", "finance", "general"]);
  });

  it("omits hidden groups everywhere", () => {
    const plan = planSidebarNav(runs, {
      activeTx: { anchor: "po", atNavStart: false, anchorId: "po" },
      showActiveTx: false,
      showFinancial: false,
      showGeneral: false,
    });
    expect(plan.leading).toEqual([]);
    expect(plan.trailing).toEqual([]);
    expect(plan.runs.flatMap((r) => r.rows.flatMap((row) => row.after))).toEqual([]);
  });
});

describe("resolveShellRoute", () => {
  it("defaults to the dashboard with no pathname", () => {
    const route = resolveShellRoute(null);
    expect(route.currentPage).toBe("dashboard");
    expect(route.pathParts).toEqual([]);
    expect(route.inPoSection).toBe(false);
    expect(route.hideShellTopbar).toBe(false);
  });

  it("owns the PO section for the list and every detail route", () => {
    expect(resolveShellRoute("/po").inPoSection).toBe(true);
    expect(resolveShellRoute("/po/PO-1/x").inPoSection).toBe(true);
    expect(resolveShellRoute("/keys").inPoSection).toBe(false);
  });

  it("recognises the case-study workspace and its task id", () => {
    const route = resolveShellRoute("/case-study/abc");
    expect(route.onCaseStudyWorkspace).toBe(true);
    expect(route.caseStudyTaskId).toBe("abc");
    expect(resolveShellRoute("/case-study").onCaseStudyWorkspace).toBe(false);
  });

  it("locks content scroll and hides the topbar on field inspection workspaces", () => {
    for (const path of ["/active-inspection/t1", "/property-inspection/t1"]) {
      const route = resolveShellRoute(path);
      expect(route.onFieldInspectionWorkspace).toBe(true);
      expect(route.fieldInspectionTaskId).toBe("t1");
      expect(route.contentScrollLocked).toBe(true);
      expect(route.hideShellTopbar).toBe(true);
    }
    expect(resolveShellRoute("/active-inspection").onFieldInspectionWorkspace).toBe(false);
  });

  it("locks scroll on the property map without hiding the topbar", () => {
    const route = resolveShellRoute("/property-map");
    expect(route.contentScrollLocked).toBe(true);
    expect(route.hideShellTopbar).toBe(false);
  });

  it("flags survey entry and appraisal workspaces with their task ids", () => {
    const entry = resolveShellRoute("/active-survey/s1/entry");
    expect(entry.onActiveSurveyRoute).toBe(true);
    expect(entry.onActiveSurveyEntry).toBe(true);
    expect(entry.activeSurveyTaskId).toBe("s1");
    expect(resolveShellRoute("/active-survey/s1").onActiveSurveyEntry).toBe(false);
    const appraisal = resolveShellRoute("/property-appraisal/a1");
    expect(appraisal.onPropertyAppraisalWorkspace).toBe(true);
    expect(appraisal.propertyAppraisalTaskId).toBe("a1");
    expect(appraisal.contentScrollLocked).toBe(false);
  });
});
