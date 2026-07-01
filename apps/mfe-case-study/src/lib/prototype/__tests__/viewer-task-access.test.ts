import { describe, expect, it } from "vitest";
import {
  canOpenCaseStudyWorkspace,
  canViewWorkflowTask,
  resolveQueueTasksForViewer,
} from "../viewer-task-access";
import type { WorkflowTask } from "../tasks-storage";

const enfathTask: WorkflowTask = {
  id: "task-1",
  kind: "case-study-property",
  poNumber: "PO-1",
  propertyId: undefined,
  assigneeName: "أخصائي",
  assigneeRole: "case-specialist",
  title: "عقار 1",
  propertyOrdinal: 1,
  phase: "enfath",
  status: "open",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("resolveQueueTasksForViewer", () => {
  it("shows enfath tasks to section supervisor on primary-data page", () => {
    const listed = resolveQueueTasksForViewer({
      role: "section-supervisor",
      tasks: [enfathTask],
      pageId: "active-primary-data",
    });
    expect(listed).toEqual([enfathTask]);
  });

  it("hides specialist enfath tasks from section supervisor on party pages", () => {
    const listed = resolveQueueTasksForViewer({
      role: "section-supervisor",
      tasks: [enfathTask],
      pageId: "property-inspection",
      partyAssignee: true,
      assigneeRole: "field-inspector",
    });
    expect(listed).toEqual([]);
  });

  it("still scopes case specialist to assigned tasks", () => {
    const listed = resolveQueueTasksForViewer({
      role: "case-specialist",
      tasks: [enfathTask],
      pageId: "active-primary-data",
    });
    expect(listed).toEqual([enfathTask]);
  });
});

describe("canOpenCaseStudyWorkspace", () => {
  const caseStudyPhaseTask: WorkflowTask = {
    ...enfathTask,
    id: "task-cs",
    phase: "case-study",
  };

  it("lets section supervisor open parent tasks in any phase", () => {
    expect(
      canOpenCaseStudyWorkspace("section-supervisor", enfathTask, [enfathTask]),
    ).toBe(true);
    expect(
      canOpenCaseStudyWorkspace(
        "section-supervisor",
        caseStudyPhaseTask,
        [caseStudyPhaseTask],
      ),
    ).toBe(true);
  });

  it("lets case specialist open assigned parent tasks", () => {
    expect(
      canOpenCaseStudyWorkspace("case-specialist", enfathTask, [enfathTask]),
    ).toBe(true);
  });

  it("blocks party roles from the full workspace", () => {
    expect(
      canOpenCaseStudyWorkspace("engineering-office", enfathTask, [enfathTask]),
    ).toBe(false);
  });
});

describe("canViewWorkflowTask", () => {
  it("lets section supervisor open primary-data tasks", () => {
    expect(
      canViewWorkflowTask({
        role: "section-supervisor",
        task: enfathTask,
        tasks: [enfathTask],
        pageId: "active-primary-data",
        matchesPage: (task) => task.phase === "enfath",
      }),
    ).toBe(true);
  });
});
