import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CreateTaskLinkScopeFields } from "../CreateOperationsTaskLinkFields";

const form = { scope: "transaction", poNumber: "PO-7", deed: "3100 / الرياض", selectedDeeds: ["3100 / الرياض"] };

// Omar 2026-11-12: a task opened from a deed's page shows its link and offers no other.
describe("CreateTaskLinkScopeFields — a fixed link", () => {
  it("reads as one line, with no scope, work-order or deed choice", () => {
    render(
      <CreateTaskLinkScopeFields
        form={form}
        dispatch={vi.fn()}
        poOptions={[]}
        selectedPo={undefined}
        deeds={[]}
        multiDeedOptions={[]}
        linkLocked
      />,
    );
    const line = screen.getByTestId("create-task-locked-link");
    expect(line.textContent).toContain("PO-7");
    expect(line.textContent).toContain("3100 / الرياض");
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText("نطاق الربط *")).toBeNull();
  });

  it("offers the usual choices when the link is not fixed", () => {
    render(
      <CreateTaskLinkScopeFields
        form={form}
        dispatch={vi.fn()}
        poOptions={[]}
        selectedPo={undefined}
        deeds={[]}
        multiDeedOptions={[]}
      />,
    );
    expect(screen.queryByTestId("create-task-locked-link")).toBeNull();
    expect(screen.getByText("نطاق الربط *")).toBeTruthy();
    expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0);
  });
});
