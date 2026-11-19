import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  activeMapDiffersFromInspectorOriginal,
  createInspectorWorkspaceDraft,
} from "@platform/app-shared/app-data/inspector-workspace-data";
import { InspectorLocationSources } from "../InspectorLocationSources";

const approved = { lat: 21.481, lng: 39.1865 };
// About 120 m north of the approved pin.
const north = { lat: 21.48208, lng: 39.1865 };

// Omar 2026-11-19: the staff could not tell «اعتماد موقع المعاين» from «اعتماد موقع المكتب الهندسي».
describe("InspectorLocationSources", () => {
  it("names each place, says how far it is, and moves the approved pin there", () => {
    const toInspector = vi.fn();
    render(
      <InspectorLocationSources
        approved={approved}
        inspector={north}
        office={approved}
        editable
        onMoveToInspector={toInspector}
      />,
    );
    expect(screen.getByText("مصادر الموقع")).toBeTruthy();
    expect(screen.getByText(/يبعد 120 م عن الموقع المعتمد/)).toBeTruthy();
    expect(screen.getByText("✓ مطابق للموقع المعتمد")).toBeTruthy();
    const move = screen.getAllByRole("button", { name: "نقل الموقع المعتمد إلى هنا" });
    expect(move).toHaveLength(1);
    fireEvent.click(move[0]!);
    expect(toInspector).toHaveBeenCalledTimes(1);
  });

  it("says in one line that the sources match, with nothing to choose", () => {
    render(
      <InspectorLocationSources
        approved={approved}
        inspector={{ lat: 21.48101, lng: 39.1865 }}
        office={approved}
        editable
        onMoveToInspector={vi.fn()}
        onMoveToOffice={vi.fn()}
      />,
    );
    expect(screen.getByText("موقع المعاين وموقع المكتب الهندسي مطابقان للموقع المعتمد.")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("offers no move to a reader", () => {
    render(<InspectorLocationSources approved={approved} inspector={north} office={null} editable={false} onMoveToInspector={vi.fn()} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows nothing without an inspector's or an office's location", () => {
    const { container } = render(<InspectorLocationSources approved={approved} inspector={null} office={null} editable />);
    expect(container.textContent).toBe("");
  });
});

describe("activeMapDiffersFromInspectorOriginal", () => {
  const draft = (map: [string, string], original: [string, string]) => ({
    ...createInspectorWorkspaceDraft({ taskId: "t", propertyId: "p", poNumber: "PO" }),
    mapLatitude: map[0],
    mapLongitude: map[1],
    inspectorMapLatitude: original[0],
    inspectorMapLongitude: original[1],
  });

  it("is the same place when only the written digits differ", () => {
    expect(activeMapDiffersFromInspectorOriginal(draft(["21.48100", "39.18650"], ["21.481", "39.1865"]))).toBe(false);
  });

  it("is another place a few dozen metres away", () => {
    expect(activeMapDiffersFromInspectorOriginal(draft(["21.48208", "39.1865"], ["21.481", "39.1865"]))).toBe(true);
  });
});
