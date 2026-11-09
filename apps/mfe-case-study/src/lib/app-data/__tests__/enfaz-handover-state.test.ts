import { describe, expect, it } from "vitest";
import type { TransactionStateDto } from "@platform/api-client";
import {
  ENFAZ_RETURN_REASON_MIN_LENGTH,
  enfazCardState,
  enfazStageTone,
  planTransactionReopen,
  uploadPackageGaps,
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
    billingReadyAtUtc: null,
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

  // Omar 2026-11-08: «تجهيز المعاملة للرفع» first, then the upload.
  it("asks for the preparation before the upload", () => {
    const allowed = enfazCardState(state({ allowsEnfazHandover: true }));
    expect([allowed.canPrepareUpload, allowed.canConfirmHandover]).toEqual([true, false]);
    const ready = enfazCardState(state({ allowsEnfazHandover: true, readyForUploadAtUtc: "2026-11-08T10:00:00Z" }));
    expect([ready.readyForUpload, ready.canPrepareUpload, ready.canConfirmHandover]).toEqual([true, false, true]);
    expect(enfazCardState(state({ enfazBlockReasonsAr: ["x"], allowsEnfazHandover: true })).canPrepareUpload).toBe(false);
  });

  it("lists the package rows still missing, the keys proof included", () => {
    const row = (name: string, status: "ready" | "missing" | "conditional" | "not-needed") =>
      ({ id: name, name, infathTarget: name, status, document: null });
    expect(
      uploadPackageGaps([
        row("تقرير التقييم المعتمد", "ready"),
        row("تقرير الرفع المساحي", "not-needed"),
        row("شهادة إيداع التقرير", "missing"),
        row("إثبات استلام المفتاح", "conditional"),
      ]),
    ).toEqual(["شهادة إيداع التقرير", "إثبات استلام المفتاح"]);
  });

  it("enables the confirm button only when nothing blocks, the server allows it and it was prepared", () => {
    expect(
      enfazCardState(state({ allowsEnfazHandover: true, readyForUploadAtUtc: "2026-11-08T10:00:00Z" })).canConfirmHandover,
    ).toBe(true);
    // No reasons but the server does not allow it yet (an older server): stay disabled.
    expect(enfazCardState(state({ allowsEnfazHandover: false })).canConfirmHandover).toBe(false);
    expect(enfazCardState(undefined).canConfirmHandover).toBe(false);
  });

  it("reads the accountant's «جاهز للفوترة» mark only on a handed-over deed", () => {
    const handedOver = "2026-10-01T09:00:00Z";
    expect(
      enfazCardState(
        state({ enfazHandoverAtUtc: handedOver, billingReadyAtUtc: "2026-10-05T09:00:00Z" }),
      ).billingReady,
    ).toBe(true);
    expect(enfazCardState(state({ enfazHandoverAtUtc: handedOver })).billingReady).toBe(false);
    expect(enfazCardState(state({ billingReadyAtUtc: "2026-10-05T09:00:00Z" })).billingReady).toBe(false);
    expect(enfazCardState(undefined).billingReady).toBe(false);
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

describe("planTransactionReopen (Omar 2026-11-05)", () => {
  const base = {
    source: "internal" as const,
    enfazReference: "",
    reason: "ملاحظة على المعاملة بعد الاعتماد",
    reopenStudy: true,
    reopenValuation: false,
    needsFieldWork: false,
  };

  it("needs a reason of at least 10 characters", () => {
    expect(planTransactionReopen({ ...base, reason: " " })).toMatchObject({ ok: false, field: "reason" });
    const short = "x".repeat(ENFAZ_RETURN_REASON_MIN_LENGTH - 1);
    expect(planTransactionReopen({ ...base, reason: short })).toMatchObject({ ok: false, field: "reason" });
  });

  it("needs Enfaz's reference when the note came from Enfaz", () => {
    expect(planTransactionReopen({ ...base, source: "enfaz" })).toMatchObject({ ok: false, field: "reference" });
  });

  it("needs at least one affected part", () => {
    expect(planTransactionReopen({ ...base, reopenStudy: false })).toMatchObject({ ok: false, field: "choice" });
  });

  it("builds the request; field work reopens the study", () => {
    expect(
      planTransactionReopen({
        ...base,
        source: "enfaz",
        enfazReference: " ENF-9 ",
        reason: "  ملاحظة من إنفاذ على المعاملة  ",
        reopenStudy: false,
        needsFieldWork: true,
      }),
    ).toEqual({
      ok: true,
      request: {
        reason: "ملاحظة من إنفاذ على المعاملة",
        source: "enfaz",
        enfazReference: "ENF-9",
        reopenStudy: true,
        reopenValuation: false,
        needsFieldWork: true,
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
