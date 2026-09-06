import { describe, expect, it } from "vitest";
import { emptyProperty } from "../../lib/app-data/po-intake-data";
import type { WorkflowTask } from "../../lib/app-data/tasks-storage";
import {
  activeTaskWorkStep,
  BOURSE_OBSTRUCTION_ACTION,
  BOURSE_SAVE_ACTION,
  canRaiseFailure,
  canShowPrimarySave,
  DISTRIBUTION_CONFIRM_ACTION,
  distributionValidationContext,
  isBourseObstructionPath,
  persistedEnfathProperty,
  removedPropertyNote,
  resolveTaskWorkScreen,
  resolveTaskWorkSteps,
  savedEnfathProperty,
  taskWorkChromeTitle,
  taskWorkPanelStepTitle,
  taskWorkRoleFlags,
  taskWorkSaveLabel,
  taskWorkTitles,
} from "../my-task-work-state";

function task(overrides: Record<string, unknown> = {}): WorkflowTask {
  return {
    id: "t1",
    poNumber: "PO-2026-00007",
    title: "صك 555 — عقار",
    phase: "enfath",
    status: "open",
    propertyId: "p1",
    propertyOrdinal: 3,
    ...overrides,
  } as unknown as WorkflowTask;
}

const noSteps = {
  bourseInquiryFastPath: false,
  bourseInquiryPanelOnly: false,
  showEnfathStep: false,
  showBourseStep: false,
  showDistribution: false,
  showCaseStudy: false,
};

describe("resolveTaskWorkSteps", () => {
  it("a deed on «enfath» renders the Infath card only", () => {
    expect(resolveTaskWorkSteps("enfath", "page", "deed")).toEqual({
      ...noSteps,
      showEnfathStep: true,
    });
  });

  it("a bourse inquiry on «enfath» takes the fast path: bourse card, not the Infath card", () => {
    expect(resolveTaskWorkSteps("enfath", "page", "bourse_inquiry")).toEqual({
      ...noSteps,
      bourseInquiryFastPath: true,
      showBourseStep: true,
    });
  });

  it("in the primary-data panel the bourse inquiry stays on the Infath tab", () => {
    expect(resolveTaskWorkSteps("enfath", "panel", "bourse_inquiry")).toEqual({
      ...noSteps,
      bourseInquiryFastPath: true,
      bourseInquiryPanelOnly: true,
      showEnfathStep: true,
    });
  });

  it("later phases map one-to-one onto their card", () => {
    expect(resolveTaskWorkSteps("bourse", "page", "deed").showBourseStep).toBe(true);
    expect(resolveTaskWorkSteps("distribution", "page", "deed").showDistribution).toBe(true);
    expect(resolveTaskWorkSteps("case-study", "page", "deed").showCaseStudy).toBe(true);
    expect(activeTaskWorkStep(resolveTaskWorkSteps("case-study", "page", "deed"))).toBeNull();
  });
});

describe("save label and titles", () => {
  const bourse = resolveTaskWorkSteps("bourse", "page", "deed");
  const distribution = resolveTaskWorkSteps("distribution", "page", "deed");

  it("follows the active step, with «غير فعال» routing the bourse save to the supervisor", () => {
    expect(taskWorkSaveLabel(resolveTaskWorkSteps("enfath", "page", "deed"), null)).toBe("حفظ");
    expect(taskWorkSaveLabel(bourse, "active")).toBe(BOURSE_SAVE_ACTION);
    expect(taskWorkSaveLabel(bourse, "inactive")).toBe(BOURSE_OBSTRUCTION_ACTION);
    expect(taskWorkSaveLabel(distribution, "inactive")).toBe(DISTRIBUTION_CONFIRM_ACTION);
    expect(isBourseObstructionPath(distribution, "inactive")).toBe(false);
  });

  it("names the panel step and keeps the deed in the page title", () => {
    expect(taskWorkPanelStepTitle(bourse)).toBe("استعلام البورصة");
    expect(taskWorkChromeTitle(bourse, "panel", "555")).toBe("استعلام البورصة");
    expect(taskWorkChromeTitle(bourse, "page", "555")).toBe("تعديل عقار — 555");
  });

  it("prefers the deed, then the task label, then the slot ordinal", () => {
    expect(taskWorkTitles(task(), { deedNumber: " 555 " })).toMatchObject({
      deedTitle: "555",
      panelDeedBadge: "555",
    });
    expect(taskWorkTitles(task(), { deedNumber: "" })).toMatchObject({
      deedTitle: "صك 555",
      panelDeedBadge: "خانة 3",
    });
    expect(
      taskWorkTitles(task({ propertyId: null, title: "" }), { deedNumber: "" }).deedTitle,
    ).toBe("خانة 3");
    expect(taskWorkTitles(task(), { deedNumber: "" }).workSubtitle).toContain(
      "أخصائي دراسة الحالة",
    );
  });
});

