import { describe, expect, it } from "vitest";
import { ROLES } from "../../app-data/constants";
import {
  isOfflineFormPath,
  offlineFormPages,
  offlineLandingPath,
} from "../offline-routes";
import { offlineListPage } from "../offline-list";

describe("spec §3.1 — offline field roles get input forms only", () => {
  it("keeps the inspector on the inspection queue and operations tasks", () => {
    const pages = ROLES["field-inspector"].pages;
    expect(offlineFormPages(pages)).toEqual(["active-inspection", "operations-tasks"]);
    expect(offlineLandingPath(pages)).toBe("/active-inspection");
  });

  it("keeps the government reviewer on operations tasks and keys", () => {
    const pages = ROLES["government-reviewer"].pages;
    expect(offlineFormPages(pages)).toEqual(["operations-tasks", "keys"]);
    expect(offlineLandingPath(pages)).toBe("/operations-tasks");
  });

  it("treats a task under a form screen as a form, and browsing screens as not", () => {
    expect(isOfflineFormPath("/active-inspection/task-1")).toBe(true);
    expect(isOfflineFormPath("/keys")).toBe(true);
    expect(isOfflineFormPath("/dashboard")).toBe(false);
    expect(isOfflineFormPath("/po/PO-1")).toBe(false);
    expect(isOfflineFormPath("/")).toBe(false);
  });
});

describe("offlineListPage", () => {
  it("pages a downloaded list like the server would", () => {
    const rows = Array.from({ length: 30 }, (_, i) => i);
    const page = offlineListPage(rows, { page: 2, pageSize: 25 });
    expect(page).toEqual({
      rows: [25, 26, 27, 28, 29],
      totalCount: 30,
      page: 2,
      pageSize: 25,
      totalPages: 2,
    });
    expect(offlineListPage([], { page: 3 })).toMatchObject({
      rows: [],
      page: 1,
      totalPages: 1,
    });
  });
});
