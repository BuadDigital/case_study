"use client";

import { useCallback, useEffect, useState } from "react";
import {
  confirmKeyEnvelopeAssignment,
  confirmKeyEnvelopeHandoff,
  getPropertyKeyGate,
  type PropertyKeyGateDto,
} from "@platform/api-client";
import { Button, Note } from "@platform/design-system";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";
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
  source?: string;
  envelopeId?: string | null;
  assignmentId?: string | null;
  assignmentStatus?: string | null;
  pendingHandoffId?: string | null;
  studyHoldStatus?: string;
};

function mapGate(gate: PropertyKeyGateDto): InspectorKeyAvailability {
  return {
    keyHandedToInspector:
      (gate.keyHandedToInspector as GovernmentReviewKeyHandedToInspector) || "",
    keysStatus: (gate.keysStatus as GovernmentReviewKeysStatus) || "",
    keyAvailable: gate.keyAvailable,
    source: gate.source,
    envelopeId: gate.envelopeId,
    assignmentId: gate.assignmentId,
    assignmentStatus: gate.assignmentStatus,
    pendingHandoffId: gate.pendingHandoffId,
    studyHoldStatus: gate.studyHoldStatus,
  };
}

/** حالة المفتاح من ظرف المفاتيح (مع fallback للمراجعة الحكومية) */
export function useInspectorKeyAvailability(
  task: WorkflowTask,
): InspectorKeyAvailability {
  const { data: allTasks } = useWorkflowTasksQuery();
  const [state, setState] = useState<InspectorKeyAvailability>({
    keyHandedToInspector: "",
    keysStatus: "",
    keyAvailable: false,
  });

  const reload = useCallback(() => {
    const config = prototypeModulesApiConfig();
    if (!config || !task.propertyId) {
      setState({
        keyHandedToInspector: "",
        keysStatus: "",
        keyAvailable: false,
      });
      return;
    }

    void getPropertyKeyGate(config, {
      propertyId: task.propertyId,
      poNumber: task.poNumber,
    }).then((result) => {
      if (result.ok) {
        setState(mapGate(result.data));
        return;
      }

      // Legacy fallback if gate API unavailable
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
      void fetchGovernmentReviewSubmission(govTask.id).then((sub) => {
        const keyHandedToInspector = sub?.keyHandedToInspector ?? "";
        const keysStatus = sub?.keysStatus ?? "";
        setState({
          keyHandedToInspector,
          keysStatus,
          keyAvailable:
            keyHandedToInspector === "yes" ||
            keysStatus === "not_required" ||
            keysStatus === "received",
          source: "legacy",
        });
      });
    });
  }, [allTasks, task.poNumber, task.propertyId]);

  useEffect(() => {
    reload();
    window.addEventListener(GOVERNMENT_REVIEW_SUBMISSION_CHANGED_EVENT, reload);
    return () => {
      window.removeEventListener(
        GOVERNMENT_REVIEW_SUBMISSION_CHANGED_EVENT,
        reload,
      );
    };
  }, [reload]);

  return state;
}

/** @deprecated use useInspectorKeyAvailability */
export function useInspectorKeyHandedStatus(
  task: WorkflowTask,
): GovernmentReviewKeyHandedToInspector | "" {
  return useInspectorKeyAvailability(task).keyHandedToInspector;
}

