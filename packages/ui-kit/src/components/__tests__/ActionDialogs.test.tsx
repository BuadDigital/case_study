import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ActionDialogHost,
  alertAction,
  confirmAction,
  promptAction,
  promptValidationMessage,
  resetActionDialogsForTests,
} from "../ActionDialogs";

beforeEach(() => resetActionDialogsForTests());
afterEach(() => {
  resetActionDialogsForTests();
  vi.restoreAllMocks();
});

describe("promptValidationMessage", () => {
  it("accepts anything when nothing is required", () => {
    expect(promptValidationMessage({ title: "t" }, "")).toBeNull();
  });

  it("refuses an empty answer when required, counting trimmed text", () => {
    expect(promptValidationMessage({ title: "t", required: true }, "   ")).toBe("هذا الحقل مطلوب");
    expect(promptValidationMessage({ title: "t", required: true }, " x ")).toBeNull();
  });

  it("refuses a short answer when a minimum length is set", () => {
    const request = { title: "t", minLength: 10 };
    expect(promptValidationMessage(request, "قصير")).toBe("اكتب 10 أحرف على الأقل");
    expect(promptValidationMessage(request, "a".repeat(10))).toBeNull();
  });
});

describe("the in-app dialogs (host mounted)", () => {
  it("confirm resolves true on the confirm button and false on cancel", async () => {
    render(<ActionDialogHost />);

    let answer: Promise<boolean>;
    act(() => {
      answer = confirmAction({ title: "حذف", message: "حذف هذا؟", confirmLabel: "حذف" });
    });
    expect(await screen.findByText("حذف هذا؟")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "حذف" }));
    await expect(answer!).resolves.toBe(true);
    await waitFor(() => expect(screen.queryByText("حذف هذا؟")).toBeNull());

    act(() => {
      answer = confirmAction({ title: "حذف", message: "مرة ثانية؟" });
    });
    await screen.findByText("مرة ثانية؟");
    fireEvent.click(screen.getByRole("button", { name: "إلغاء" }));
    await expect(answer!).resolves.toBe(false);
  });

  it("prompt returns the trimmed text, and null when cancelled", async () => {
    render(<ActionDialogHost />);

    let answer: Promise<string | null>;
    act(() => {
      answer = promptAction({ title: "سبب", label: "السبب", confirmLabel: "متابعة" });
    });
    const field = await screen.findByLabelText(/السبب/);
    fireEvent.change(field, { target: { value: "  بسبب خطأ في الإدخال  " } });
    fireEvent.click(screen.getByRole("button", { name: "متابعة" }));
    await expect(answer!).resolves.toBe("بسبب خطأ في الإدخال");

    act(() => {
      answer = promptAction({ title: "سبب", label: "السبب" });
    });
    await screen.findByLabelText(/السبب/);
    fireEvent.click(screen.getByRole("button", { name: "إلغاء" }));
    await expect(answer!).resolves.toBeNull();
  });

  it("a required prompt stays open with a message until the answer is acceptable", async () => {
    render(<ActionDialogHost />);

    let answer: Promise<string | null>;
    let settled = false;
    act(() => {
      answer = promptAction({ title: "حذف", label: "سبب الحذف", required: true, confirmLabel: "متابعة" });
      void answer.then(() => (settled = true));
    });
    const field = await screen.findByLabelText(/سبب الحذف/);
    fireEvent.click(screen.getByRole("button", { name: "متابعة" }));
    expect((await screen.findByRole("alert")).textContent).toBe("هذا الحقل مطلوب");
    expect(settled).toBe(false);

    fireEvent.change(field, { target: { value: "تكرار" } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "متابعة" }));
    await expect(answer!).resolves.toBe("تكرار");
  });

  it("a prompt with a minimum length refuses a short reason", async () => {
    render(<ActionDialogHost />);

    let answer: Promise<string | null>;
    act(() => {
      answer = promptAction({ title: "نسخة جديدة", label: "السبب", minLength: 10, confirmLabel: "فتح" });
    });
    const field = await screen.findByLabelText(/السبب/);
    fireEvent.change(field, { target: { value: "قصير" } });
    fireEvent.click(screen.getByRole("button", { name: "فتح" }));
    expect((await screen.findByRole("alert")).textContent).toBe("اكتب 10 أحرف على الأقل");

    fireEvent.change(field, { target: { value: "تغيّر الرأي بعد ملاحظة الهيئة" } });
    fireEvent.click(screen.getByRole("button", { name: "فتح" }));
    await expect(answer!).resolves.toBe("تغيّر الرأي بعد ملاحظة الهيئة");
  });

  it("shows dialogs one at a time, in the order they were asked", async () => {
    render(<ActionDialogHost />);

    let first: Promise<boolean>;
    let second: Promise<boolean>;
    act(() => {
      first = confirmAction({ title: "أولاً", message: "السؤال الأول" });
      second = confirmAction({ title: "ثانياً", message: "السؤال الثاني" });
    });
    await screen.findByText("السؤال الأول");
    expect(screen.queryByText("السؤال الثاني")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "تأكيد" }));
    await expect(first!).resolves.toBe(true);
    await screen.findByText("السؤال الثاني");
    fireEvent.click(screen.getByRole("button", { name: "إلغاء" }));
    await expect(second!).resolves.toBe(false);
  });

  it("alert waits for the user to dismiss it", async () => {
    render(<ActionDialogHost />);

    let done = false;
    let pending: Promise<void>;
    act(() => {
      pending = alertAction({ title: "تنبيه", message: "هناك عناصر لم تُرفع" });
      void pending.then(() => (done = true));
    });
    await screen.findByText("هناك عناصر لم تُرفع");
    expect(done).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "حسناً" }));
    await pending!;
    expect(done).toBe(true);
  });
});

describe("without a host (tests, server)", () => {
  it("falls back to the browser's own dialogs so nothing is skipped", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "prompt").mockReturnValue("  سبب  ");
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});

    await expect(confirmAction({ title: "t", message: "m" })).resolves.toBe(true);
    await expect(promptAction({ title: "t" })).resolves.toBe("سبب");
    await alertAction({ title: "t", message: "m" });
    expect(alert).toHaveBeenCalledWith("m");
  });

  it("a cancelled native prompt is null", async () => {
    vi.spyOn(window, "prompt").mockReturnValue(null);
    await expect(promptAction({ title: "t" })).resolves.toBeNull();
  });
});

describe("without a host — a native answer that breaks the rule is refused", () => {
  it("a too-short reason is alerted and resolves null", async () => {
    vi.spyOn(window, "prompt").mockReturnValue("قصير");
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});

    await expect(promptAction({ title: "t", minLength: 10 })).resolves.toBeNull();
    expect(alert).toHaveBeenCalledWith("اكتب 10 أحرف على الأقل");
  });
});
