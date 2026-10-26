import { describe, expect, it } from "vitest";
import type { WorkflowTask } from "@platform/app-shared/workflow/task-types";
import { PropertyListRowStatuses } from "@platform/api-client";
import type { PoPropertyIntake } from "../po-intake-data";
import { derivePropertyUiStatus } from "../property-detail-ui-status";

const PO = "PO-2026-001";
const PROPERTY_ID = "11111111-1111-1111-1111-111111111111";

function property(): PoPropertyIntake {
  return {
    id: PROPERTY_ID,
    deedNumber: "77123",
    deedStatus: "",
    bourseDataCompleted: true,
  } as unknown as PoPropertyIntake;
}

function parentTask(status: WorkflowTask["status"], phase: WorkflowTask["phase"]): WorkflowTask {
  return {
    id: "task-parent",
    kind: "case-study-property",
    poNumber: PO,
    propertyId: PROPERTY_ID,
    propertyOrdinal: 1,
    title: "دراسة",
    phase,
    assigneeRole: "case-specialist",
    assigneeName: "أخصائي",
    status,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
  } as WorkflowTask;
}

describe("derivePropertyUiStatus — a party's view (round 2)", () => {
  it("without the case-study task, the server's row status for the party wins over «جديد»", () => {
    expect(
      derivePropertyUiStatus({
        poNumber: PO,
        property: property(),
        tasks: [],
        failures: [],
        serverRowStatus: PropertyListRowStatuses.Done,
      }),
    ).toBe(PropertyListRowStatuses.Done);
    expect(
      derivePropertyUiStatus({ poNumber: PO, property: property(), tasks: [], failures: [] }),
    ).toBe(PropertyListRowStatuses.New);
  });

  it("the appraiser's own completed task (final report issued) reads «مكتمل», not the row's «قيد العمل»", () => {
    const appraisal = {
      ...parentTask("completed", "done"),
      id: "task-appraisal",
      kind: "property-appraisal",
      assigneeRole: "real-estate-appraiser",
    } as WorkflowTask;
    expect(
      derivePropertyUiStatus({
        poNumber: PO,
        property: property(),
        tasks: [appraisal],
        failures: [],
        serverRowStatus: PropertyListRowStatuses.Progress,
      }),
    ).toBe(PropertyListRowStatuses.Done);
    expect(
      derivePropertyUiStatus({
        poNumber: PO,
        property: property(),
        tasks: [{ ...appraisal, status: "open", phase: "case-study" } as WorkflowTask],
        failures: [],
        serverRowStatus: PropertyListRowStatuses.Progress,
      }),
    ).toBe(PropertyListRowStatuses.Progress);
  });

  it("the case-study task, when visible, still decides", () => {
    expect(
      derivePropertyUiStatus({
        poNumber: PO,
        property: property(),
        tasks: [parentTask("completed", "done")],
        failures: [],
        serverRowStatus: PropertyListRowStatuses.Progress,
      }),
    ).toBe(PropertyListRowStatuses.Ready);
  });
});

describe("derivePropertyUiStatus", () => {
  it("shows «جاهز للرفع» once the report is issued but the handover is not recorded", () => {
    expect(
      derivePropertyUiStatus({
        poNumber: PO,
        property: property(),
        tasks: [parentTask("completed", "done")],
        failures: [],
      }),
    ).toBe(PropertyListRowStatuses.Ready);
  });

  it("shows «مكتمل» only for a property handed over to Enfaz", () => {
    expect(
      derivePropertyUiStatus({
        poNumber: PO,
        property: property(),
        tasks: [parentTask("completed", "done")],
        failures: [],
        handedOverToEnfaz: true,
      }),
    ).toBe(PropertyListRowStatuses.Done);
  });

  it("keeps an open study in progress whatever the handover flag says", () => {
    expect(
      derivePropertyUiStatus({
        poNumber: PO,
        property: property(),
        tasks: [parentTask("open", "case-study")],
        failures: [],
        handedOverToEnfaz: false,
      }),
    ).toBe(PropertyListRowStatuses.Progress);
  });
});