function assignmentStatusLabel(status?: string | null): string {
  switch (status) {
    case "matched":
      return "مطابق";
    case "unmatched":
      return "غير مطابق";
    case "pending":
      return "بانتظار التأكيد";
    default:
      return "—";
  }
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
  const availability = useInspectorKeyAvailability(task);
  const {
    keyHandedToInspector,
    keysStatus,
    keyAvailable,
    envelopeId,
    assignmentId,
    assignmentStatus,
    pendingHandoffId,
    studyHoldStatus,
  } = availability;
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [local, setLocal] = useState(availability);

  useEffect(() => {
    setLocal(availability);
  }, [availability]);

  const handedLabel =
    (local.keyHandedToInspector || keyHandedToInspector) === ""
      ? "لم تُحدَّد بعد"
      : governmentReviewKeyHandedToInspectorLabel(
          (local.keyHandedToInspector ||
            keyHandedToInspector) as GovernmentReviewKeyHandedToInspector,
        );
  const keysLabel =
    (local.keysStatus || keysStatus) === ""
      ? "لم تُحدَّد بعد"
      : governmentReviewKeysStatusLabel(
          (local.keysStatus || keysStatus) as GovernmentReviewKeysStatus,
        );
  const available = local.keyAvailable || keyAvailable;
  const blocksCompletion = !vacantLand && !available;

  const refreshGate = async () => {
    const config = prototypeModulesApiConfig();
    if (!config || !task.propertyId) return;
    const result = await getPropertyKeyGate(config, {
      propertyId: task.propertyId,
      poNumber: task.poNumber,
    });
    if (result.ok) setLocal(mapGate(result.data));
  };

  const confirmAssignment = async (status: "matched" | "unmatched") => {
    const config = prototypeModulesApiConfig();
    const envId = local.envelopeId || envelopeId;
    const asgId = local.assignmentId || assignmentId;
    if (!config || !envId || !asgId) return;
    setBusy(true);
    setActionError(null);
    const result = await confirmKeyEnvelopeAssignment(
      config,
      envId,
      asgId,
      { status },
    );
    setBusy(false);
    if (!result.ok) {
      setActionError("تعذّر تحديث حالة المطابقة");
      return;
    }
    await refreshGate();
  };

  const confirmHandoff = async () => {
    const config = prototypeModulesApiConfig();
    const envId = local.envelopeId || envelopeId;
    const handoffId = local.pendingHandoffId || pendingHandoffId;
    if (!config || !envId || !handoffId) return;
    setBusy(true);
    setActionError(null);
    const result = await confirmKeyEnvelopeHandoff(config, envId, handoffId);
    setBusy(false);
    if (!result.ok) {
      setActionError("تعذّر تأكيد استلام المناولة");
      return;
    }
    await refreshGate();
  };

  const showAssignmentActions =
    Boolean(local.envelopeId || envelopeId) &&
    Boolean(local.assignmentId || assignmentId) &&
    (local.assignmentStatus || assignmentStatus) !== "matched" &&
    (local.assignmentStatus || assignmentStatus) !== "unmatched";
  const showHandoffConfirm = Boolean(
    (local.pendingHandoffId || pendingHandoffId) &&
      (local.envelopeId || envelopeId),
  );

  return (
    <div>
      <SectionHeader>المفتاح</SectionHeader>
      <Note tone="info" className="mb-4">
        حالة المفتاح من ظرف المفاتيح / المراجع الحكومي إلى المعاين الميداني.
      </Note>
      <FieldsGrid>
        <FieldBox label="حالة المفاتيح" value={keysLabel} />
        <FieldBox label="التسليم للمعاين" value={handedLabel} />
        <FieldBox
          label="حالة الإسناد"
          value={assignmentStatusLabel(
            local.assignmentStatus || assignmentStatus,
          )}
        />
        {studyHoldStatus && studyHoldStatus !== "none" ? (
          <FieldBox label="تمكين/إخلاء" value={studyHoldStatus} />
        ) : null}
      </FieldsGrid>

      {showHandoffConfirm ? (
        <Note tone="warning" className="mt-4">
          توجد مناولة داخلية بانتظار تأكيد الاستلام.
          <div className="mt-3">
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void confirmHandoff()}
            >
              تأكيد استلام المناولة
            </Button>
          </div>
        </Note>
      ) : null}

      {showAssignmentActions ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => void confirmAssignment("matched")}
          >
            مطابق
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void confirmAssignment("unmatched")}
          >
            غير مطابق
          </Button>
        </div>
      ) : null}

      {actionError ? (
        <Note tone="danger" className="mt-4">
          {actionError}
        </Note>
      ) : null}

      {blocksCompletion ? (
        <Note tone="warning" className="mt-4">
          بدون استلام المفتاح لا يمكن إتمام المعاينة (ما عدا الأرض الفضاء أو
          المفاتيح «غير مطلوبة» أو تمكين بلا مفتاح). إذا المفتاح غير متوفر أو لا
          يفتح: سجّل تعذراً مع ملاحظة.
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
