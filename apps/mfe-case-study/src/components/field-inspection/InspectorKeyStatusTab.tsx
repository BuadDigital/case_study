"use client";

import { useEffect, useState } from "react";
import { Button, Note } from "@platform/design-system";
import {
  FieldBox,
  FieldsGrid,
  SectionHeader,
} from "../po-intake/PropertyDetailFields";
import {
  governmentReviewKeyHandedToInspectorLabel,
  governmentReviewKeysStatusLabel,
  type GovernmentReviewKeyHandedToInspector,
  type GovernmentReviewKeysStatus,
} from "../../lib/prototype/government-review-work-data";
import {
  fetchGovernmentReviewSubmission,
  GOVERNMENT_REVIEW_SUBMISSION_CHANGED_EVENT,
} from "../../lib/prototype/government-review-work-storage";
import { useWorkflowTasksQuery } from "../../query/case-study-queries";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";

export type InspectorKeyAvailability = {
  keyHandedToInspector: GovernmentReviewKeyHandedToInspector | "";
  keysStatus: GovernmentReviewKeysStatus | "";
  /** جاهز لإتمام المعاينة من ناحية المفتاح */
  keyAvailable: boolean;
};

/** حالة المفتاح كما سجّلها المراجع الحكومي لنفس العقار */
export function useInspectorKeyAvailability(
  task: WorkflowTask,
): InspectorKeyAvailability {
  const { data: allTasks } = useWorkflowTasksQuery();
  const [state, setState] = useState<InspectorKeyAvailability>({
    keyHandedToInspector: "",
    keysStatus: "",
    keyAvailable: false,
  });

  useEffect(() => {
    const govTask = allTasks?.find(
      (t) =>
        t.kind === "government-review" &&
        t.propertyId === task.propertyId &&
        t.poNumber === task.poNumber,
    );
    if (!govTask) {
      setState({
        keyHandedToInspector: "",
        keysStatus: "",
        keyAvailable: false,
      });
      return;
    }

    let cancelled = false;
    const load = () => {
      void fetchGovernmentReviewSubmission(govTask.id).then((sub) => {
        if (cancelled) return;
        const keyHandedToInspector = sub?.keyHandedToInspector ?? "";
        const keysStatus = sub?.keysStatus ?? "";
        setState({
          keyHandedToInspector,
          keysStatus,
          keyAvailable:
            keyHandedToInspector === "yes" || keysStatus === "not_required",
        });
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

  return state;
}

/** @deprecated use useInspectorKeyAvailability */
export function useInspectorKeyHandedStatus(
  task: WorkflowTask,
): GovernmentReviewKeyHandedToInspector | "" {
  return useInspectorKeyAvailability(task).keyHandedToInspector;
}

export function InspectorKeyStatusTab({
  task,
  vacantLand = false,
  onRegisterKeyFailure,
}: {
  task: WorkflowTask;
  vacantLand?: boolean;
  onRegisterKeyFailure?: () => void;
}) {
  const { keyHandedToInspector, keysStatus, keyAvailable } =
    useInspectorKeyAvailability(task);
  const handedLabel =
    keyHandedToInspector === ""
      ? "لم تُحدَّد بعد"
      : governmentReviewKeyHandedToInspectorLabel(keyHandedToInspector);
  const keysLabel =
    keysStatus === ""
      ? "لم تُحدَّد بعد"
      : governmentReviewKeysStatusLabel(keysStatus);
  const blocksCompletion = !vacantLand && !keyAvailable;

  return (
    <div>
      <SectionHeader>المفتاح</SectionHeader>
      <Note tone="info" className="mb-4">
        حالة المفتاح من المراجع الحكومي إلى المعاين الميداني.
      </Note>
      <FieldsGrid>
        <FieldBox label="حالة المفاتيح" value={keysLabel} />
        <FieldBox label="التسليم للمعاين" value={handedLabel} />
      </FieldsGrid>
      {blocksCompletion ? (
        <Note tone="warning" className="mt-4">
          بدون استلام المفتاح لا يمكن إتمام المعاينة (ما عدا الأرض الفضاء أو
          المفاتيح «غير مطلوبة»). إذا المفتاح غير متوفر أو لا يفتح: سجّل تعذراً
          مع ملاحظة.
          {onRegisterKeyFailure ? (
            <div className="mt-3">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onRegisterKeyFailure}
              >
                تسجيل تعذر المفتاح
              </Button>
            </div>
          ) : null}
        </Note>
      ) : null}
    </div>
  );
}
