import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { createInspectorWorkspaceDraft } from "../../../lib/app-data/inspector-workspace-data";
import { InspectorLocationCard } from "../InspectorLocationCard";

vi.mock("../InspectorCopyPriorButton", () => ({ InspectorCopyPriorButton: () => null }));

vi.mock("../FieldInspectionWorkParts", async (original) => ({
  ...(await original<typeof import("../FieldInspectionWorkParts")>()),
  MobileInspectMap: () => null,
}));

function renderCard(over: Partial<ComponentProps<typeof InspectorLocationCard>> = {}) {
  const persist = vi.fn();
  const draft = {
    ...createInspectorWorkspaceDraft({ taskId: "t1", propertyId: "p1", poNumber: "PO-1" }),
    mapLatitude: "21.5",
    mapLongitude: "39.1",
  };
  render(
    <InspectorLocationCard
      {...({
        activeStep: 1,
        captureDeviceGps: vi.fn(),
        draft,
        fieldErrors: {},
        layout: "mobile",
        locked: false,
        mapBackup: null,
        mapPinEpoch: 0,
        mapPinned: false,
        mobile: true,
        persist,
        requestMapMove: vi.fn(),
        saveState: {},
        setMapPinned: vi.fn(),
        showToast: vi.fn(),
        undoMapMove: vi.fn(),
        ...over,
      } as unknown as ComponentProps<typeof InspectorLocationCard>)}
    />,
  );
  return { persist };
}

/** 2026-11-01: on the phone the inspector could only place the point by GPS or the map. */
describe("the inspector's phone location card", () => {
  it("lets the inspector type the coordinates and saves them", () => {
    const { persist } = renderCard();
    const box = screen.getByLabelText("الإحداثيات");
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "24.4513, 39.6102" } });
    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({ mapLatitude: "24.4513", mapLongitude: "39.6102" }),
    );
  });

  it("holds back the pin while the typed point is outside the Kingdom", () => {
    renderCard();
    const box = screen.getByLabelText("الإحداثيات");
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "39.6102, 24.4513" } });
    expect(screen.getByRole("button", { name: "تثبيت الموقع" }).hasAttribute("disabled")).toBe(true);
  });

  it("closes the box once the point is pinned or the inspection is locked", () => {
    renderCard({ mapPinned: true });
    expect(screen.queryByLabelText("الإحداثيات")).toBeNull();
  });
});
