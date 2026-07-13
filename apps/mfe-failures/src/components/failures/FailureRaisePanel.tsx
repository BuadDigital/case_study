"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardBody, CardHeader, Button, cn, useToast } from "@platform/design-system";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import {
  activeFailureForProperty,
  failuresForProperty,
  historicalFailuresForProperty,
} from "../../lib/failure-property-match";
import { createFailure } from "../../lib/failures-repository";
import type { FailureSeverity } from "../../lib/failures-types";
import {
  failureOccurrenceSuffix,
  failureRecordTitle,
  failureSeverityLabel,
  failureStatusLabel,
  groupSimilarFailureRecords,
  isPanelBlockingFailure,
} from "../../lib/failures-labels";
import { formatDateAr } from "@case-study/mfe";
import { failureProblemTypeLabel } from "../../lib/failure-types-data";
import { useFailuresQuery } from "../../query/failures-queries";
import { FailureRaiseFields } from "./FailureRaiseFields";

const noteWarnClass = cn(
  "rounded-[var(--radius-DEFAULT)] border border-amber border-e-[3px] border-e-amber bg-amber-light px-3.5 py-2.5 text-xs leading-relaxed text-amber-text",
);

const noteOkClass = cn(
  "rounded-[var(--radius-DEFAULT)] border border-success/30 border-e-[3px] border-e-success bg-success-light px-3.5 py-2.5 text-xs leading-relaxed text-success-text",
);

const noteNeutralClass = cn(
  "rounded-[var(--radius-DEFAULT)] border border-border-md bg-surface-2 px-3.5 py-2.5 text-xs leading-relaxed text-text-2",
);

const noteInfoClass = cn(
  "rounded-[var(--radius-DEFAULT)] border border-primary/20 bg-primary-light px-3.5 py-2.5 text-xs leading-relaxed text-text-2",
);

