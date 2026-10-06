import { describe, expect, it } from "vitest";
import type { ReturnImpactParty } from "@platform/api-client";
import {
  RETURN_INSPECTION_NOTE_REQUIRED,
  RETURN_INSPECTION_SECTIONS,
  RETURN_INSPECTION_STUDY_REPORT_REQUIRED,
  mapReturnInspectionFieldErrors,
  planReturnInspectionSubmit,
  reconcileAffectedTaskIds,
  returnImpactActionLabel,
  returnInspectionSuccessMessage,
  returnPackageStatusBadge,
  returnPartyOutcomeIsWarning,
  returnPartyOutcomeLabel,
  suggestedAffectedTaskIds,
  toggleKey,
} from "../return-inspection-state";

function party(over: Partial<ReturnImpactParty>): ReturnImpactParty {
  return {
    taskId: "t",
    kind: "property-appraisal",
    assigneeName: "مقيّم",
    packageStatus: "submitted",
    suggested: false,
    suggestedBecause: [],
    willBe: "reopen",
    ...over,
  };
}

const base = {
  note: "صحّح المساحة",
  sections: ["area"],
  affectedTaskIds: ["a1"],
  studyReportIssued: false,
  studyReport: null,
  studyReportReopenReason: "",
} as const;

describe("return inspection — sections", () => {
  it("lists the nine inspector-data groups the server knows", () => {
    expect(RETURN_INSPECTION_SECTIONS.map((s) => s.key)).toEqual([
      "assetType",
      "components",
      "area",
      "age",
      "boundaries",
      "location",
      "photos",
      "narrative",
      "services",
    ]);
  });

  it("toggles a key in and out without mutating", () => {
    const first = ["area"];
    expect(toggleKey(first, "age")).toEqual(["area", "age"]);
    expect(toggleKey(["area", "age"], "area")).toEqual(["age"]);
    expect(first).toEqual(["area"]);
  });
});

describe("return inspection — affected parties", () => {
  const parties = [
    party({ taskId: "a1", suggested: true }),
    party({ taskId: "s1", kind: "engineering-survey", suggested: false }),
  ];

  it("pre-ticks the parties the server suggests", () => {
    expect(suggestedAffectedTaskIds(parties)).toEqual(["a1"]);
  });

  it("follows the suggestion while the specialist has not touched a party", () => {
    expect(
      reconcileAffectedTaskIds({ parties, current: ["s1"], touched: false }),
    ).toEqual(["a1"]);
  });

  it("keeps the specialist's picks once he touched a party, minus vanished parties", () => {
    expect(
      reconcileAffectedTaskIds({
        parties: [party({ taskId: "s1" })],
        current: ["a1", "s1"],
        touched: true,
      }),
    ).toEqual(["s1"]);
  });
});

describe("return inspection — submit plan", () => {
  it("requires the note", () => {
    expect(planReturnInspectionSubmit({ ...base, note: "   " })).toEqual({
      ok: false,
      field: "note",
      error: RETURN_INSPECTION_NOTE_REQUIRED,
    });
  });

  it("sends a plain request when the study report is not issued", () => {
    expect(planReturnInspectionSubmit(base)).toEqual({
      ok: true,
      request: {
        returnNote: "صحّح المساحة",
        sections: ["area"],
        affectedTaskIds: ["a1"],
        studyReport: null,
      },
    });
  });

  it("requires keep / reopen once the study report is issued", () => {
    expect(
      planReturnInspectionSubmit({ ...base, studyReportIssued: true }),
    ).toEqual({
      ok: false,
      field: "studyReport",
      error: RETURN_INSPECTION_STUDY_REPORT_REQUIRED,
    });
  });

  it("keeps the issued report without a reason", () => {
    const plan = planReturnInspectionSubmit({
      ...base,
      studyReportIssued: true,
      studyReport: "keep",
    });
    expect(plan).toMatchObject({ ok: true, request: { studyReport: "keep" } });
    expect(plan.ok && "studyReportReopenReason" in plan.request).toBe(false);
  });

  it("reopening the issued report needs its own reason of at least 10 characters", () => {
    const short = planReturnInspectionSubmit({
      ...base,
      studyReportIssued: true,
      studyReport: "reopen",
      studyReportReopenReason: "قصير",
    });
    expect(short).toMatchObject({ ok: false, field: "studyReportReason" });

    const ok = planReturnInspectionSubmit({
      ...base,
      studyReportIssued: true,
      studyReport: "reopen",
      studyReportReopenReason: "  ظهرت مساحة جديدة تستدعي التعديل  ",
    });
    expect(ok).toMatchObject({
      ok: true,
      request: {
        studyReport: "reopen",
        studyReportReopenReason: "ظهرت مساحة جديدة تستدعي التعديل",
      },
    });
  });

  it("maps the server's field errors onto the dialog fields", () => {
    expect(
      mapReturnInspectionFieldErrors({
        returnNote: "مطلوب",
        studyReport: RETURN_INSPECTION_STUDY_REPORT_REQUIRED,
      }),
    ).toEqual({
      note: "مطلوب",
      studyReport: RETURN_INSPECTION_STUDY_REPORT_REQUIRED,
      studyReportReason: undefined,
    });
  });
});

describe("return inspection — labels", () => {
  it("explains a deposited appraiser as notify-only", () => {
    expect(returnPartyOutcomeLabel("skipped_deposited")).toBe(
      "المقيّم أودع تقريره — إشعار فقط حتى يُتاح إصدار نسخة جديدة",
    );
    expect(returnPartyOutcomeIsWarning("skipped_deposited")).toBe(true);
    expect(returnPartyOutcomeIsWarning("reopened")).toBe(false);
  });

  it("names the default action and the package status", () => {
    expect(returnImpactActionLabel("reopen")).toBe("إعادة فتح");
    expect(returnImpactActionLabel("notify")).toBe("إشعار");
    expect(returnPackageStatusBadge("submitted")).toEqual({ label: "مُسلَّم", tone: "teal" });
    expect(returnPackageStatusBadge("none").label).toBe("لم يبدأ");
  });

  it("says when the study report was reopened too", () => {
    const result = {
      inspection: {} as never,
      parties: [],
      studyReport: { issued: true, reopened: true },
    };
    expect(returnInspectionSuccessMessage(result)).toContain("تقرير دراسة الحالة");
    expect(
      returnInspectionSuccessMessage({ ...result, studyReport: { issued: true, reopened: false } }),
    ).toBe("أُعيدت المعاينة للمعاين للتصحيح");
  });
});
