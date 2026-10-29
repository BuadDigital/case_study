import type { FailureRecord } from "@platform/app-shared/failures/failures-types";
import { failuresForProperty } from "@failures/mfe/lib/failure-property-match";
import type { PoPropertyIntake } from "./po-intake-data";
import type { PropertyUiStatus } from "./po-intake-data";
import { PropertyListRowStatuses, type PropertyListRowStatus } from "@platform/api-client";
import { isValuationDepositedForTask } from "@platform/app-shared/workflow/task-done";
import { childTasksForCaseStudyParent } from "./case-study-party-answers";
import {
  caseStudyFamilyTaskForProperty,
  caseStudyTaskForProperty,
  type WorkflowTask,
} from "./tasks";

/**
 * Derive Case Study.html PSTATUS for the property hero badge. «مكتمل» is the Enfaz handover
 * (the server's property-row status says `done`); «جاهز للرفع» is the issued study report plus the
 * deposited valuation report — the study alone stays «قيد العمل».
 */
export function derivePropertyUiStatus(input: {
  poNumber: string;
  property: PoPropertyIntake;
  tasks: WorkflowTask[];
  failures: FailureRecord[];
  /** The property carries the Enfaz handover stamp (server property-row status `done`). */
  handedOverToEnfaz?: boolean;
  /**
   * The server's property-row status for this viewer. A party (appraiser, inspector, surveyor) does
   * not see the case-study task, so the tasks alone said «جديد» even after the final report; the
   * row the server computes for the party's own track is the status then.
   */
  serverRowStatus?: PropertyListRowStatus | null;
}): PropertyUiStatus {
  const { poNumber, property, tasks, failures, handedOverToEnfaz = false } = input;
  // «إلغاء المعاملة» wins over every other state — the deed is out of the work.
  if (property.cancelledAtUtc) return PropertyListRowStatuses.Cancelled;
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
    return PropertyListRowStatuses.Fail;
  }

  const parent = caseStudyTaskForProperty(poNumber, property.id, tasks);
  if (!parent) {
    // Round 2: the party's own track is finished (the appraiser's task completes with the final
    // report) — «مكتمل», not the overall row's «قيد العمل» beside «اكتمل التقييم».
    const ownTrack = caseStudyFamilyTaskForProperty(poNumber, property.id, tasks);
    if (ownTrack?.status === "completed") return PropertyListRowStatuses.Done;
    if (input.serverRowStatus) return input.serverRowStatus;
    return property.bourseDataCompleted
      ? PropertyListRowStatuses.New
      : PropertyListRowStatuses.Incomplete;
  }

  if (parent.status === "completed" || parent.phase === "done") {
    if (handedOverToEnfaz) return PropertyListRowStatuses.Done;
    // The study is issued before the valuation: «جاهز للرفع» waits for the deposited valuation.
    return isValuationDepositedForTask(parent, tasks)
      ? PropertyListRowStatuses.Ready
      : PropertyListRowStatuses.Progress;
  }

  const children = childTasksForCaseStudyParent(parent.id, tasks);
  const blocked = children.some((c) => c.status === "blocked");
  if (blocked) return PropertyListRowStatuses.Incomplete;

  const started =
    parent.phase === "distribution" ||
    parent.phase === "case-study" ||
    parent.phase === "bourse" ||
    children.some(
      (c) => c.status === "open" || c.status === "completed",
    );

  if (started) return PropertyListRowStatuses.Progress;
  return property.bourseDataCompleted
    ? PropertyListRowStatuses.New
    : PropertyListRowStatuses.Incomplete;
}
