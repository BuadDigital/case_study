import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@platform/ui-kit";
import { reviewCorrectionOptions } from "../../../lib/app-data/review-correction-model";
import { ReviewCorrectionDialog } from "../ReviewCorrectionDialog";

const OPTIONS = reviewCorrectionOptions({
  studyIssued: true,
  hasAppraisal: true,
  valuationHandedOver: true,
  reviewLock: null,
});
const REASON = "مساحة البناء لا تطابق الرخصة";

function open(over: Partial<Parameters<typeof ReviewCorrectionDialog>[0]> = {}) {
  const props = {
    options: OPTIONS,
    onClose: vi.fn(),
    onReturnStudy: vi.fn(async () => ({ ok: true as const })),
    onReturnValuation: vi.fn(async () => ({ ok: true as const })),
    ...over,
  };
  render(
    <ToastProvider>
      <ReviewCorrectionDialog {...props} />
    </ToastProvider>,
  );
  return props;
}
const tick = (source: "study" | "valuation") =>
  fireEvent.click(screen.getByTestId(`review-correction-${source}`).querySelector("input")!);
const typeReason = (text: string) =>
  fireEvent.change(screen.getByLabelText(/سبب طلب التصحيح/), { target: { value: text } });
const send = () => fireEvent.click(screen.getByRole("button", { name: "إرسال طلب التصحيح" }));

describe("ReviewCorrectionDialog — «طلب تصحيح»", () => {
  it("shows each choice's action and who it touches before anything is sent", () => {
    open();

    expect(screen.getByTestId("review-correction-study").textContent).toContain("دارس العقار — يصحّح الدراسة");
    expect(screen.getByTestId("review-correction-valuation").textContent).toContain("المقيّم — يصحّح تقييمه");
  });

  it("asks for a place and a reason, and sends nothing without them", async () => {
    const props = open();

    send();
    expect(screen.getByText("اختر أين الخطأ.")).toBeTruthy();
    tick("study");
    send();
    await waitFor(() => expect(screen.getByText(/سبب إعادة الفتح/)).toBeTruthy());
    expect(props.onReturnStudy).not.toHaveBeenCalled();
  });

  it("returns the study and the valuation with the one reason, the study first, then closes", async () => {
    const order: string[] = [];
    const props = open({
      onReturnStudy: vi.fn(async () => {
        order.push("study");
        return { ok: true as const };
      }),
      onReturnValuation: vi.fn(async () => {
        order.push("valuation");
        return { ok: true as const };
      }),
    });

    tick("valuation");
    tick("study");
    typeReason(REASON);
    send();

    await waitFor(() => expect(props.onClose).toHaveBeenCalledOnce());
    expect(order).toEqual(["study", "valuation"]);
    expect(props.onReturnStudy).toHaveBeenCalledWith(REASON, false);
    expect(props.onReturnValuation).toHaveBeenCalledWith(REASON);
  });

  it("keeps the window on a refusal and does not send the finished return again", async () => {
    const onReturnValuation = vi
      .fn<(reason: string) => Promise<{ ok: true } | { ok: false; error: string }>>()
      .mockResolvedValueOnce({ ok: false, error: "تعذّر إعادة فتح مهمة الطرف" })
      .mockResolvedValueOnce({ ok: true });
    const props = open({ onReturnValuation });

    tick("study");
    tick("valuation");
    typeReason(REASON);
    send();
    await waitFor(() => expect(screen.getByText("تعذّر إعادة فتح مهمة الطرف")).toBeTruthy());
    expect(props.onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId("review-correction-study").textContent).toContain("تم");

    send();
    await waitFor(() => expect(props.onClose).toHaveBeenCalledOnce());
    expect(props.onReturnStudy).toHaveBeenCalledOnce();
    expect(onReturnValuation).toHaveBeenCalledTimes(2);
  });

  it("a study handed over to Enfaz needs «إلغاء تسليم إنفاذ» first", async () => {
    const props = open({ enfazHandedOver: true, initial: "study" });

    typeReason(REASON);
    send();
    await waitFor(() => expect(screen.getByText(/أكّد إلغاء تسليم إنفاذ/)).toBeTruthy());
    expect(props.onReturnStudy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText("إلغاء تسليم إنفاذ"));
    send();
    await waitFor(() => expect(props.onReturnStudy).toHaveBeenCalledWith(REASON, true));
  });

  it("a choice that cannot be made now is listed with its reason and cannot be ticked", () => {
    open({
      options: reviewCorrectionOptions({
        studyIssued: true,
        hasAppraisal: true,
        valuationHandedOver: false,
        reviewLock: null,
      }),
    });

    const valuation = screen.getByTestId("review-correction-valuation");
    expect(valuation.textContent).toContain("لم يسلّم المقيّم تقييمه بعد.");
    expect(valuation.querySelector("input")!.disabled).toBe(true);
  });
});
