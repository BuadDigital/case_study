import { describe, expect, it } from "vitest";
import { emptyProperty } from "../../lib/app-data/po-intake-data";
import type { WorkflowTask } from "../../lib/app-data/tasks";
import {
  activeTaskWorkStep,
  BOURSE_SAVE_ACTION,
  bourseDeedStatus,
  canRaiseFailure,
  canShowPrimarySave,
  canWorkTaskStep,
  DISTRIBUTION_CONFIRM_ACTION,
  distributionValidationContext,
  newPropertyDraftKey,
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

describe("resolveTaskWorkSteps", () => {
  it("each phase maps one-to-one onto its card — Infath, bourse, distribution, case study", () => {
    expect(resolveTaskWorkSteps("enfath")).toEqual({
      showEnfathStep: true,
      showBourseStep: false,
      showDistribution: false,
      showCaseStudy: false,
    });
    expect(resolveTaskWorkSteps("bourse")).toMatchObject({
      showEnfathStep: false,
      showBourseStep: true,
    });
    expect(resolveTaskWorkSteps("distribution").showDistribution).toBe(true);
    expect(resolveTaskWorkSteps("case-study").showCaseStudy).toBe(true);
    expect(activeTaskWorkStep(resolveTaskWorkSteps("case-study"))).toBeNull();
  });
});

describe("save label and titles", () => {
  const bourse = resolveTaskWorkSteps("bourse");
  const distribution = resolveTaskWorkSteps("distribution");

  it("follows the active step — an inactive deed no longer reroutes the bourse save", () => {
    expect(taskWorkSaveLabel(resolveTaskWorkSteps("enfath"))).toBe("حفظ");
    expect(taskWorkSaveLabel(bourse)).toBe(BOURSE_SAVE_ACTION);
    expect(taskWorkSaveLabel(distribution)).toBe(DISTRIBUTION_CONFIRM_ACTION);
  });

  it("records the deed status the specialist picked, defaulting to active", () => {
    expect(bourseDeedStatus("active")).toBe("فعال");
    expect(bourseDeedStatus("inactive")).toBe("غير فعال");
    expect(bourseDeedStatus(null)).toBe("فعال");
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
    const bourse = resolveTaskWorkSteps("bourse");
    expect(canRaiseFailure(task(), bourse)).toBe(true);
    expect(canRaiseFailure(task(), resolveTaskWorkSteps("distribution"))).toBe(true);
    expect(canRaiseFailure(task(), resolveTaskWorkSteps("enfath"))).toBe(false);
    expect(canRaiseFailure(task({ propertyId: null }), bourse)).toBe(false);
  });
});

describe("canWorkTaskStep", () => {
  const enfath = resolveTaskWorkSteps("enfath");
  const bourse = resolveTaskWorkSteps("bourse");
  const distribution = resolveTaskWorkSteps("distribution");

  it("lets the case specialist and the CDO write the Infath and bourse steps, nobody else", () => {
    const specialist = taskWorkRoleFlags("case-specialist");
    const cdo = taskWorkRoleFlags("cdo");
    expect(canWorkTaskStep(enfath, specialist)).toBe(true);
    expect(canWorkTaskStep(bourse, specialist)).toBe(true);
    expect(canWorkTaskStep(enfath, cdo)).toBe(true);
    expect(canWorkTaskStep(bourse, cdo)).toBe(true);
    expect(canWorkTaskStep(enfath, taskWorkRoleFlags("section-supervisor"))).toBe(false);
  });

  it("keeps the distribution step's audience unchanged", () => {
    expect(canWorkTaskStep(distribution, taskWorkRoleFlags("cdo"))).toBe(true);
    expect(canWorkTaskStep(distribution, taskWorkRoleFlags("case-specialist"))).toBe(true);
    expect(canWorkTaskStep(distribution, taskWorkRoleFlags("section-supervisor"))).toBe(false);
  });
});

describe("taskWorkRoleFlags", () => {
  it("cdo is both supervisor and specialist and writes a property; each other role is one or neither", () => {
    expect(taskWorkRoleFlags("cdo")).toMatchObject({
      isSupervisor: true,
      isSpecialist: true,
      canEditProperty: true,
    });
    expect(taskWorkRoleFlags("general-manager").isSupervisor).toBe(true);
    expect(taskWorkRoleFlags("case-specialist").canEditProperty).toBe(true);
    expect(taskWorkRoleFlags("section-supervisor").canEditProperty).toBe(false);
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
  it("does not mark bourse complete on enfath save", () => {
    const deed = { ...emptyProperty(), identifierType: "deed" as const, realEstateRegNumber: "" };
    expect(persistedEnfathProperty(deed).bourseDataCompleted).toBe(false);
    const registered = { ...deed, realEstateRegNumber: "REG-9" };
    expect(persistedEnfathProperty(registered).bourseDataCompleted).toBe(false);
    const saved = { ...deed, id: "server" };
    expect(savedEnfathProperty(registered, saved)).toBe(saved);
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

  it("keys a not-yet-created property's autosave draft to the task, not a re-rolled property id", () => {
    expect(newPropertyDraftKey("t1")).toBe(newPropertyDraftKey("t1"));
    expect(newPropertyDraftKey("t1")).not.toBe(newPropertyDraftKey("t2"));
  });
});
