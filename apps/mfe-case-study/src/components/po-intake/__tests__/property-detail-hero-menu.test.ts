import { describe, expect, it, vi } from "vitest";
import { buildPropertyDetailHeroMenuItems } from "../property-detail-hero-menu";
import {
  buildTransactionGeneralItems,
  transactionGeneralRules,
  withTransactionGeneralItems,
} from "../../../lib/app-data/transaction-general-actions";
import { staffAccessOf } from "@platform/app-shared/app-data/case-specialist-sub-roles";

const failureItem = {
  id: "failure",
  label: "تسجيل تعذّر",
  danger: true,
  onClick: vi.fn(),
};

describe("buildPropertyDetailHeroMenuItems", () => {
  it("puts دراسة العقار above the general actions", () => {
    const onNavigate = vi.fn();
    const items = buildPropertyDetailHeroMenuItems({
      hideOpenCaseStudy: false,
      caseStudyWorkspaceHref: "/case-study/t1",
      reportTabHref: "/po/x/property/p?tab=report",
      onNavigate,
      generalItems: [failureItem],
    });

    expect(items.map((item) => item.label)).toEqual([
      "دراسة العقار",
      "تسجيل تعذّر",
    ]);
    items[0]?.onClick();
    expect(onNavigate).toHaveBeenCalledWith("/case-study/t1");
  });

  it("opens the work page first when the viewer may open it", () => {
    const onNavigate = vi.fn();
    const items = buildPropertyDetailHeroMenuItems({
      workPageHref: "/po/x/property/p/work",
      hideOpenCaseStudy: true,
      caseStudyWorkspaceHref: null,
      reportTabHref: null,
      onNavigate,
    });
    expect(items.map((item) => item.label)).toEqual(["صفحة العمل"]);
    items[0]?.onClick();
    expect(onNavigate).toHaveBeenCalledWith("/po/x/property/p/work");
  });

  it("falls back to the report tab when the workspace is not available", () => {
    const onNavigate = vi.fn();
    const items = buildPropertyDetailHeroMenuItems({
      hideOpenCaseStudy: false,
      caseStudyWorkspaceHref: null,
      reportTabHref: "/po/x/property/p?tab=report",
      onNavigate,
    });

    expect(items).toHaveLength(1);
    items[0]?.onClick();
    expect(onNavigate).toHaveBeenCalledWith("/po/x/property/p?tab=report");
  });

  it("marks دراسة العقار as busy while it is opening", () => {
    const items = buildPropertyDetailHeroMenuItems({
      hideOpenCaseStudy: false,
      caseStudyWorkspaceHref: "/case-study/t1",
      reportTabHref: null,
      caseStudyBusy: true,
      onNavigate: vi.fn(),
    });

    expect(items[0]?.busy).toBe(true);
    expect(items[0]?.disabled).toBe(true);
  });

  it("omits دراسة العقار when already inside the case-study workspace", () => {
    const items = buildPropertyDetailHeroMenuItems({
      hideOpenCaseStudy: true,
      caseStudyWorkspaceHref: "/case-study/t1",
      reportTabHref: "/po/x/property/p?tab=report",
      onNavigate: vi.fn(),
      generalItems: [failureItem],
    });

    expect(items.map((item) => item.label)).toEqual(["تسجيل تعذّر"]);
  });
});

describe("transaction general actions (2026-11-05)", () => {
  const live = { isRemoved: false, cancelledAtUtc: "" };
  const handlers = {
    onFailure: vi.fn(),
    onCancel: vi.fn(),
    onReopen: vi.fn(),
  };
  const labels = (rules: ReturnType<typeof transactionGeneralRules>) =>
    buildTransactionGeneralItems(rules, handlers).map((i) => i.label);

  it("offers «إعادة فتح المعاملة» first to any specialist once the host says it may reopen", () => {
    const base = {
      access: staffAccessOf("case-specialist", ["study"]),
      canRaiseFailure: false,
      property: live,
      openFailureStatus: null,
    };
    expect(labels(transactionGeneralRules({ ...base, reopenable: true }))[0]).toBe("إعادة فتح المعاملة");
    expect(labels(transactionGeneralRules(base))).not.toContain("إعادة فتح المعاملة");
    expect(
      labels(transactionGeneralRules({ ...base, access: staffAccessOf("general-manager"), reopenable: true })),
    ).not.toContain("إعادة فتح المعاملة");
  });

  it("gives coordination the one failure item and the cancellation request", () => {
    const rules = transactionGeneralRules({
      access: staffAccessOf("case-specialist", ["coordination"]),
      canRaiseFailure: true,
      property: live,
      openFailureStatus: null,
    });
    expect(labels(rules)).toEqual(["تسجيل تعذّر", "طلب إلغاء المعاملة"]);
  });

  // Omar 2026-11-11: one «تسجيل تعذّر» item — the window holds the degrees, the final one among them.
  it("keeps «تسجيل تعذّر» on a deed with an open failure for whoever records the final one", () => {
    const withOpenFailure = (access: ReturnType<typeof staffAccessOf>) =>
      labels(
        transactionGeneralRules({
          access,
          canRaiseFailure: true,
          property: live,
          openFailureStatus: "review",
        }),
      );
    expect(withOpenFailure(staffAccessOf("section-supervisor"))).toEqual([
      "تسجيل تعذّر",
      "إلغاء المعاملة",
    ]);
    expect(withOpenFailure(staffAccessOf("case-specialist", ["study"]))).toEqual(["تسجيل تعذّر"]);
    // The appraiser raises a possible failure only — nothing to record on a deed that has one open.
    expect(withOpenFailure(staffAccessOf("real-estate-appraiser"))).toEqual([]);
  });

  it("offers no failure once the deed is final-failed", () => {
    const rules = transactionGeneralRules({
      access: staffAccessOf("section-supervisor"),
      canRaiseFailure: true,
      property: live,
      openFailureStatus: "approved",
    });
    expect(labels(rules)).toEqual([]);
  });

  it("offers nothing on a cancelled or removed deed, and no cancellation once one is pending", () => {
    const base = {
      access: staffAccessOf("section-supervisor"),
      canRaiseFailure: true,
      openFailureStatus: null,
    };
    expect(
      labels(
        transactionGeneralRules({
          ...base,
          property: { cancelledAtUtc: "2026-11-01" },
        }),
      ),
    ).toEqual([]);
    expect(
      labels(
        transactionGeneralRules({ ...base, property: { isRemoved: true } }),
      ),
    ).toEqual([]);
    expect(
      labels(
        transactionGeneralRules({
          ...base,
          property: live,
          cancellationPending: true,
        }),
      ),
    ).toEqual(["تسجيل تعذّر"]);
  });

  it("keeps a stage menu's own failure item and drops the general one", () => {
    const stage = [
      { id: "register-failure", label: "تسجيل تعذّر", onClick: vi.fn() },
    ];
    const general = [
      failureItem,
      {
        id: "cancel-transaction",
        label: "طلب إلغاء المعاملة",
        onClick: vi.fn(),
      },
    ];
    expect(
      withTransactionGeneralItems(stage, general).map((i) => i.id),
    ).toEqual(["register-failure", "cancel-transaction"]);
  });
});
