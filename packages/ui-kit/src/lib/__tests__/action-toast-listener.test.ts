import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bindGlobalActionToast } from "../action-toast-listener";

/**
 * Round 2: a refused action (the deposit answered 400 and raised an error toast) must not also get
 * the automatic «تم التسجيل !» success toast beside the refusal.
 */
describe("global action toast — no success after a refusal", () => {
  let button: HTMLButtonElement;
  let unbind: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    button = document.createElement("button");
    button.textContent = "تسجيل رمز الإيداع";
    button.setAttribute("data-action-toast", "");
    document.body.appendChild(button);
  });

  afterEach(() => {
    unbind?.();
    button.remove();
    vi.useRealTimers();
  });

  function runAction(failed: boolean) {
    let lastErrorAt = Number.NEGATIVE_INFINITY;
    const success = vi.fn();
    unbind = bindGlobalActionToast(
      () => "progress-1",
      () => {},
      success,
      (startedAt) => lastErrorAt >= startedAt,
    );
    // The click handler marks the button busy within the same press.
    button.setAttribute("aria-busy", "true");
    button.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    vi.advanceTimersByTime(250);
    if (failed) lastErrorAt = Date.now();
    button.removeAttribute("aria-busy");
    vi.advanceTimersByTime(250);
    return success;
  }

  it("shows the success toast when the action went through", () => {
    const success = runAction(false);
    expect(success).toHaveBeenCalledWith("تم التسجيل !");
  });

  it("stays silent when an error toast was raised during the action", () => {
    const success = runAction(true);
    expect(success).not.toHaveBeenCalled();
  });
});
