import { describe, expect, it } from "vitest";
import { PAGE_TITLES } from "@platform/app-shared/app-data/constants";
import { resolveShellRoute } from "../app-shell-nav-state";
import {
  isOnTaskWork,
  pickWorkspaceTaskRef,
  propertyWorkspaceDeedLabel,
  resolveKeysChrome,
  resolveMyTasksTaskId,
  resolveOpsTaskTitle,
  resolveOrgSettingsChrome,
  resolvePageChrome,
  resolvePropertyWorkspaceBreadcrumb,
  type PageChromeInput,
} from "../app-shell-chrome-state";

const search = (entries: Record<string, string> = {}) => ({
  get: (name: string) => entries[name] ?? null,
});

describe("resolveKeysChrome / resolveOrgSettingsChrome", () => {
  it("shows the envelope leaf, then the fees tab, else nothing on keys", () => {
    expect(resolveKeysChrome("keys", search({ envelope: " e1 " }))).toEqual({
      title: "ملف الظرف",
      breadcrumb: "ملف الظرف",
    });
    expect(resolveKeysChrome("keys", search({ tab: "fees" }))).toEqual({
      title: "تقرير الأتعاب",
      breadcrumb: "تقرير الأتعاب",
    });
    expect(resolveKeysChrome("keys", search({ envelope: "  " }))).toBeNull();
    expect(resolveKeysChrome("po", search({ envelope: "e1" }))).toBeNull();
  });

  it("labels the organization settings tab only on that page", () => {
    const chrome = resolveOrgSettingsChrome("organization-settings", search({ tab: "branding" }));
    expect(chrome).toEqual({ title: "الهوية البصرية", breadcrumb: "الهوية البصرية" });
    expect(resolveOrgSettingsChrome("keys", search({ tab: "branding" }))).toBeNull();
  });
});

describe("resolveMyTasksTaskId", () => {
  it("uses the workspace route id ahead of the query", () => {
    expect(resolveMyTasksTaskId(resolveShellRoute("/case-study/cs1"), "q")).toBe("cs1");
    expect(resolveMyTasksTaskId(resolveShellRoute("/active-survey/s1"), "q")).toBe("s1");
    expect(resolveMyTasksTaskId(resolveShellRoute("/property-appraisal/a1"), "q")).toBe("a1");
    expect(resolveMyTasksTaskId(resolveShellRoute("/active-inspection/i1"), "q")).toBe("i1");
  });

  it("falls back to the query on queue pages and to nothing elsewhere", () => {
    expect(resolveMyTasksTaskId(resolveShellRoute("/operations-tasks"), "op1")).toBe("op1");
    expect(resolveMyTasksTaskId(resolveShellRoute("/all-transactions"), null)).toBeNull();
    expect(resolveMyTasksTaskId(resolveShellRoute("/keys"), "op1")).toBeNull();
  });
});

describe("isOnTaskWork", () => {
  it("needs a task query on queue pages but not on workspace routes", () => {
    expect(isOnTaskWork(resolveShellRoute("/active-primary-data"), "/active-primary-data", "t")).toBe(true);
    expect(isOnTaskWork(resolveShellRoute("/active-primary-data"), "/active-primary-data", null)).toBe(false);
    expect(isOnTaskWork(resolveShellRoute("/active-survey/s1"), "/active-survey/s1", null)).toBe(true);
    expect(isOnTaskWork(resolveShellRoute("/property-appraisal/a1"), "/property-appraisal/a1", null)).toBe(true);
    expect(isOnTaskWork(resolveShellRoute("/keys"), "/keys", "t")).toBe(false);
  });
});

