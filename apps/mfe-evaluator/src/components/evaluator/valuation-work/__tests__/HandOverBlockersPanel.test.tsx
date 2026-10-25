import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ValuationIssuanceGatesDto } from "@platform/api-client";

import { HandOverBlockersPanel } from "../HandOverBlockersPanel";
import { announceHandOverGatesRead } from "../../../../lib/evaluator/handover-blockers";

function gates(
  failing: { code: string; detailAr: string }[],
  alerts: { number: number; code: string; detailAr: string }[] = [],
): ValuationIssuanceGatesDto {
  return {
    valuationRequestId: "vr-1",
    propertyId: "p-1",
    allowsIssuance: failing.length === 0 && alerts.length === 0,
    gates: failing.map((f) => ({ ...f, labelAr: f.code, passed: false, isHard: true, isWarning: false })),
    blockingReasonsAr: [],
    methodologyAlerts: alerts.map((a) => ({
      ...a,
      labelAr: a.code,
      triggered: true,
      isHard: false,
      evaluated: true,
      blocksIssuance: true,
    })),
    methodologyAlertTriggeredCount: alerts.length,
    methodologyAlertsNoteAr: "",
  };
}

describe("HandOverBlockersPanel (D2)", () => {
  it("lists every blocker before the button is pressed, each with who fixes it", () => {
    const onGoToScreen = vi.fn();
    render(
      <HandOverBlockersPanel
        valuationRequestId="vr-1"
        onGoToScreen={onGoToScreen}
        gates={gates(
          [
            { code: "final_opinion", detailAr: "الرأي النهائي غير محسوب أو صفر" },
            { code: "credentials", detailAr: "انتهت عضوية المقيّم" },
            { code: "required_attachments", detailAr: "مرفقات إلزامية بلا رفع مصنّف للطباعة: صك الملكية" },
          ],
          [{ number: 16, code: "m16", detailAr: "تشتّت المقارنات" }],
        )}
      />,
    );

    expect(screen.getByRole("alert").textContent).toContain("(3)");
    expect(screen.getByText("1) الرأي النهائي غير محسوب أو صفر")).toBeTruthy();
    expect(screen.getByText("2) انتهت عضوية المقيّم")).toBeTruthy();
    expect(screen.getByText("3) تشتّت المقارنات")).toBeTruthy();
    expect(screen.getAllByText(/يعالجها: المقيّم/)).toHaveLength(2);
    expect(screen.getByText(/يعالجها: إدارة المنشأة/)).toBeTruthy();
    // The specialist's later work is shown apart and does not count as a blocker.
    expect(screen.getByText(/سيكملها الأخصائي/)).toBeTruthy();
    expect(screen.getByText("مرفقات إلزامية بلا رفع مصنّف للطباعة: صك الملكية")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "انتقل إلى «رأي القيمة النهائي»" }));
    fireEvent.click(screen.getByRole("button", { name: "انتقل إلى «طريقة المقارنة»" }));
    expect(onGoToScreen.mock.calls).toEqual([["final"], ["market"]]);
  });

  it("keeps the refusal's fresh read on screen instead of the gates loaded earlier", () => {
    render(<HandOverBlockersPanel valuationRequestId="vr-1" gates={gates([])} />);
    expect(screen.getByRole("status").textContent).toContain("لا شيء يمنع التسليم");

    act(() =>
      announceHandOverGatesRead({
        valuationRequestId: "vr-1",
        gates: gates([{ code: "reconciliation_weights", detailAr: "مجموع نسب المشاركة ≠ 100٪" }]),
      }),
    );

    expect(screen.getByText("1) مجموع نسب المشاركة ≠ 100٪")).toBeTruthy();
  });

  it("ignores a read for another valuation request", () => {
    render(<HandOverBlockersPanel valuationRequestId="vr-1" gates={gates([])} />);
    act(() =>
      announceHandOverGatesRead({
        valuationRequestId: "vr-2",
        gates: gates([{ code: "final_opinion", detailAr: "صفر" }]),
      }),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
