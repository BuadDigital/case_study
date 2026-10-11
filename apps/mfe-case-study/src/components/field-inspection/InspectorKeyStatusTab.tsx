"use client";

import { useCallback, useMemo, useState } from "react";
import {
  confirmKeyEnvelopeAssignment,
  confirmKeyEnvelopeHandoff,
  type PropertyKeyGateDto,
} from "@platform/api-client";
import { Button, Note, cn } from "@platform/ui-kit";
import { prototypeModulesApiConfig } from "@platform/app-shared/app-data/modules-api-config";
import { isBrowserOffline } from "@platform/app-shared/offline/offline-write";
import {
  FieldBox,
  FieldsGrid,
  SectionHeader,
} from "../po-intake/PropertyDetailFields";
import {
  keyHandedLabelAr,
  keysStatusLabelAr,
  usePropertyKeyGateQuery,
} from "../../query/use-property-key-gate-query";
import {
  inspectorKeyGateProblem,
  inspectorKeyGateStatus,
  type InspectorKeyGateStatus,
} from "../../lib/app-data/inspector-key-gate";
import type { WorkflowTask } from "../../lib/app-data/tasks";

export type InspectorKeyAvailability = {
  keyHandedToInspector: string;
  keysStatus: string;
  /** Ready to complete inspection from a key-status perspective; `null` while that is not known. */
  keyAvailable: boolean | null;
  /** Whether the answer is known — never read «unknown» as «no key». See inspector-key-gate.ts. */
  status: InspectorKeyGateStatus;
  /** Reads the gate again (after a failed load, or after an action here changed it). */
  retry: () => void;
  source?: string;
  envelopeId?: string | null;
  assignmentId?: string | null;
  assignmentStatus?: string | null;
  pendingHandoffId?: string | null;
  studyHoldStatus?: string;
};

function mapGate(
  gate: PropertyKeyGateDto,
): Omit<InspectorKeyAvailability, "status" | "retry"> {
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

/**
 * Key status derived from the key envelope only — the shared gate query, so the workflow's submit
 * and this tab read one answer, and an action here refreshes both.
 */
export function useInspectorKeyAvailability(
  task: WorkflowTask,
): InspectorKeyAvailability {
  const { data, isError, isPaused, refetch } = usePropertyKeyGateQuery({
    propertyId: task.propertyId,
    poNumber: task.poNumber,
    enabled: Boolean(task.propertyId),
  });
  const status = inspectorKeyGateStatus({
    data,
    isError,
    isPaused,
    offline: isBrowserOffline(),
  });
  const retry = useCallback(() => {
    void refetch();
  }, [refetch]);

  return useMemo(
    () => ({
      ...(data
        ? mapGate(data)
        : { keyHandedToInspector: "", keysStatus: "", keyAvailable: null }),
      status,
      retry,
    }),
    [data, status, retry],
  );
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
    assignmentStatus: status,
    pendingHandoffId,
    studyHoldStatus,
    retry,
  } = availability;
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handedLabel = keyHandedLabelAr(keyHandedToInspector);
  const keysLabel = keysStatusLabelAr(keysStatus);
  const keyNotOnHand = !vacantLand && keyAvailable === false;
  const loadProblem = inspectorKeyGateProblem(availability.status);

  const confirmAssignment = async (next: "matched" | "unmatched") => {
    const config = prototypeModulesApiConfig();
    if (!config || !envelopeId || !assignmentId) return;
    setBusy(true);
    setActionError(null);
    const result = await confirmKeyEnvelopeAssignment(config, envelopeId, assignmentId, {
      status: next,
    });
    setBusy(false);
    if (!result.ok) {
      setActionError("تعذّر تحديث حالة المطابقة");
      return;
    }
    retry();
  };

  const confirmHandoff = async () => {
    const config = prototypeModulesApiConfig();
    if (!config || !envelopeId || !pendingHandoffId) return;
    setBusy(true);
    setActionError(null);
    const result = await confirmKeyEnvelopeHandoff(config, envelopeId, pendingHandoffId);
    setBusy(false);
    if (!result.ok) {
      setActionError("تعذّر تأكيد استلام المناولة");
      return;
    }
    retry();
  };

  const showAssignmentActions =
    Boolean(envelopeId) &&
    Boolean(assignmentId) &&
    status !== "matched" &&
    status !== "unmatched";
  const showHandoffConfirm = Boolean(pendingHandoffId && envelopeId);

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

      {loadProblem ? (
        <Note tone="danger" className="mt-4">
          {loadProblem} لا تُرسَل المعاينة قبل معرفتها.
          {availability.status === "offline" ? null : (
            <div className="mt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                showActionToast={false}
                onClick={retry}
              >
                إعادة المحاولة
              </Button>
            </div>
          )}
        </Note>
      ) : null}

      {keyNotOnHand ? (
        <Note tone="info" className="mt-4">
          المفتاح غير متاح حالياً (ظرف المفاتيح / تمكين) — هذا لا يمنع إتمام
          المعاينة. إذا الدخول متعذّر بسبب المفتاح: سجّل تعذّراً مع ملاحظة.
          {onRegisterKeyFailure ? (
            <div className="mt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRegisterKeyFailure}
              >
                تسجيل تعذّر المفتاح
              </Button>
            </div>
          ) : null}
        </Note>
      ) : null}
    </div>
  );
}
