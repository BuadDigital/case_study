"use client";

import { useEffect, useState } from "react";
import { Note } from "@platform/design-system";
import {
  FieldBox,
  FieldsGrid,
  SectionHeader,
} from "../po-intake/PropertyDetailFields";
import {
  governmentReviewKeyHandedToInspectorLabel,
  type GovernmentReviewKeyHandedToInspector,
} from "../../lib/prototype/government-review-work-data";
import {
  fetchGovernmentReviewSubmission,
  GOVERNMENT_REVIEW_SUBMISSION_CHANGED_EVENT,
} from "../../lib/prototype/government-review-work-storage";
import { useWorkflowTasksQuery } from "../../query/case-study-queries";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";

/** حالة تسليم المفتاح كما سجّلها المراجع الحكومي لنفس العقار */
export function useInspectorKeyHandedStatus(
  task: WorkflowTask,
): GovernmentReviewKeyHandedToInspector | "" {
  const { data: allTasks } = useWorkflowTasksQuery();
  const [status, setStatus] = useState<
    GovernmentReviewKeyHandedToInspector | ""
  >("");

  useEffect(() => {
    const govTask = allTasks?.find(
      (t) =>
        t.kind === "government-review" &&
        t.propertyId === task.propertyId &&
        t.poNumber === task.poNumber,
    );
    if (!govTask) {
      setStatus("");
      return;
    }

    let cancelled = false;
    const load = () => {
      void fetchGovernmentReviewSubmission(govTask.id).then((sub) => {
        if (!cancelled) {
          setStatus(sub?.keyHandedToInspector ?? "");
        }
      });
    };

    load();
    window.addEventListener(GOVERNMENT_REVIEW_SUBMISSION_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(
        GOVERNMENT_REVIEW_SUBMISSION_CHANGED_EVENT,
        load,
      );
    };
  }, [allTasks, task.propertyId, task.poNumber]);

  return status;
}

export function InspectorKeyStatusTab({ task }: { task: WorkflowTask }) {
  const keyStatus = useInspectorKeyHandedStatus(task);
  const value =
    keyStatus === ""
      ? "لم تُحدَّد بعد"
      : governmentReviewKeyHandedToInspectorLabel(keyStatus);

  return (
    <div>
      <SectionHeader>المفتاح</SectionHeader>
      <Note tone="info" className="mb-4">
        حالة تسليم المفتاح من المراجع الحكومي إلى المعاين الميداني — للعرض فقط.
      </Note>
      <FieldsGrid>
        <FieldBox label="المفتاح" value={value} />
      </FieldsGrid>
    </div>
  );
}
