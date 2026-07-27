import type { FailureRecord } from "@failures/mfe";
import { failuresForProperty } from "@failures/mfe";
import type { PoPropertyIntake } from "./po-intake-data";
import type { PropertyUiStatus } from "./po-intake-data";
import { childTasksForCaseStudyParent } from "./case-study-party-answers";
import {
  caseStudyTaskForProperty,
  type WorkflowTask,
} from "./tasks-storage";

/**
 * Derive Case Study.html PSTATUS for the property hero badge.
 */
export function derivePropertyUiStatus(input: {
  poNumber: string;
  property: PoPropertyIntake;
  tasks: WorkflowTask[];
  failures: FailureRecord[];
}): PropertyUiStatus {
  const { poNumber, property, tasks, failures } = input;
  const propertyFailures = failuresForProperty(failures, {
    poNumber,
    propertyId: property.id,
    deedNumber: property.deedNumber,
  });
  if (
    propertyFailures.some(
      (f) =>
        f.status === "approved" ||
        f.status === "review" ||
        f.status === "internal",
    ) ||
    property.deedStatus.trim() === "موقوف"
  ) {
    return "fail";
  }

  const parent = caseStudyTaskForProperty(poNumber, property.id, tasks);
  if (!parent) {
    return property.bourseDataCompleted ? "new" : "incomplete";
  }

  if (parent.status === "completed" || parent.phase === "done") {
    return "done";
  }

  const children = childTasksForCaseStudyParent(parent.id, tasks);
  const blocked = children.some((c) => c.status === "blocked");
  if (blocked) return "incomplete";

  const started =
    parent.phase === "distribution" ||
    parent.phase === "case-study" ||
    parent.phase === "bourse" ||
    children.some(
      (c) => c.status === "open" || c.status === "completed",
    );

  if (started) return "progress";
  return property.bourseDataCompleted ? "new" : "incomplete";
}