describe("resolveTaskWorkScreen", () => {
  const base = {
    loading: false,
    linkedPropertyRemoved: false,
    task: task(),
    showCaseStudy: false,
    isSpecialist: true,
  };

  it("checks loading, removal, obstruction, case-study, completion, then role", () => {
    expect(resolveTaskWorkScreen({ ...base, loading: true, linkedPropertyRemoved: true })).toBe("loading");
    expect(resolveTaskWorkScreen({ ...base, linkedPropertyRemoved: true })).toBe("removed");
    expect(resolveTaskWorkScreen({ ...base, task: task({ phase: "obstruction" }) })).toBe("obstruction");
    expect(resolveTaskWorkScreen({ ...base, showCaseStudy: true })).toBe("case-study");
    expect(resolveTaskWorkScreen({ ...base, task: task({ phase: "done" }) })).toBe("done");
    expect(resolveTaskWorkScreen({ ...base, task: task({ status: "completed" }) })).toBe("done");
    expect(resolveTaskWorkScreen({ ...base, isSpecialist: false })).toBe("not-specialist");
    expect(resolveTaskWorkScreen(base)).toBe("work");
  });
});

describe("footer decisions", () => {
  it("offers the primary save only to a specialist with a step left to work", () => {
    expect(canShowPrimarySave(task(), false, true)).toBe(true);
    expect(canShowPrimarySave(task(), true, true)).toBe(false);
    expect(canShowPrimarySave(task({ phase: "obstruction" }), false, true)).toBe(false);
    expect(canShowPrimarySave(task({ status: "completed" }), false, true)).toBe(false);
    expect(canShowPrimarySave(task(), false, false)).toBe(false);
  });

  it("offers «تسجيل تعذر» once a property exists on the bourse or distribution step", () => {
    const bourse = resolveTaskWorkSteps("bourse", "page", "deed");
    expect(canRaiseFailure(task(), bourse)).toBe(true);
    expect(canRaiseFailure(task(), resolveTaskWorkSteps("distribution", "page", "deed"))).toBe(true);
    expect(canRaiseFailure(task(), resolveTaskWorkSteps("enfath", "page", "deed"))).toBe(false);
    expect(canRaiseFailure(task({ propertyId: null }), bourse)).toBe(false);
  });
});

describe("taskWorkRoleFlags", () => {
  it("cdo is both supervisor and specialist; each other role is one or neither", () => {
    expect(taskWorkRoleFlags("cdo")).toMatchObject({ isSupervisor: true, isSpecialist: true });
    expect(taskWorkRoleFlags("section-supervisor")).toMatchObject({
      isSupervisor: true,
      isSpecialist: false,
    });
    expect(taskWorkRoleFlags("case-specialist")).toMatchObject({
      isSupervisor: false,
      isSpecialist: true,
    });
    expect(taskWorkRoleFlags("field-inspector")).toMatchObject({
      isSupervisor: false,
      isSpecialist: false,
    });
    expect(taskWorkRoleFlags("case-specialist").failureSpecialist).not.toBe("");
  });
});

describe("property helpers", () => {
  it("persists the bourse flag from whether the identifier skips bourse", () => {
    const deed = { ...emptyProperty(), identifierType: "deed" as const, realEstateRegNumber: "" };
    expect(persistedEnfathProperty(deed).bourseDataCompleted).toBe(false);
    const registered = { ...deed, realEstateRegNumber: "REG-9" };
    expect(persistedEnfathProperty(registered).bourseDataCompleted).toBe(true);
    const saved = { ...deed, id: "server" };
    expect(savedEnfathProperty(registered, saved)).toEqual({ ...saved, bourseDataCompleted: true });
    expect(savedEnfathProperty(deed, saved)).toBe(saved);
  });

  it("formats the removal note and extracts the distribution validation fields", () => {
    expect(removedPropertyNote("  ")).toBe("هذا العقار محذوف. لا يمكن متابعة المعاملة.");
    expect(removedPropertyNote(" مكرر ")).toBe("هذا العقار محذوف — مكرر. لا يمكن متابعة المعاملة.");
    const property = { ...emptyProperty(), deedNumber: "555", city: "جدة", circuit: "3" };
    expect(distributionValidationContext(property, "PO-1")).toMatchObject({
      deedNumber: "555",
      city: "جدة",
      circuit: "3",
      poNumber: "PO-1",
    });
  });
});
