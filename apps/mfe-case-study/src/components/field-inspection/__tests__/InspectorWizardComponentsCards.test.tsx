import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createInspectorWorkspaceDraft } from "@platform/app-shared/app-data/inspector-workspace-data";
import { INSPECTOR_COMPONENT_COUNT_FIELDS } from "../inspector-wizard-state";

vi.mock("@platform/ui-kit", async (original) => ({
  ...(await original<typeof import("@platform/ui-kit")>()),
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock("../InspectorComponentBoolPills", () => ({
  InspectorComponentBoolPills: () => null,
  InspectorPresentChip: ({ label }: { label: string }) => <span>{label}</span>,
}));
vi.mock("../../po-intake/PropertyDetailInspectionDateField", () => ({
  InsDualCalendarDateField: () => null,
}));

import { InspectorWizardComponentsCards } from "../InspectorWizardComponentsCards";

function renderCards(over: { isShop?: boolean; hasAnnex?: "" | "نعم" | "لا" } = {}) {
  const onPatch = vi.fn();
  const draft = {
    ...createInspectorWorkspaceDraft({ taskId: "t1", propertyId: "p1", poNumber: "PO-1" }),
    hasAnnex: over.hasAnnex ?? "",
    annexUpperCount: "2",
  };
  render(
    <InspectorWizardComponentsCards
      deedNumber="123"
      draft={draft}
      editable
      locked={false}
      isLand={false}
      isShop={over.isShop ?? false}
      onPatch={onPatch}
    />,
  );
  return { onPatch };
}

/** 2026-11-04: the desktop components card renders the phone's lists and rules. */
describe("the desktop wizard's «مكونات العقار»", () => {
  it("shows every count of the shared list, the former phone-only ones included", () => {
    renderCards();
    for (const field of INSPECTOR_COMPONENT_COUNT_FIELDS) {
      expect(screen.getByText(field.label)).toBeTruthy();
    }
  });

  it("stores the annex counts as numbers and clears them on «لا»", () => {
    const { onPatch } = renderCards({ hasAnnex: "نعم" });
    const upper = screen.getByDisplayValue("2");
    fireEvent.change(upper, { target: { value: "3" } });
    expect(onPatch).toHaveBeenCalledWith({ annexUpperCount: "3" });
    fireEvent.click(screen.getByRole("button", { name: "يوجد ملحق" }));
    expect(onPatch).toHaveBeenCalledWith({
      hasAnnex: "لا",
      annexUpperCount: "",
      annexGroundCount: "",
    });
  });

  it("hides «يوجد ملحق» and the shop-hidden counts for a commercial shop", () => {
    renderCards({ isShop: true, hasAnnex: "نعم" });
    expect(screen.queryByRole("button", { name: "يوجد ملحق" })).toBeNull();
    expect(screen.queryByText("ملحق علوي (عدد)")).toBeNull();
    expect(screen.queryByText("جاكوزي")).toBeNull();
    expect(screen.getByText("عدد دورات المياه")).toBeTruthy();
  });
});
