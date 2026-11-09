import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createInspectorWorkspaceDraft } from "@platform/app-shared/app-data/inspector-workspace-data";
import type { PoPropertyIntake } from "../../../lib/app-data/po-intake-data";

vi.mock("@platform/ui-kit", async (original) => ({
  ...(await original<typeof import("@platform/ui-kit")>()),
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("../../../query/use-facade-options", () => ({ useFacadeOptions: () => undefined }));

import { InspectorBoundaryMatchTable } from "../InspectorBoundaryMatchTable";

const draft = createInspectorWorkspaceDraft({ taskId: "t1", propertyId: "p1", poNumber: "PO-1" });
const renderTable = (boundariesAvailability: string) =>
  render(
    <InspectorBoundaryMatchTable
      property={{ id: "p1", boundariesAvailability } as unknown as PoPropertyIntake}
      draft={draft}
      editable
      onPatch={vi.fn()}
    />,
  );

/** Omar 2026-11-04: «الحدود غير متوفرة» in the bourse no longer hides the card from the inspector. */
describe("the inspector's «الحدود والأطوال» card", () => {
  it("shows even when the bourse marked the boundaries unavailable, and says so", () => {
    renderTable("no");
    expect(screen.getByText("الحدود والأطوال")).toBeTruthy();
    expect(screen.getByText(/الحدود غير متوفرة في البورصة/)).toBeTruthy();
  });

  it("shows without the note when the bourse has the boundaries", () => {
    renderTable("bourse");
    expect(screen.getByText("الحدود والأطوال")).toBeTruthy();
    expect(screen.queryByText(/الحدود غير متوفرة في البورصة/)).toBeNull();
  });
});
