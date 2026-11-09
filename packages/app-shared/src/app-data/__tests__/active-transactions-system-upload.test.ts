import { describe, expect, it } from "vitest";
import type { WorkflowTask } from "../../workflow/task-types";
import {
  filterTasksForCaseStudy,
  filterTasksForReceipt,
  filterTasksForSystemUpload,
  filterTasksForUploadPrep,
} from "../active-transactions";

function task(over: Partial<WorkflowTask>): WorkflowTask {
  return {
    id: "t",
    kind: "case-study-property",
    poNumber: "PO-1",
    propertyId: "p1",
    propertyOrdinal: 1,
    title: "",
    phase: "done",
    assigneeRole: "case-specialist",
    assigneeName: "",
    status: "completed",
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    ...over,
  } as WorkflowTask;
}

const study = task({ id: "study", readyForUpload: true });
const appraisal = (status: WorkflowTask["status"], propertyId = "p1") =>
  task({
    id: `appraisal-${propertyId}-${status}`,
    kind: "property-appraisal",
    assigneeRole: "real-estate-appraiser",
    propertyId,
    status,
  });

describe("filterTasksForSystemUpload", () => {
  it("lists a deposited deed only once review prepared it for the upload (Omar 2026-11-08)", () => {
    const notReady = task({ id: "not-ready", readyForUpload: false });
    const all = [notReady, appraisal("completed")];
    expect(filterTasksForSystemUpload([notReady], all)).toEqual([]);
    expect(filterTasksForUploadPrep([notReady], all)).toEqual([notReady]);
    expect(filterTasksForUploadPrep([study], [study, appraisal("completed")])).toEqual([]);
  });

  it("lists an issued study only once the valuation is deposited", () => {
    expect(filterTasksForSystemUpload([study], [study, appraisal("completed")])).toEqual([study]);
    expect(filterTasksForSystemUpload([study], [study, appraisal("open")])).toEqual([]);
    expect(filterTasksForSystemUpload([study], [study])).toEqual([]);
  });

  it("drops a deed once it is handed over to Enfaz", () => {
    const handedOver = task({ id: "handed", propertyHandedOverToEnfaz: true });
    expect(filterTasksForSystemUpload([handedOver], [handedOver, appraisal("completed")])).toEqual([]);
  });

  it("ignores a cancelled appraisal and an open study", () => {
    expect(filterTasksForSystemUpload([study], [study, appraisal("cancelled")])).toEqual([]);
    const openStudy = task({ id: "open", status: "open", phase: "case-study" });
    expect(filterTasksForSystemUpload([openStudy], [openStudy, appraisal("completed")])).toEqual([]);
  });

  it("reads the appraisal from the full list, not the viewer's own tasks", () => {
    expect(filterTasksForSystemUpload([study])).toEqual([]);
    expect(filterTasksForSystemUpload([study], [appraisal("completed")])).toEqual([study]);
  });

  it("a folded deed follows the holder deed's valuation", () => {
    const folded = task({ id: "folded", propertyId: "p2", transactionStudyHolderPropertyId: "p1", readyForUpload: true });
    expect(
      filterTasksForSystemUpload([folded], [appraisal("completed", "p1"), appraisal("open", "p2")]),
    ).toEqual([folded]);
    expect(
      filterTasksForSystemUpload([folded], [appraisal("open", "p1"), appraisal("completed", "p2")]),
    ).toEqual([]);
  });
});

describe("coordination receipt vs study queue (ruling 2026-11-02)", () => {
  const waiting = task({ id: "waiting", phase: "case-study", status: "open", transactionReceived: false });
  const received = task({ id: "received", phase: "case-study", status: "open", transactionReceived: true });
  const finished = task({ id: "finished", phase: "done", status: "completed" });

  it("keeps a distributed transaction with coordination until its formal receipt", () => {
    expect(filterTasksForReceipt([waiting, received, finished])).toEqual([waiting]);
    expect(filterTasksForCaseStudy([waiting, received, finished])).toEqual([received, finished]);
  });

  it("leaves a folded deed out of both queues", () => {
    const folded = task({
      id: "folded",
      phase: "case-study",
      status: "open",
      transactionStudyHolderPropertyId: "p-holder",
    });
    expect(filterTasksForReceipt([folded])).toEqual([]);
    expect(filterTasksForCaseStudy([folded])).toEqual([]);
  });
});
