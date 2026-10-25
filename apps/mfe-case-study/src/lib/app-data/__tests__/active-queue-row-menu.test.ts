import { describe, expect, it, vi } from "vitest";
import type { RoleId } from "@platform/types";
import type { WorkflowTask } from "../tasks";

vi.mock("@failures/mfe/lib/failures-repository", () => ({
  getPropertyFailure: () => null,
}));
vi.mock("../site-location-ack-open", () => ({
  openSiteLocationAckForInspectionTask: vi.fn(),
}));
vi.mock("../tasks", () => ({
  deletePrimaryDataTransaction: vi.fn(),
  revertTaskToPhase: vi.fn(),
}));

import { buildActiveQueueRowMoreItems } from "../active-queue-row-menu";

function menuIds(phase: string, viewerRole?: RoleId) {
  return buildActiveQueueRowMoreItems({
    task: {
      id: "t1",
      kind: "case-study-property",
      poNumber: "PO-1",
      phase,
    } as unknown as WorkflowTask,
    openTask: () => undefined,
    router: { push: () => undefined },
    allowPhaseRevert: true,
    viewerRole,
  }).map((item) => item.id);
}

describe("active queue row menu — phase revert", () => {
  it("offers the revert to the case specialist, the CDO and the section supervisor", () => {
    for (const role of ["section-supervisor", "case-specialist", "cdo"] as const) {
      expect(menuIds("distribution", role)).toContain("revert-bourse");
      expect(menuIds("bourse", role)).toContain("revert-enfath");
    }

    expect(menuIds("distribution", "general-manager")).not.toContain("revert-bourse");
    expect(menuIds("bourse", "general-manager")).not.toContain("revert-enfath");
    expect(menuIds("bourse")).not.toContain("revert-enfath");
  });
});

describe("active queue row menu — register failure", () => {
  it("offers «تسجيل تعذّر» on primary data and bourse rows to roles that may raise one", () => {
    const ids = (phase: string, viewerRole?: RoleId) =>
      buildActiveQueueRowMoreItems({
        task: {
          id: "t1",
          kind: "case-study-property",
          poNumber: "PO-1",
          phase,
        } as unknown as WorkflowTask,
        propertyId: "p1",
        openTask: () => undefined,
        router: { push: () => undefined },
        viewerRole,
      }).map((item) => item.id);

    expect(ids("enfath", "case-specialist")).toContain("register-failure");
    expect(ids("bourse", "section-supervisor")).toContain("register-failure");
    expect(ids("distribution", "case-specialist")).not.toContain("register-failure");
    expect(ids("enfath")).not.toContain("register-failure");
  });
});
