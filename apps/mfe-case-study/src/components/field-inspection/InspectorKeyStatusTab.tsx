"use client";

import { useCallback, useEffect, useState } from "react";
import {
  confirmKeyEnvelopeAssignment,
  confirmKeyEnvelopeHandoff,
  getPropertyKeyGate,
  type PropertyKeyGateDto,
} from "@platform/api-client";
import { Button, Note, cn } from "@platform/ui-kit";
import { prototypeModulesApiConfig } from "@platform/app-shared/prototype/prototype-modules-api-config";
import {
  FieldBox,
  FieldsGrid,
  SectionHeader,
} from "../po-intake/PropertyDetailFields";
import {
  keyHandedLabelAr,
  keysStatusLabelAr,
} from "../../query/use-property-key-gate-query";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";

export type InspectorKeyAvailability = {
  keyHandedToInspector: string;
  keysStatus: string;
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
    keyHandedToInspector: gate.keyHandedToInspector || "",
    keysStatus: gate.keysStatus || "",
    keyAvailable: gate.keyAvailable,
    source: gate.source,
    envelopeId: gate.envelopeId,
    assignmentId: gate.assignmentId,
    assignmentStatus: gate.assignmentStatus,
    pendingHandoffId: gate.pendingHandoffId,
    studyHoldStatus: gate.studyHoldStatus,
  };
}

/** حالة المفتاح من ظرف المفاتيح فقط */
export function useInspectorKeyAvailability(
  task: WorkflowTask,
): InspectorKeyAvailability {
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
      setState({
        keyHandedToInspector: "",
        keysStatus: "",
        keyAvailable: false,
      });
    });
  }, [task.poNumber, task.propertyId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return state;
}

function AssignmentStatusBadge({ status }: { status?: string | null }) {
  const label =
    status === "matched"
      ? "مطابق"
      : status === "unmatched"
        ? "غير مطابق"
        : status === "pending"
          ? "غير مؤكد"
          : "مفقود";
  return (
    <span
      className={cn(
        "inline-flex min-w-[4.5rem] flex-col items-center justify-center rounded-md border bg-surface px-2.5 py-1 text-[11px] font-bold leading-tight",
        status === "matched" && "border-success/45 text-success-text",
        status === "unmatched" && "border-danger/45 text-danger-text",
        status === "pending" && "border-border-md text-text-2",
        !status && "border-danger/45 text-danger-text",
      )}
    >
      {status === "unmatched" ? (
        <>
          <span>غير</span>
          <span>مطابق</span>
        </>
      ) : (
        label
      )}
    </span>
  );
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

  const handedLabel = keyHandedLabelAr(
    local.keyHandedToInspector || keyHandedToInspector,
  );
  const keysLabel = keysStatusLabelAr(local.keysStatus || keysStatus);
  const available = local.keyAvailable || keyAvailable;
  const keyNotOnHand = !vacantLand && !available;
  const status = local.assignmentStatus || assignmentStatus;

  const refreshGate = async () => {
    const config = prototypeModulesApiConfig();
    if (!config || !task.propertyId) return;
    const result = await getPropertyKeyGate(config, {
      propertyId: task.propertyId,
      poNumber: task.poNumber,
    });
    if (result.ok) setLocal(mapGate(result.data));
  };

  const confirmAssignment = async (next: "matched" | "unmatched") => {
    const config = prototypeModulesApiConfig();
    const envId = local.envelopeId || envelopeId;
    const asgId = local.assignmentId || assignmentId;
    if (!config || !envId || !asgId) return;
    setBusy(true);
    setActionError(null);
    const result = await confirmKeyEnvelopeAssignment(config, envId, asgId, {
      status: next,
    });
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
    status !== "matched" &&
    status !== "unmatched";
  const showHandoffConfirm = Boolean(
    (local.pendingHandoffId || pendingHandoffId) &&
      (local.envelopeId || envelopeId),
  );

  return (
    <div>
      <SectionHeader>المفتاح</SectionHeader>
      <Note tone="info" className="mb-4">
        حالة المفتاح من ظرف المفاتيح إلى المعاين الميداني.
      </Note>
      <FieldsGrid>
        <FieldBox label="حالة المفاتيح" value={keysLabel} />
        <FieldBox label="التسليم للمعاين" value={handedLabel} />
        <div>
          <div className="mb-1 text-[11px] font-medium text-text-3">
            حالة الإسناد
          </div>
          <AssignmentStatusBadge status={status} />
        </div>
        {studyHoldStatus && studyHoldStatus !== "none" ? (
          <FieldBox label="تمكين/إخلاء" value={studyHoldStatus} />
        ) : null}
      </FieldsGrid>

      {showHandoffConfirm ? (
        <Note tone="warn" className="mt-4">
          توجد مناولة داخلية بانتظار تأكيد الاستلام.
          <div className="mt-3">
            <Button
              type="button"
              size="sm"
              loading={busy}
              showActionToast={false}
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
            loading={busy}
            showActionToast={false}
            onClick={() => void confirmAssignment("matched")}
          >
            مطابق
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            loading={busy}
            showActionToast={false}
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

      {keyNotOnHand ? (
        <Note tone="info" className="mt-4">
          المفتاح غير متاح حالياً (ظرف المفاتيح / تمكين) — هذا لا يمنع إتمام
          المعاينة. إذا الدخول متعذر بسبب المفتاح: سجّل تعذراً مع ملاحظة.
          {onRegisterKeyFailure ? (
            <div className="mt-3">
              <Button
                type="button"
                variant="outline"
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
