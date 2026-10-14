import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ showToast: vi.fn() }));
const scroll = vi.hoisted(() => ({ scheduleScrollToFirstFormField: vi.fn() }));

vi.mock("@platform/ui-kit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platform/ui-kit")>()),
  useOptionalToast: () => toast,
}));
vi.mock("@platform/app-shared/form-ux", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platform/app-shared/form-ux")>()),
  ...scroll,
}));

import {
  ValuationWorkErrorsProvider,
  useValuationWorkErrors,
} from "../ValuationWorkErrors";

function Probe() {
  const { fieldErrors, reportSaveFailure, reportFieldError, clearSaveErrors } =
    useValuationWorkErrors();
  return (
    <>
      <button
        type="button"
        onClick={() =>
          reportSaveFailure(
            {
              kind: "validation",
              errors: { MethodsRationale: ["مبرر استخدام طرق التقييم مطلوب"] },
            },
            "تعذّر حفظ الترجيح",
          )
        }
      >
        save
      </button>
      <button
        type="button"
        onClick={() => reportFieldError("retrospectiveDate", "تاريخ إلزامي")}
      >
        precheck
      </button>
      <button type="button" onClick={() => clearSaveErrors("methodsRationale")}>
        clear
      </button>
      <output>{JSON.stringify(fieldErrors)}</output>
    </>
  );
}

function renderProbe(onScreenChange = vi.fn()) {
  toast.showToast.mockClear();
  scroll.scheduleScrollToFirstFormField.mockClear();
  render(
    <ValuationWorkErrorsProvider
      fieldErrors={{ evaluator_price: "مطلوب إدخال إجمالي قيمة العقار" }}
      onScreenChange={onScreenChange}
    >
      <Probe />
    </ValuationWorkErrorsProvider>,
  );
  return onScreenChange;
}

describe("ValuationWorkErrorsProvider", () => {
  it("marks the field, moves to its screen and scrolls to it on a failed save", () => {
    const onScreenChange = renderProbe();
    fireEvent.click(screen.getByText("save"));

    expect(onScreenChange).toHaveBeenCalledWith("final");
    expect(scroll.scheduleScrollToFirstFormField).toHaveBeenCalledWith(
      ["final-methods-rationale", undefined],
      120,
      { retries: 24 },
    );
    expect(toast.showToast).toHaveBeenCalledWith(
      "مبرر استخدام طرق التقييم مطلوب",
      "error",
    );
    expect(screen.getByRole("status").textContent).toContain(
      "methodsRationale",
    );
  });

  it("keeps the send-time errors alongside the save errors", () => {
    renderProbe();
    expect(screen.getByRole("status").textContent).toContain("evaluator_price");
  });

  it("marks a local pre-check the same way", () => {
    const onScreenChange = renderProbe();
    fireEvent.click(screen.getByText("precheck"));

    expect(onScreenChange).toHaveBeenCalledWith("basic");
    expect(scroll.scheduleScrollToFirstFormField).toHaveBeenCalledWith(
      ["as-retro-date", "as-retro-date-from"],
      120,
      { retries: 24 },
    );
    expect(toast.showToast).toHaveBeenCalledWith("تاريخ إلزامي", "error");
  });

  it("clears one key when the appraiser edits that field", () => {
    renderProbe();
    fireEvent.click(screen.getByText("save"));
    expect(screen.getByRole("status").textContent).toContain("methodsRationale");

    fireEvent.click(screen.getByText("clear"));
    expect(screen.getByRole("status").textContent).not.toContain(
      "methodsRationale",
    );
    expect(screen.getByRole("status").textContent).toContain("evaluator_price");
  });

  it("outside the provider it still shows the message, with nothing to mark", () => {
    toast.showToast.mockClear();
    scroll.scheduleScrollToFirstFormField.mockClear();
    render(<Probe />);
    fireEvent.click(screen.getByText("save"));

    expect(toast.showToast).toHaveBeenCalledWith(
      "مبرر استخدام طرق التقييم مطلوب",
      "error",
    );
    expect(scroll.scheduleScrollToFirstFormField).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toBe("{}");
  });
});
