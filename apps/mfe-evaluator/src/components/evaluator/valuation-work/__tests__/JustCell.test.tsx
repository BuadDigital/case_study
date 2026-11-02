import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { JustCell } from "../AdjustmentsMatrixCells";

/**
 * The factor / manual-weight rationale box: saved on blur (not per keystroke), any length —
 * 2026-11-02 the rationale became an optional note.
 */
describe("JustCell — optional rationale saved on blur", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function renderCell(factorKey: string, onCommit = vi.fn()) {
    render(
      <table>
        <tbody>
          <tr>
            <JustCell factorKey={factorKey} value="" onCommit={onCommit} />
          </tr>
        </tbody>
      </table>,
    );
    return onCommit;
  }

  it("does not validate or save while typing", () => {
    const onCommit = renderCell("location");
    const box = screen.getByRole("textbox", { name: "مبرر عامل التسوية" });

    fireEvent.change(box, { target: { value: "قصير" } });
    act(() => vi.advanceTimersByTime(2000));

    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("saves a short factor rationale on blur — no minimum", () => {
    const onCommit = renderCell("location");
    const box = screen.getByRole("textbox", { name: "مبرر عامل التسوية" });

    fireEvent.change(box, { target: { value: "قصير" } });
    fireEvent.blur(box);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(onCommit).toHaveBeenCalledWith("location", "قصير");
  });

  it("the weight row is named as the manual-weight rationale and saves any length", () => {
    const onCommit = renderCell("weight");
    const box = screen.getByRole("textbox", { name: "مبرر الوزن اليدوي" });

    fireEvent.change(box, { target: { value: "أحدث" } });
    fireEvent.blur(box);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(onCommit).toHaveBeenCalledWith("weight", "أحدث");
  });
});