describe("workspace task helpers", () => {
  const tasks = [
    { id: "t1", poNumber: "PO-1", propertyId: "p1" },
    { id: "t2", poNumber: "PO-2", propertyId: "p2" },
  ];

  it("picks the PO/property for a route param and ignores unknown ids", () => {
    expect(pickWorkspaceTaskRef(tasks, "t2")).toEqual({ poNumber: "PO-2", propertyId: "p2" });
    expect(pickWorkspaceTaskRef(tasks, "missing")).toBeNull();
    expect(pickWorkspaceTaskRef(tasks, null)).toBeNull();
  });

  it("resolves the operations task title by id, then display id", () => {
    const ops = [
      { id: "o1", displayId: "OT-1", title: " First " },
      { id: "o2", displayId: "OT-2", title: "" },
    ];
    expect(resolveOpsTaskTitle("o1", ops)).toBe("First");
    expect(resolveOpsTaskTitle("OT-1", ops)).toBe("First");
    expect(resolveOpsTaskTitle("o2", ops)).toBeUndefined();
    expect(resolveOpsTaskTitle("o1", [])).toBeUndefined();
    expect(resolveOpsTaskTitle(null, ops)).toBeUndefined();
  });

  it("labels the workspace deed and falls back to the raw deed number", () => {
    const po = {
      properties: [
        { id: "p1", identifierType: "deed", deedNumber: " 123 ", realEstateRegNumber: "" },
      ],
    } as Parameters<typeof propertyWorkspaceDeedLabel>[1];
    expect(propertyWorkspaceDeedLabel({ propertyId: "p1" }, po)).not.toBe("");
    expect(propertyWorkspaceDeedLabel({ propertyId: "nope" }, po)).toBe("");
    expect(propertyWorkspaceDeedLabel(null, po)).toBe("");
    expect(propertyWorkspaceDeedLabel({ propertyId: "p1" }, null)).toBe("");
  });

  it("builds the PO/property breadcrumb only on workspace routes with a PO", () => {
    const route = resolveShellRoute("/case-study/cs1");
    expect(resolvePropertyWorkspaceBreadcrumb(route, { poNumber: " " }, "")).toBeNull();
    expect(resolvePropertyWorkspaceBreadcrumb(resolveShellRoute("/keys"), { poNumber: "PO-1" }, "")).toBeNull();
    const segments = resolvePropertyWorkspaceBreadcrumb(route, { poNumber: "PO-1" }, "deed");
    expect(segments).not.toBeNull();
    expect(segments!.length).toBeGreaterThan(0);
  });
});

describe("resolvePageChrome", () => {
  const base: PageChromeInput = {
    currentPage: "keys",
    role: "cdo",
    financeArea: "tasks",
    poChrome: null,
    propertyWorkspaceBreadcrumb: null,
    myTasksChrome: null,
    keysChrome: null,
    orgSettingsChrome: null,
  };

  it("falls back to the static page breadcrumb and title", () => {
    const chrome = resolvePageChrome(base);
    expect(chrome.title).toBe(PAGE_TITLES.keys);
    expect(chrome.breadcrumbSegments.length).toBeGreaterThan(0);
  });

  it("lets PO chrome win over everything", () => {
    const chrome = resolvePageChrome({
      ...base,
      poChrome: { segments: [{ label: "PO" }], title: "PO title" },
      keysChrome: { title: "k", breadcrumb: "k" },
    });
    expect(chrome.title).toBe("PO title");
    expect(chrome.breadcrumbSegments).toEqual([{ label: "PO" }]);
  });

  it("orders my-tasks before keys before organization settings", () => {
    expect(
      resolvePageChrome({
        ...base,
        myTasksChrome: { title: "MT", breadcrumb: "a / b" },
        keysChrome: { title: "K", breadcrumb: "k" },
      }),
    ).toMatchObject({ title: "MT", breadcrumbSegments: [{ label: "a" }, { label: "b" }] });
    expect(
      resolvePageChrome({
        ...base,
        keysChrome: { title: "K", breadcrumb: "k" },
        orgSettingsChrome: { title: "O", breadcrumb: "o" },
      }).title,
    ).toBe("K");
  });

  it("nests party fees under active transactions for party roles", () => {
    const chrome = resolvePageChrome({
      ...base,
      currentPage: "party-fees",
      role: "engineering-office",
    });
    expect(chrome.title).toBe("فوترة الأتعاب");
    expect(chrome.breadcrumbSegments.map((s) => s.label)).toEqual([
      "المعاملات النشطة",
      "فوترة الأتعاب",
    ]);
    expect(resolvePageChrome({ ...base, currentPage: "party-fees", role: "cdo" }).title).toBe(
      PAGE_TITLES["party-fees"],
    );
  });

  it("uses the finance leaf for the financial page", () => {
    const chrome = resolvePageChrome({ ...base, currentPage: "financial", financeArea: "revenue" });
    expect(chrome.title).not.toBe("");
    expect(chrome.breadcrumbSegments.length).toBeGreaterThan(0);
  });
});
