import { describe, expect, it } from "vitest";
import { ROLES } from "@platform/app-shared/app-data/constants";
import { offlinePagePlan } from "../offline-page-cache";

describe("offlinePagePlan", () => {
  it("keeps the inspector's queue and each inspection task", () => {
    const plan = offlinePagePlan(ROLES["field-inspector"].pages, [
      { id: "t-1", kind: "field-inspection" },
      { id: "t-2", kind: "property-appraisal" },
      { Id: "t-3", Kind: "field-inspection" },
    ]);

    expect(plan.urls).toContain("/active-inspection");
    expect(plan.urls).toContain("/operations-tasks");
    expect(plan.urls).toContain("/active-inspection/t-1");
    expect(plan.urls).toContain("/active-inspection/t-3");
    expect(plan.urls).not.toContain("/active-inspection/t-2");
    expect(plan.urls).toContain(plan.landing);
  });

  it("keeps the government reviewer's operations tasks and keys screens", () => {
    const plan = offlinePagePlan(ROLES["government-reviewer"].pages, []);

    expect(plan.urls).toContain("/operations-tasks");
    expect(plan.urls).toContain("/keys");
    expect(plan.urls.some((url) => url.startsWith("/active-inspection"))).toBe(
      false,
    );
    expect(plan.urls).toContain(plan.landing);
  });

  it("keeps only input-form screens — no dashboard or PO browsing offline", () => {
    const plan = offlinePagePlan(
      ["dashboard", "po", "favorites", "active-inspection"],
      [{ id: "t-1", kind: "field-inspection" }],
    );

    expect(plan.urls).toEqual(["/active-inspection", "/active-inspection/t-1"]);
    expect(plan.landing).toBe("/active-inspection");
  });

  it("has nothing to keep for a role without form screens", () => {
    expect(offlinePagePlan(["dashboard"], [])).toEqual({ urls: [], landing: null });
  });
});
