import { describe, expect, it } from "vitest";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import type { WorkflowTask } from "../tasks-storage";
import {
  buildCaseStudyPartyAssignees,
  caseStudyFamilyParentId,
} from "../case-study-tracks";
import { buildPropertyDetailTimelinePartyRows } from "../property-detail-parties";
import { caseStudyFamilyTaskForProperty } from "../tasks-reads";

const staff: StaffUser[] = [
  {
    id: "u-fi",
    name: "أحمد سعيد",
    distributionAssigneeId: "fi-ahmed",
    role: "معاين ميداني",
    roleId: "field-inspector",
    email: "fi@ejadah.dev",
    type: "internal",
  },
  {
    id: "u-val",
    name: "عبدالله الكثيري",
    distributionAssigneeId: "val-abdullah",
    role: "مقيم عقاري",
    roleId: "real-estate-appraiser",
    email: "val@ejadah.dev",
    type: "internal",
  },
];

function task(
  partial: Partial<WorkflowTask> & Pick<WorkflowTask, "id" | "kind">,
): WorkflowTask {
  return {
    poNumber: "PO-1",
    propertyOrdinal: 1,
    title: "t",
    phase: "case-study",
    status: "open",
    assigneeRole: "case-specialist",
    assigneeName: "x",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    propertyId: "prop-1",
    ...partial,
  };
}

describe("caseStudyFamilyParentId", () => {
  it("uses parentTaskId on party children", () => {
    const child = task({
      id: "val-1",
      kind: "property-appraisal",
      parentTaskId: "parent-1",
    });
    expect(caseStudyFamilyParentId(child)).toBe("parent-1");
    expect(
      caseStudyFamilyParentId(
        task({ id: "parent-1", kind: "case-study-property" }),
      ),
    ).toBe("parent-1");
  });
});

describe("buildCaseStudyPartyAssignees", () => {
  it("names the appraiser from the queue row when the parent is not in the list", () => {
    const appraisal = task({
      id: "val-1",
      kind: "property-appraisal",
      parentTaskId: "parent-1",
      assigneeRole: "real-estate-appraiser",
      assigneeName: "مقيم عقاري",
      assigneeId: "val-abdullah",
      distribution: {
        governmentAuditor: false,
        governmentAuditorId: "",
        valuationDepartment: true,
        inspectorId: "fi-ahmed",
        valuatorId: "val-abdullah",
        engineeringOffice: false,
        engineeringOfficeId: "",
        caseSpecialist: true,
        caseSpecialistId: "cs-1",
      },
    });

    const parties = buildCaseStudyPartyAssignees(
      appraisal,
      [appraisal],
      undefined,
      staff,
    );
    const byTrack = Object.fromEntries(parties.map((p) => [p.trackId, p]));

    expect(byTrack.appraisal.enabled).toBe(true);
    expect(byTrack.appraisal.name).toBe("عبدالله الكثيري");
    expect(byTrack.inspection.enabled).toBe(true);
    expect(byTrack.inspection.name).toBe("أحمد سعيد");
    expect(byTrack.survey.enabled).toBe(false);
  });
});

describe("caseStudyFamilyTaskForProperty", () => {
  it("prefers the parent case-study task when it is in the list", () => {
    const parent = task({ id: "parent-1", kind: "case-study-property" });
    const appraisal = task({
      id: "val-1",
      kind: "property-appraisal",
      parentTaskId: "parent-1",
    });
    expect(
      caseStudyFamilyTaskForProperty("PO-1", "prop-1", [appraisal, parent])?.id,
    ).toBe("parent-1");
  });

  it("falls back to the appraisal child when the parent is hidden from the viewer", () => {
    const appraisal = task({
      id: "val-1",
      kind: "property-appraisal",
      parentTaskId: "parent-1",
    });
    expect(
      caseStudyFamilyTaskForProperty("PO-1", "prop-1", [appraisal])?.id,
    ).toBe("val-1");
  });
});

describe("buildPropertyDetailTimelinePartyRows", () => {
  it("shows assigned names from an appraisal-only task list", () => {
    const appraisal = task({
      id: "val-1",
      kind: "property-appraisal",
      parentTaskId: "parent-1",
      assigneeRole: "real-estate-appraiser",
      assigneeName: "مقيم عقاري",
      assigneeId: "val-abdullah",
      fieldInspectionCompleted: true,
      distribution: {
        governmentAuditor: false,
        governmentAuditorId: "",
        valuationDepartment: true,
        inspectorId: "fi-ahmed",
        valuatorId: "val-abdullah",
        engineeringOffice: false,
        engineeringOfficeId: "",
        caseSpecialist: true,
        caseSpecialistId: "cs-1",
      },
    });

    const rows = buildPropertyDetailTimelinePartyRows({
      task: caseStudyFamilyTaskForProperty("PO-1", "prop-1", [appraisal]) ?? null,
      allTasks: [appraisal],
      staffUsers: staff,
    });
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));

    expect(byKey.appraisal.label).toBe("عبدالله الكثيري");
    expect(byKey.appraisal.badge).toBe("قيد التنفيذ");
    expect(byKey.inspection.label).toBe("أحمد سعيد");
    expect(byKey.inspection.badge).toBe("مكتمل");
    expect(byKey.survey.label).toBe("لم يُعيَّن");
    expect(byKey.survey.badge).toBe("معطّل");
  });
});
