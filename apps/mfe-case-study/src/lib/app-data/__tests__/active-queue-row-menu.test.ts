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
  it("offers the revert to the section supervisor only", () => {
    expect(menuIds("distribution", "section-supervisor")).toContain(
      "revert-bourse",
    );
    expect(menuIds("bourse", "section-supervisor")).toContain("revert-enfath");

    for (const role of ["case-specialist", "general-manager", "cdo"] as const) {
      expect(menuIds("distribution", role)).not.toContain("revert-bourse");
      expect(menuIds("bourse", role)).not.toContain("revert-enfath");
    }
    expect(menuIds("bourse")).not.toContain("revert-enfath");
  });
});
