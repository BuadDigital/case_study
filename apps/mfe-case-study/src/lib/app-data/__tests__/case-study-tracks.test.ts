import { describe, expect, it } from "vitest";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import type { WorkflowTask } from "../tasks-storage";
import {
  buildCaseStudyPartyAssignees,
  caseStudyFamilyParentId,
} from "../case-study-tracks";

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
