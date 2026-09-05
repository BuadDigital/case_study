import { describe, expect, it } from "vitest";
import type { FailureRecord } from "@platform/app-shared/failures/failures-types";
import {
  EMPTY_RESOLVE_DRAFT,
  FAILURES_DEFAULT_EMPTY_LINE,
  assignmentSpecialistByPo,
  failureActionPermissions,
  failureBusyKey,
  failureCardSpecialist,
  failureCardTone,
  failureMetaRows,
  failureRowTitle,
  failuresEmptyLine,
  failuresKpiStats,
  isCaseEditor,
  isFailureBusy,
  isResolveDraftComplete,
  isSupervisor,
  partyScopedFailuresEmptyLine,
  patchResolveDraftMap,
  resolveDraftFor,
  resolvedFailureRedirect,
  viewerModeNote,
} from "../failures-view-state";

function failure(
  id: string,
  overrides: Partial<FailureRecord> = {},
): FailureRecord {
  return {
    id,
    poNumber: "PO-1",
    propertyId: `prop-${id}`,
    deedNumber: `D-${id}`,
    title: `تعذر ${id}`,
    problemTypeId: "access-denied",
    severity: "internal",
    raisedByRole: "case-specialist",
    internalNote: "",
    finalNote: "",
    resolutionReason: "",
    continueInstructions: "",
    status: "review",
    specialist: "osama",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  } as FailureRecord;
}

describe("viewer roles", () => {
  it("lets the cdo, case specialist and section supervisor act", () => {
    expect(isCaseEditor("cdo")).toBe(true);
    expect(isCaseEditor("case-specialist")).toBe(true);
    expect(isCaseEditor("section-supervisor")).toBe(false);
    expect(isSupervisor("cdo")).toBe(true);
    expect(isSupervisor("section-supervisor")).toBe(true);
    expect(isSupervisor("case-specialist")).toBe(false);
  });

  it("gives party-scoped roles their own empty line and others the generic one", () => {
    expect(partyScopedFailuresEmptyLine("engineering-office")).toContain("الرفع المساحي");
    expect(partyScopedFailuresEmptyLine("field-inspector")).toContain("المعاينة الميدانية");
    expect(partyScopedFailuresEmptyLine("real-estate-appraiser")).toContain("تقييم العقار");
    expect(partyScopedFailuresEmptyLine("government-reviewer")).toContain("«المهام»");
    expect(partyScopedFailuresEmptyLine("case-specialist")).toBeNull();
    expect(failuresEmptyLine("case-specialist")).toBe(FAILURES_DEFAULT_EMPTY_LINE);
    expect(failuresEmptyLine("field-inspector")).toContain("المعاينة الميدانية");
  });

  it("shows the viewer-mode note only to roles that cannot act or raise", () => {
    expect(viewerModeNote("case-specialist")).toBeNull();
    expect(viewerModeNote("section-supervisor")).toBeNull();
    expect(viewerModeNote("cdo")).toBeNull();
    expect(viewerModeNote("field-inspector")).toBeNull();
    expect(viewerModeNote("general-manager")).toBe(
      "أنت في وضع الاطلاع — صلاحية التعديل للمشرف والأخصائي",
    );
    expect(viewerModeNote("financial-officer" as never)).toBe(
      "أنت في وضع المراقبة — لا تملك صلاحية تعديل التعذرات",
    );
  });
});

describe("failuresKpiStats", () => {
  it("counts open, review, closed and non-suspended totals in one pass", () => {
    const stats = failuresKpiStats([
      failure("a", { status: "internal" }),
      failure("b", { status: "review" }),
      failure("c", { status: "returned" }),
      failure("d", { status: "approved" }),
      failure("e", { status: "resolved" }),
      failure("f", { status: "suspended" }),
    ]);
    expect(stats).toEqual({
      open: 3,
      review: 1,
      closed: 2,
      total: 5,
      closedPct: "40% من الإجمالي",
    });
  });

  it("shows a dash for the percentage when there is nothing", () => {
    expect(failuresKpiStats([]).closedPct).toBe("—");
  });
});

describe("assignmentSpecialistByPo", () => {
  it("maps trimmed work orders to trimmed names and skips blanks", () => {
    const map = assignmentSpecialistByPo([
      { poNumber: " PO-1 ", assignmentSpecialist: " سارة " },
      { poNumber: "PO-2", assignmentSpecialist: "  " },
      { poNumber: "PO-3" },
    ]);
    expect(map.get("PO-1")).toBe("سارة");
    expect(map.has("PO-2")).toBe(false);
    expect(map.has("PO-3")).toBe(false);
  });
});