export function FailureRaisePanel({
  poNumber,
  propertyId,
  deedNumber,
  specialist,
  raisedByRole,
  onSubmitted,
  autoOpenRaise = false,
  initialProblemTypeId = "",
}: {
  poNumber: string;
  propertyId: string;
  deedNumber: string;
  specialist: string;
  raisedByRole: string;
  onSubmitted?: () => void;
  /** Opens the raise form when the panel mounts (e.g. from quick actions). */
  autoOpenRaise?: boolean;
  /** Prefills problem type (e.g. key-wont-open). */
  initialProblemTypeId?: string;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data: failures = [] } = useFailuresQuery();
  const [open, setOpen] = useState(autoOpenRaise);
  const [severity, setSeverity] = useState<FailureSeverity>("internal");
  const [problemTypeId, setProblemTypeId] = useState(initialProblemTypeId);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialProblemTypeId) setProblemTypeId(initialProblemTypeId);
  }, [initialProblemTypeId]);

  const propertyRef = useMemo(
    () => ({ poNumber, propertyId, deedNumber }),
    [poNumber, propertyId, deedNumber],
  );

  const propertyFailures = useMemo(
    () => failuresForProperty(failures, propertyRef),
    [failures, propertyRef],
  );

  const blockingFailures = useMemo(
    () =>
      propertyFailures.filter((failure) => isPanelBlockingFailure(failure)),
    [propertyFailures],
  );

  const approvedFailure = useMemo(
    () =>
      propertyFailures.find((failure) => failure.status === "approved") ?? null,
    [propertyFailures],
  );

  const pastFailures = useMemo(
    () => historicalFailuresForProperty(failures, propertyRef),
    [failures, propertyRef],
  );

  const groupedPastFailures = useMemo(
    () => groupSimilarFailureRecords(pastFailures),
    [pastFailures],
  );

  const openFailureForCreate = useMemo(
    () => activeFailureForProperty(failures, propertyRef),
    [failures, propertyRef],
  );

  useEffect(() => {
    if (autoOpenRaise && !openFailureForCreate) {
      setOpen(true);
    }
  }, [autoOpenRaise, openFailureForCreate]);

  function formatFailureDate(iso: string): string {
    const day = iso.slice(0, 10);
    return day ? formatDateAr(day) : "—";
  }

  function handleSubmit() {
    if (!problemTypeId.trim() || openFailureForCreate || saving) return;
    void (async () => {
      setSaving(true);
      try {
        await createFailure({
          poNumber,
          propertyId,
          deedNumber,
          problemTypeId,
          title: failureProblemTypeLabel(problemTypeId),
          severity,
          raisedByRole,
          internalNote: note,
          specialist,
        });
        await queryClient.invalidateQueries({
          queryKey: prototypeKeys.failures(),
        });
        await queryClient.invalidateQueries({
          queryKey: prototypeKeys.propertyKeys(),
        });
        setOpen(false);
        setProblemTypeId("");
        setNote("");
        onSubmitted?.();
      } catch {
        showToast("تعذر حفظ التعذر — تحقق من الاتصال وحاول مرة أخرى.", "error");
      } finally {
        setSaving(false);
      }
    })();
  }

  function renderStatusSection() {
    if (blockingFailures.length > 0) {
      if (blockingFailures.length === 1) {
        const failure = blockingFailures[0];
        const title = failureRecordTitle(failure);
        return (
          <div className={noteWarnClass}>
            <strong>تعذر قائم على هذا العقار:</strong> {title}
            <div className="mt-1.5 text-xs text-text-2">
              {failureSeverityLabel(failure.severity)} ·{" "}
              {failureStatusLabel(failure.status)}
            </div>
          </div>
        );
      }

      return (
        <div className={noteWarnClass}>
          <strong>تعذرات قائمة على هذا العقار</strong>
          <ul className="mt-2 list-disc space-y-1 ps-4">
            {blockingFailures.slice(0, 4).map((failure) => (
              <li key={failure.id}>
                {failureRecordTitle(failure)}
                {" · "}
                {failureSeverityLabel(failure.severity)} ·{" "}
                {failureStatusLabel(failure.status)}
              </li>
            ))}
          </ul>
          {blockingFailures.length > 4 ? (
            <p className="mt-1.5 text-[10px] text-text-3">
              +{blockingFailures.length - 4} تعذرات أخرى
            </p>
          ) : null}
        </div>
      );
    }

    if (approvedFailure) {
      const title = failureRecordTitle(approvedFailure);
      return (
        <div className={noteInfoClass}>
          <strong>تعذر معتمد:</strong> {title}
          <div className="mt-1.5 text-xs text-text-3">
            يمكن متابعة العمل بعد اعتماد المشرف — لا يُعرض كتعذر نشط.
          </div>
        </div>
      );
    }

    if (groupedPastFailures.length > 0) {
      return (
        <div className={noteNeutralClass}>
          <strong>تعذرات سابقة على هذا العقار</strong>
          <ul className="mt-2 list-disc space-y-1 ps-4">
            {groupedPastFailures.slice(0, 4).map((row) => (
              <li key={row.id}>
                {row.title}
                {failureOccurrenceSuffix(row.count)}
                {" · "}
                {row.statusLabel}
                {" · آخر تحديث "}
                {formatFailureDate(row.latestUpdatedAt)}
              </li>
            ))}
          </ul>
          {groupedPastFailures.length > 4 ? (
            <p className="mt-1.5 text-[10px] text-text-3">
              +{groupedPastFailures.length - 4} تعذرات أخرى
            </p>
          ) : null}
        </div>
      );
    }

    return (
      <div className={noteOkClass}>
        <strong>صافي</strong> — لا توجد تعذرات على هذا العقار.
      </div>
    );
  }

  return (
    <FailureCard>
      {renderStatusSection()}

      {!open && !openFailureForCreate ? (
        <Button
          type="button"
          variant="dangerOutline"
          size="sm"
          className="mt-3"
          showActionToast={false}
          onClick={() => setOpen(true)}
        >
          تسجيل تعذر
        </Button>
      ) : null}

      {open ? (
        <div className="mt-3 border-t border-border pt-3">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[13px] font-semibold">رفع تعذر</span>
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
          </div>
          <FailureRaiseFields
            idPrefix={`raise-${propertyId}`}
            severity={severity}
            onSeverityChange={setSeverity}
            problemTypeId={problemTypeId}
            onProblemTypeIdChange={setProblemTypeId}
            note={note}
            onNoteChange={setNote}
          />
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={saving}
            disabled={!problemTypeId.trim() || saving}
            showActionToast={false}
            onClick={handleSubmit}
          >
            {severity === "internal" ? "حفظ تعذر داخلي" : "تسجيل احتمال تعذر"}
          </Button>
        </div>
      ) : null}
    </FailureCard>
  );
}

function FailureCard({ children }: { children: ReactNode }) {
  return (
    <Card className="mt-4 overflow-hidden shadow-none">
      <CardHeader>
        <span className="text-[13px] font-semibold text-text">التعذرات</span>
      </CardHeader>
      <CardBody>{children}</CardBody>
    </Card>
  );
}
