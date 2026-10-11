import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QueryErrorState, queryErrorText } from "../QueryErrorState";

describe("QueryErrorState", () => {
  it("announces the default Arabic message as an alert", () => {
    render(<QueryErrorState />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("تعذّر تحميل البيانات");
    expect(alert.textContent).toContain("تحقّق من الاتصال ثم أعد المحاولة.");
  });

  it("calls onRetry from «إعادة المحاولة»", () => {
    const onRetry = vi.fn();
    render(<QueryErrorState line="تعذّر تحميل المهام" onRetry={onRetry} />);
    expect(screen.getByRole("alert").textContent).toContain("تعذّر تحميل المهام");
    fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows no retry button without onRetry", () => {
    render(<QueryErrorState />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("disables the retry button while retrying", () => {
    render(<QueryErrorState onRetry={() => {}} retrying />);
    const button = screen.getByRole("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("shows an Arabic error message as the hint, but never a raw browser error", () => {
    const { unmount } = render(
      <QueryErrorState error={new Error("ليس لديك صلاحية لهذا الإجراء")} />,
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "ليس لديك صلاحية لهذا الإجراء",
    );
    unmount();

    render(<QueryErrorState error={new TypeError("Failed to fetch")} />);
    const text = screen.getByRole("alert").textContent ?? "";
    expect(text).not.toContain("Failed to fetch");
    expect(text).toContain("تحقّق من الاتصال ثم أعد المحاولة.");
  });
});

describe("queryErrorText", () => {
  it("keeps Arabic messages only", () => {
    expect(queryErrorText(new Error("تعذّر تحميل المهام"))).toBe("تعذّر تحميل المهام");
    expect(queryErrorText(new Error("NetworkError when attempting to fetch"))).toBeNull();
    expect(queryErrorText("تعذّر")).toBeNull();
    expect(queryErrorText(undefined)).toBeNull();
  });
});