describe("row and card display", () => {
  it("prefixes the deed with «صك» once, else falls back to the failure title", () => {
    expect(failureRowTitle(failure("a", { deedNumber: "123" }))).toBe("صك 123");
    expect(failureRowTitle(failure("a", { deedNumber: "صك 123" }))).toBe("صك 123");
    expect(failureRowTitle(failure("a", { deedNumber: "", title: "عنوان" }))).toBeTruthy();
  });

  it("prefers the assignment specialist of the work order", () => {
    const byPo = new Map([["PO-1", "سارة"]]);
    expect(failureCardSpecialist(failure("a"), byPo)).toBe("سارة");
    expect(failureCardSpecialist(failure("a", { poNumber: "PO-9" }), byPo)).toBe("osama");
    expect(
      failureCardSpecialist(failure("a", { poNumber: "PO-9", specialist: " " }), byPo),
    ).toBe("");
  });

  it("tones cards by activity and severity", () => {
    // «approved» is still active (isActiveFailureStatus); only resolved / suspended are done.
    expect(failureCardTone(failure("a", { status: "resolved" }))).toBe("done");
    expect(failureCardTone(failure("a", { status: "suspended" }))).toBe("done");
    expect(failureCardTone(failure("a", { status: "approved" }))).toBe("returned");
    expect(failureCardTone(failure("a", { severity: "suspected" }))).toBe("pending");
    expect(failureCardTone(failure("a", { severity: "internal" }))).toBe("returned");
  });
});

describe("resolve draft", () => {
  it("reads an empty draft, patches immutably and checks completeness", () => {
    expect(resolveDraftFor({}, "a")).toBe(EMPTY_RESOLVE_DRAFT);
    const patched = patchResolveDraftMap({}, "a", { reason: "سبب" });
    expect(patched.a).toEqual({ reason: "سبب", instructions: "" });
    expect(isResolveDraftComplete(patched.a!)).toBe(false);
    const done = patchResolveDraftMap(patched, "a", { instructions: "توجيه" });
    expect(isResolveDraftComplete(done.a!)).toBe(true);
    expect(patched.a!.instructions).toBe("");
    expect(isResolveDraftComplete({ reason: " ", instructions: "x" })).toBe(false);
  });
});

describe("failureActionPermissions", () => {
  const viewerBoth = { caseEditor: true, supervisor: true };

  it("lets the specialist act on internal / returned and the supervisor on review", () => {
    expect(failureActionPermissions(failure("a", { status: "internal" }), viewerBoth)).toEqual({
      active: true,
      canSpecialistAct: true,
      canSupervisorAct: false,
      canResolve: true,
    });
    expect(failureActionPermissions(failure("a", { status: "review" }), viewerBoth)).toEqual({
      active: true,
      canSpecialistAct: false,
      canSupervisorAct: true,
      canResolve: false,
    });
  });

  it("denies everything on closed records and to plain viewers", () => {
    expect(
      failureActionPermissions(failure("a", { status: "resolved" }), viewerBoth),
    ).toEqual({
      active: false,
      canSpecialistAct: false,
      canSupervisorAct: false,
      canResolve: false,
    });
    // Approved stays active but is neither a specialist nor a supervisor step.
    expect(
      failureActionPermissions(failure("a", { status: "approved" }), viewerBoth),
    ).toEqual({
      active: true,
      canSpecialistAct: false,
      canSupervisorAct: false,
      canResolve: false,
    });
    expect(
      failureActionPermissions(failure("a", { status: "returned" }), {
        caseEditor: false,
        supervisor: false,
      }).canSpecialistAct,
    ).toBe(false);
  });
});

describe("failureMetaRows", () => {
  it("lists the trimmed notes in order and the assignment specialist only under review", () => {
    const byPo = new Map([["PO-1", "سارة"]]);
    const rows = failureMetaRows(
      failure("a", {
        status: "review",
        internalNote: " ملاحظة ",
        finalNote: "",
        resolutionReason: "سبب",
        continueInstructions: "توجيه",
      }),
      byPo,
    );
    expect(rows).toEqual([
      { label: "ملاحظات", value: "ملاحظة" },
      { label: "سبب الحل", value: "سبب" },
      { label: "توجيه استمرار العمل", value: "توجيه" },
      { label: "أخصائي الإسناد", value: "سارة" },
    ]);
    expect(failureMetaRows(failure("b", { status: "internal" }), byPo)).toEqual([]);
    expect(
      failureMetaRows(failure("c", { status: "review", poNumber: "PO-9" }), byPo),
    ).toEqual([{ label: "أخصائي الإسناد", value: "—" }]);
  });
});

describe("busy keys and redirect", () => {
  it("scopes the spinner to one failure's actions", () => {
    expect(failureBusyKey("a", "approve")).toBe("a:approve");
    expect(isFailureBusy("a:approve", "a")).toBe(true);
    expect(isFailureBusy("a:approve", "b")).toBe(false);
    expect(isFailureBusy(null, "a")).toBe(false);
  });

  it("sends unknown-boundaries resolutions to the bourse inquiry", () => {
    expect(resolvedFailureRedirect(failure("a", { problemTypeId: "unknown-boundaries" }))).toBe(
      "/bourse-inquiry",
    );
    expect(resolvedFailureRedirect(failure("a"))).toBeNull();
    expect(resolvedFailureRedirect(undefined)).toBeNull();
  });
});
