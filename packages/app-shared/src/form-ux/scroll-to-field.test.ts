import { afterEach, describe, expect, it, vi } from "vitest";
import { scheduleScrollToFormField, scrollToFormField } from "./scroll-to-field";

describe("scrollToFormField", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("returns false when the target is not in the document", () => {
    expect(scrollToFormField("missing")).toBe(false);
  });

  it("scrolls, pulses, and returns true when the target exists", () => {
    const el = document.createElement("input");
    el.id = "ready";
    el.scrollIntoView = vi.fn();
    document.body.appendChild(el);

    expect(scrollToFormField("ready")).toBe(true);
    expect(el.scrollIntoView).toHaveBeenCalled();
  });

  it("retries until the node appears after a step/tab paint", () => {
    vi.useFakeTimers();
    const el = document.createElement("input");
    el.id = "late";
    el.scrollIntoView = vi.fn();

    scheduleScrollToFormField("late", 60, { retries: 4, retryMs: 50 });
    vi.advanceTimersByTime(60);
    expect(el.scrollIntoView).not.toHaveBeenCalled();

    document.body.appendChild(el);
    vi.advanceTimersByTime(50);
    expect(el.scrollIntoView).toHaveBeenCalled();
  });
});
