import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PartyTaskSubmitDialog } from "../PartyTaskSubmitDialog";

const base = { sendingText: "جاري الإرسال…", sentText: "تم الإرسال بنجاح." };

describe("PartyTaskSubmitDialog", () => {
  it("shows nothing before a send starts", () => {
    const { container } = render(<PartyTaskSubmitDialog state="idle" {...base} onBack={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("while sending shows the loading text, no way back, and ignores Escape", () => {
    const onBack = vi.fn();
    render(<PartyTaskSubmitDialog state="sending" {...base} onBack={onBack} />);
    expect(screen.getAllByText("جاري الإرسال…").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "العودة للقائمة" })).toBeNull();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onBack).not.toHaveBeenCalled();
  });

  it("when sent shows the result and one button back to the queue", () => {
    const onBack = vi.fn();
    render(<PartyTaskSubmitDialog state="sent" {...base} onBack={onBack} />);
    expect(screen.getByText("تم الإرسال بنجاح.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "العودة للقائمة" }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("when saved offline says it will be sent when the connection is back", () => {
    render(<PartyTaskSubmitDialog state="queued" {...base} onBack={vi.fn()} />);
    expect(screen.getByText(/ستُرسل تلقائياً عند عودته/)).toBeTruthy();
  });
});
