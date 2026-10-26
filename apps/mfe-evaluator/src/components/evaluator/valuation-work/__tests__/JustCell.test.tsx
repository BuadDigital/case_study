import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { JustCell } from "../AdjustmentsMatrixCells";

/**
 * Round 2 — the factor / manual-weight rationale box: checked on blur (not per keystroke), a
 * short rationale named under the box (not only a toast), and the weight row says «مبرر الوزن اليدوي».
 */
describe("JustCell — rationale minimum on blur", () => {
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

  it("names a short factor rationale under the box on blur and keeps the draft", () => {
    const onCommit = renderCell("location");
    const box = screen.getByRole("textbox", { name: "مبرر عامل التسوية" });

    fireEvent.change(box, { target: { value: "قصير" } });
    fireEvent.blur(box);

    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("مبرر عامل التسوية يجب ألا يقل عن 10 أحرف");
    expect(box.getAttribute("aria-invalid")).toBe("true");
    expect((box as HTMLInputElement).value).toBe("قصير");

    fireEvent.change(box, { target: { value: "قصير جداً لكن الآن أطول" } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.blur(box);
    expect(onCommit).toHaveBeenCalledWith("location", "قصير جداً لكن الآن أطول");
  });

  it("the weight row's message is the manual-weight rationale", () => {
    renderCell("weight");
    const box = screen.getByRole("textbox", { name: "مبرر الوزن اليدوي" });

    fireEvent.change(box, { target: { value: "أحدث" } });
    fireEvent.blur(box);

    expect(screen.getByRole("alert").textContent).toBe("مبرر الوزن اليدوي يجب ألا يقل عن 10 أحرف");
  });
});
