import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ValuationIssuanceGatesDto, ValuationReconciliationDto } from "@platform/api-client";

const api = vi.hoisted(() => ({
  saveValuationAlertOverrides: vi.fn(),
  saveValuationReconciliation: vi.fn(),
}));
const toast = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("@platform/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platform/api-client")>()),
  ...api,
}));
vi.mock("@platform/ui-kit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@platform/ui-kit")>()),
  useToast: () => toast,
  useOptionalToast: () => toast,
}));
vi.mock("../lib/shell-utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/shell-utils")>()),
  apiConfig: () => ({ token: "t" }),
}));

import { MethodologyAlertsPanel } from "../MethodologyAlertsPanel";

const gates = {
  valuationRequestId: "vr-1",
  propertyId: "p-1",
  allowsIssuance: false,
  gates: [],
  blockingReasonsAr: [],
  methodologyAlerts: [
    {
      number: 15,
      code: "m15",
      labelAr: "تنبيه المقارنات",
      triggered: true,
      isHard: false,
      severityKind: "require_ack",
      evaluated: true,
      blocksIssuance: true,
    },
  ],
  methodologyAlertTriggeredCount: 1,
  methodologyAlertsNoteAr: "",
} as ValuationIssuanceGatesDto;

// Never saved: no «مبرر استخدام طرق التقييم» yet.
const recon = { methodsRationale: "", methodologyAlertOverrides: [] } as unknown as ValuationReconciliationDto;

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  toast.showToast.mockReset();
});

describe("MethodologyAlertsPanel (problem 20)", () => {
  it("saves an acknowledgement on its own — without the methods rationale or the full reconciliation", async () => {
    const saved = { ...recon, methodologyAlertOverrides: [{ code: "m15", acknowledged: true }] };
    api.saveValuationAlertOverrides.mockResolvedValue({ ok: true, data: saved });
    const onReconSaved = vi.fn();
    render(
      <MethodologyAlertsPanel
        group="market"
        gates={gates}
        recon={recon}
        valuationRequestId="vr-1"
        saving={false}
        onSavingChange={() => undefined}
        onReconSaved={onReconSaved}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "حفظ معالجة التنبيهات" }));

    await waitFor(() => expect(onReconSaved).toHaveBeenCalledWith(saved));
    expect(api.saveValuationAlertOverrides).toHaveBeenCalledWith({ token: "t" }, "vr-1", [
      { code: "m15", overrideRationale: null, acknowledged: true },
    ]);
    expect(api.saveValuationReconciliation).not.toHaveBeenCalled();
    expect(toast.showToast).toHaveBeenCalledWith("تم حفظ معالجة التنبيهات المنهجية", "success");
  });
});
