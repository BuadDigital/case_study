import { describe, expect, it, vi } from "vitest";
import { buildPropertyDetailHeroMenuItems } from "../property-detail-hero-menu";

describe("buildPropertyDetailHeroMenuItems", () => {
  it("puts دراسة العقار above تسجيل تعذر", () => {
    const onNavigate = vi.fn();
    const onOpenFailure = vi.fn();
    const items = buildPropertyDetailHeroMenuItems({
      hideOpenCaseStudy: false,
      caseStudyWorkspaceHref: "/case-study/t1",
      reportTabHref: "/po/x/property/p?tab=report",
      onNavigate,
      onOpenFailure,
    });

    expect(items.map((item) => item.label)).toEqual([
      "دراسة العقار",
      "تسجيل تعذر",
    ]);
    items[0]?.onClick();
    expect(onNavigate).toHaveBeenCalledWith("/case-study/t1");
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
      onOpenFailure: vi.fn(),
    });

    expect(items[0]?.busy).toBe(true);
    expect(items[0]?.disabled).toBe(true);
    expect(items[1]?.disabled).toBe(true);
  });

  it("omits دراسة العقار when already inside the case-study workspace", () => {
    const items = buildPropertyDetailHeroMenuItems({
      hideOpenCaseStudy: true,
      caseStudyWorkspaceHref: "/case-study/t1",
      reportTabHref: "/po/x/property/p?tab=report",
      onNavigate: vi.fn(),
      onOpenFailure: vi.fn(),
    });

    expect(items.map((item) => item.label)).toEqual(["تسجيل تعذر"]);
  });
});
