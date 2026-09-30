import { describe, expect, it } from "vitest";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import type { WorkflowTask } from "../tasks";
import {
  assignedCaseStudyParties,
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
    type: "internal",
  },
  {
    id: "u-val",
    name: "عبدالله الكثيري",
    distributionAssigneeId: "val-abdullah",
    role: "مقيم عقاري",
    roleId: "real-estate-appraiser",
    type: "internal",
  },
  {
    id: "u-eo",
    name: "مكتب جدة الهندسي",
    distributionAssigneeId: "eo-jeddah",
    role: "مكتب هندسي",
    roleId: "engineering-office",
    type: "external",
  },
  {
    id: "u-cs",
    name: "أسامة الصالح",
    distributionAssigneeId: "cs-1",
    role: "أخصائي دراسة الحالة",
    roleId: "case-specialist",
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
      fieldInspectionTaskId: "insp-1",
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

  it("shows the engineering office named on the distribution", () => {
    const appraisal = task({
      id: "val-1",
      kind: "property-appraisal",
      parentTaskId: "parent-1",
      assigneeRole: "real-estate-appraiser",
      assigneeName: "مقيم عقاري",
      assigneeId: "val-abdullah",
      engineeringSurveyAssigned: false,
      distribution: {
        governmentAuditor: false,
        governmentAuditorId: "",
        valuationDepartment: true,
        inspectorId: "fi-ahmed",
        valuatorId: "val-abdullah",
        engineeringOffice: true,
        engineeringOfficeId: "eo-jeddah",
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
    expect(parties.find((p) => p.trackId === "survey")).toMatchObject({
      enabled: true,
      name: "مكتب جدة الهندسي",
    });
  });

  it("shows the engineering office from the mirrored assigned flag", () => {
    const appraisal = task({
      id: "val-1",
      kind: "property-appraisal",
      parentTaskId: "parent-1",
      assigneeRole: "real-estate-appraiser",
      assigneeName: "مقيم عقاري",
      assigneeId: "val-abdullah",
      engineeringSurveyAssigned: true,
      distribution: {
        governmentAuditor: false,
        governmentAuditorId: "",
        valuationDepartment: true,
        inspectorId: "fi-ahmed",
        valuatorId: "val-abdullah",
        engineeringOffice: true,
        engineeringOfficeId: "eo-jeddah",
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
    expect(parties.find((p) => p.trackId === "survey")?.enabled).toBe(true);
  });

  it("assignedCaseStudyParties lists parties that have a named assignee", () => {
    const plannedOnly = task({
      id: "val-1",
      kind: "property-appraisal",
      parentTaskId: "parent-1",
      assigneeRole: "real-estate-appraiser",
      assigneeName: "مقيم عقاري",
      assigneeId: "val-abdullah",
      engineeringSurveyAssigned: false,
      distribution: {
        governmentAuditor: false,
        governmentAuditorId: "",
        valuationDepartment: true,
        inspectorId: "fi-ahmed",
        valuatorId: "val-abdullah",
        engineeringOffice: true,
        engineeringOfficeId: "eo-jeddah",
        caseSpecialist: true,
        caseSpecialistId: "cs-1",
      },
    });

    expect(
      assignedCaseStudyParties(plannedOnly, [plannedOnly], staff).map(
        (p) => p.role,
      ),
    ).toEqual(["المكتب الهندسي", "المعاين", "المقيم"]);

    const noInspector = task({
      ...plannedOnly,
      distribution: {
        ...plannedOnly.distribution!,
        inspectorId: "",
        engineeringOfficeId: "",
      },
    });
    expect(
      assignedCaseStudyParties(noInspector, [noInspector], staff).map(
        (p) => p.trackId,
      ),
    ).toEqual(["appraisal"]);

    const allThree = task({
      ...plannedOnly,
      engineeringSurveyAssigned: true,
    });
    expect(
      assignedCaseStudyParties(allThree, [allThree], staff).map((p) => p.role),
    ).toEqual(["المكتب الهندسي", "المعاين", "المقيم"]);
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

  it("reads the mirrored survey flag when the sibling task is not visible", () => {
    // The appraiser's /api/workflow-tasks returns property-appraisal rows only,
    // so the survey row's state can only come from the server-mirrored flag.
    const appraisalTask = (engineeringSurveyCompleted: boolean) =>
      task({
        id: "val-1",
        kind: "property-appraisal",
        parentTaskId: "parent-1",
        assigneeRole: "real-estate-appraiser",
        assigneeName: "مقيم عقاري",
        assigneeId: "val-abdullah",
        fieldInspectionCompleted: true,
        engineeringSurveyAssigned: true,
        engineeringSurveyCompleted,
        distribution: {
          governmentAuditor: false,
          governmentAuditorId: "",
          valuationDepartment: true,
          inspectorId: "fi-ahmed",
          valuatorId: "val-abdullah",
          engineeringOffice: true,
          engineeringOfficeId: "eo-jeddah",
          caseSpecialist: true,
          caseSpecialistId: "cs-1",
        },
      });

    const badgeFor = (completed: boolean) => {
      const appraisal = appraisalTask(completed);
      const rows = buildPropertyDetailTimelinePartyRows({
        task: caseStudyFamilyTaskForProperty("PO-1", "prop-1", [appraisal]) ?? null,
        allTasks: [appraisal],
        staffUsers: staff,
      });
      return rows.find((r) => r.key === "survey")?.badge;
    };

    expect(badgeFor(true)).toBe("مكتمل");
    expect(badgeFor(false)).toBe("لم يبدأ");
  });

  describe("specialist row", () => {
    const distribution = {
      governmentAuditor: false,
      governmentAuditorId: "",
      valuationDepartment: true,
      inspectorId: "fi-ahmed",
      valuatorId: "val-abdullah",
      engineeringOffice: false,
      engineeringOfficeId: "",
      caseSpecialist: true,
      caseSpecialistId: "cs-1",
    };

    it("leads the list with the parent's assignee and status", () => {
      const parent = task({
        id: "parent-1",
        kind: "case-study-property",
        assigneeName: "أسامة الصالح",
        assigneeId: "cs-1",
        distribution,
      });
      const rows = buildPropertyDetailTimelinePartyRows({
        task: parent,
        allTasks: [parent],
        staffUsers: staff,
      });
      expect(rows[0]).toMatchObject({
        key: "specialist",
        label: "أسامة الصالح",
        role: "أخصائي دراسة الحالة",
        badge: "قيد التنفيذ",
      });
    });

    it("never shows the appraiser as the specialist when only the child is visible", () => {
      const appraisal = task({
        id: "val-1",
        kind: "property-appraisal",
        parentTaskId: "parent-1",
        assigneeRole: "real-estate-appraiser",
        assigneeName: "عبدالله الكثيري",
        assigneeId: "val-abdullah",
        distribution,
      });
      const rows = buildPropertyDetailTimelinePartyRows({
        task: appraisal,
        allTasks: [appraisal],
        staffUsers: staff,
      });
      expect(rows[0]).toMatchObject({ key: "specialist", label: "أسامة الصالح" });
    });

    it("shows the appraiser and engineering office named on the case-study parent", () => {
      const parent = task({
        id: "parent-1",
        kind: "case-study-property",
        assigneeName: "أسامة الصالح",
        assigneeId: "cs-1",
        distribution: {
          ...distribution,
          engineeringOffice: true,
          engineeringOfficeId: "eo-jeddah",
        },
      });
      const rows = buildPropertyDetailTimelinePartyRows({
        task: parent,
        allTasks: [parent],
        staffUsers: staff,
      });
      expect(rows.find((r) => r.key === "appraisal")).toMatchObject({
        label: "عبدالله الكثيري",
        badge: "لم يبدأ",
      });
      expect(rows.find((r) => r.key === "survey")).toMatchObject({
        label: "مكتب جدة الهندسي",
        badge: "لم يبدأ",
      });
      expect(rows.find((r) => r.key === "inspection")?.label).toBe("أحمد سعيد");
    });

    it("shows the inspector as complete after inspection when only the parent is listed", () => {
      const parent = task({
        id: "parent-1",
        kind: "case-study-property",
        assigneeName: "أسامة الصالح",
        assigneeId: "cs-1",
        fieldInspectionCompleted: true,
        distribution,
      });
      const rows = buildPropertyDetailTimelinePartyRows({
        task: parent,
        allTasks: [parent],
        staffUsers: staff,
      });
      expect(rows.find((r) => r.key === "inspection")).toMatchObject({
        label: "أحمد سعيد",
        badge: "مكتمل",
      });
    });

    it("shows the inspector as complete from a sibling mirror when the inspection row is hidden", () => {
      const parent = task({
        id: "parent-1",
        kind: "case-study-property",
        assigneeName: "أسامة الصالح",
        assigneeId: "cs-1",
        distribution,
      });
      const appraisal = task({
        id: "val-1",
        kind: "property-appraisal",
        parentTaskId: "parent-1",
        assigneeRole: "real-estate-appraiser",
        assigneeName: "مقيم عقاري",
        assigneeId: "val-abdullah",
        fieldInspectionCompleted: true,
        distribution,
      });
      const rows = buildPropertyDetailTimelinePartyRows({
        task: parent,
        allTasks: [parent, appraisal],
        staffUsers: staff,
      });
      expect(rows.find((r) => r.key === "inspection")).toMatchObject({
        label: "أحمد سعيد",
        badge: "مكتمل",
      });
    });

    it("shows the inspector as complete when the package was submitted", () => {
      const parent = task({
        id: "parent-1",
        kind: "case-study-property",
        assigneeName: "أسامة الصالح",
        assigneeId: "cs-1",
        distribution,
      });
      const rows = buildPropertyDetailTimelinePartyRows({
        task: parent,
        allTasks: [parent],
        staffUsers: staff,
        inspectionSubmitted: true,
      });
      expect(rows.find((r) => r.key === "inspection")).toMatchObject({
        label: "أحمد سعيد",
        badge: "مكتمل",
      });
    });

    it("reads «لم يُعيَّن» without a task", () => {
      const rows = buildPropertyDetailTimelinePartyRows({
        task: null,
        allTasks: [],
        staffUsers: staff,
      });
      expect(rows[0]).toMatchObject({ key: "specialist", label: "لم يُعيَّن" });
    });
  });
});
