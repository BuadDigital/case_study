import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@platform/ui-kit";
import { createInspectorWorkspaceDraft } from "@platform/app-shared/app-data/inspector-workspace-data";
import { InspectorPropertyPhotosSection } from "../InspectorPropertyPhotosSection";

const draft = createInspectorWorkspaceDraft({ taskId: "t1", propertyId: "p1", poNumber: "PO-1" });

// The file picker asks whether the device has a fine pointer; jsdom has no matchMedia.
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})) as typeof window.matchMedia;

function show() {
  render(
    <ToastProvider>
      <InspectorPropertyPhotosSection draft={draft} onPatch={vi.fn()} />
    </ToastProvider>,
  );
}

// Omar 2026-11-19: «تصوير العقار» starts closed, each group behind an arrow.
describe("InspectorPropertyPhotosSection", () => {
  it("starts with each group closed, its count still in the header", () => {
    show();
    const exterior = screen.getByRole("button", { name: /صور خارجية/ });
    expect(exterior.getAttribute("aria-expanded")).toBe("false");
    expect(exterior.textContent).toContain("الحد الأدنى");
    expect(screen.queryByText(/صورة خارجية/)).toBeNull();
  });

  it("opens and closes a group with its arrow", () => {
    show();
    const exterior = screen.getByRole("button", { name: /صور خارجية/ });
    fireEvent.click(exterior);
    expect(exterior.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(/التقاط صورة خارجية/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /صور داخلية/ }).getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(exterior);
    expect(screen.queryByText(/التقاط صورة خارجية/)).toBeNull();
  });
});
