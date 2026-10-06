import { describe, expect, it } from "vitest";
import type { TransactionStateDto } from "@platform/api-client";
import {
  ENFAZ_RETURN_REASON_MIN_LENGTH,
  enfazCardState,
  enfazStageTone,
  planEnfazReturn,
} from "../enfaz-handover-state";

function state(over: Partial<TransactionStateDto>): TransactionStateDto {
  return {
    workOrderId: "w",
    propertyId: "p",
    stages: [],
    parties: [],
    overallStatus: "in_progress",
    overallStatusLabelAr: "قيد العمل",
    waitingSummaryAr: "",
    allowsEnfazHandover: false,
    enfazHandoverAtUtc: null,
    handoverPackageAr: [],
    studyReportIssued: false,
    enfazBlockReasonsAr: [],
    enfazReturnNoticesAr: [],
    ...over,
  };
}

describe("enfazCardState", () => {
  it("blocks the handover while reasons exist and lists them", () => {
    const card = enfazCardState(
      state({ enfazBlockReasonsAr: ["تقرير دراسة الحالة لم يُصدر", "  "] }),
    );
    expect(card.blockReasons).toEqual(["تقرير دراسة الحالة لم يُصدر"]);
    expect(card.canConfirmHandover).toBe(false);
  });

  it("enables the confirm button only when nothing blocks and the server allows it", () => {
    expect(enfazCardState(state({ allowsEnfazHandover: true })).canConfirmHandover).toBe(true);
    // No reasons but the server does not allow it yet (an older server): stay disabled.
    expect(enfazCardState(state({ allowsEnfazHandover: false })).canConfirmHandover).toBe(false);
    expect(enfazCardState(undefined).canConfirmHandover).toBe(false);
  });

  it("reads a stamped handover as handed over, with no blockers and no confirm", () => {
    const card = enfazCardState(
      state({
        allowsEnfazHandover: true,
        enfazHandoverAtUtc: "2026-10-01T09:00:00Z",
        enfazBlockReasonsAr: ["x"],
      }),
    );
    expect(card.handedOver).toBe(true);
    expect(card.handedOverAtUtc).toBe("2026-10-01T09:00:00Z");
    expect(card.blockReasons).toEqual([]);
    expect(card.canConfirmHandover).toBe(false);
  });
});

describe("planEnfazReturn", () => {
  it("needs a reason of at least 10 characters", () => {
    expect(planEnfazReturn({ reason: " ", reopenStudy: true, reopenValuation: false })).toMatchObject({
      ok: false,
      field: "reason",
    });
    const short = "x".repeat(ENFAZ_RETURN_REASON_MIN_LENGTH - 1);
    expect(planEnfazReturn({ reason: short, reopenStudy: true, reopenValuation: false })).toMatchObject({
      ok: false,
      field: "reason",
    });
  });

  it("needs at least one reopen choice", () => {
    expect(
      planEnfazReturn({ reason: "ملاحظة من إنفاذ على المعاملة", reopenStudy: false, reopenValuation: false }),
    ).toMatchObject({ ok: false, field: "choice" });
  });

  it("builds the request with the trimmed reason", () => {
    expect(
      planEnfazReturn({
        reason: "  ملاحظة من إنفاذ على المعاملة  ",
        reopenStudy: true,
        reopenValuation: true,
      }),
    ).toEqual({
      ok: true,
      request: {
        reason: "ملاحظة من إنفاذ على المعاملة",
        reopenStudy: true,
        reopenValuation: true,
      },
    });
  });
});

describe("enfazStageTone", () => {
  it("colours the stage badge by status", () => {
    expect(enfazStageTone("completed")).toBe("teal");
    expect(enfazStageTone("waiting_on_party")).toBe("amber");
    expect(enfazStageTone("not_started")).toBe("gray");
  });
});
