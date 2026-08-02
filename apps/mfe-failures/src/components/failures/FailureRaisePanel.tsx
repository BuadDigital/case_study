"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, cn, useToast } from "@platform/design-system";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import {
  activeFailureForProperty,
  failuresForProperty,
  historicalFailuresForProperty,
} from "../../lib/failure-property-match";
import { createFailure } from "../../lib/failures-repository";
import {
  failureOccurrenceSuffix,
  failureRecordTitle,
  failureSeverityLabel,
  failureStatusLabel,
  groupSimilarFailureRecords,
  isPanelBlockingFailure,
} from "../../lib/failures-labels";
import { formatDateAr } from "@case-study/mfe";
import { useFailuresQuery } from "../../query/failures-queries";
import {
  FailureRaiseFields,
  failurePayloadFromDescription,
} from "./FailureRaiseFields";

const noteWarnClass = cn(
  "rounded-lg border border-amber border-e-[3px] border-e-amber bg-amber-light px-3.5 py-2.5 text-xs leading-relaxed text-amber-text",
);

const noteNeutralClass = cn(
  "rounded-lg border border-border-md bg-surface-2 px-3.5 py-2.5 text-xs leading-relaxed text-text-2",
);

const noteInfoClass = cn(
  "rounded-lg border border-primary/20 bg-primary-light px-3.5 py-2.5 text-xs leading-relaxed text-text-2",
);

const sectionClassName =
  "mb-2.5 mt-0 border-b border-border pb-[7px] text-[13px] font-bold text-heading";

/**
 * System-wide failure raise surface — Case Study.html template:
 * تسجيل تعذر (وصف) + رفع التعذر + سجل.
 */
export function FailureRaisePanel({
  poNumber,
  propertyId,
  deedNumber,
  specialist,
  raisedByRole,
  onSubmitted,
  autoOpenRaise = false,
  initialProblemTypeId = "",
  raiseDisabled = false,
  raiseDisabledReason,
}: {
  poNumber: string;
  propertyId: string;
  deedNumber: string;
  specialist: string;
  raisedByRole: string;
  onSubmitted?: () => void;
  autoOpenRaise?: boolean;
  /** Kept for call-site compatibility — HTML template is free-text only. */
  initialProblemTypeId?: string;
  /** Hide the raise form (view / locked) but keep السجل. */
  raiseDisabled?: boolean;
  raiseDisabledReason?: string;
}) {
  void initialProblemTypeId;
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data: failures = [] } = useFailuresQuery();
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [invalid, setInvalid] = useState(false);

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
    if (autoOpenRaise) setInvalid(false);
  }, [autoOpenRaise]);

  function formatFailureDate(iso: string): string {
    const day = iso.slice(0, 10);
    return day ? formatDateAr(day) : "—";
  }

  async function handleSubmit() {
    const trimmed = description.trim();
    if (!trimmed) {
      setInvalid(true);
      return;
    }
    if (openFailureForCreate || saving) return;

    setSaving(true);
    setInvalid(false);
    try {
      const payload = failurePayloadFromDescription(trimmed);
      await createFailure({
        poNumber,
        propertyId,
        deedNumber,
        ...payload,
        raisedByRole,
        specialist,
      });
      await queryClient.invalidateQueries({
        queryKey: prototypeKeys.failures(),
      });
      await queryClient.invalidateQueries({
        queryKey: prototypeKeys.propertyKeys(),
      });
      setDescription("");
      showToast("تم رفع التعذر — سيظهر لأخصائي دراسة الحالة.", "success");
      onSubmitted?.();
    } catch {
      showToast("تعذر حفظ التعذر — تحقق من الاتصال وحاول مرة أخرى.", "error");
    } finally {
      setSaving(false);
    }
  }

  function renderStatusSection() {
    if (blockingFailures.length > 0) {
      if (blockingFailures.length === 1) {
        const failure = blockingFailures[0]!;
        return (
          <div className={cn(noteWarnClass, "mb-3")}>
            <strong>تعذر قائم على هذا العقار:</strong>{" "}
            {failureRecordTitle(failure)}
            <div className="mt-1.5 text-xs text-text-2">
              {failureSeverityLabel(failure.severity)} ·{" "}
              {failureStatusLabel(failure.status)}
            </div>
          </div>
        );
      }
      return (
        <div className={cn(noteWarnClass, "mb-3")}>
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
        </div>
      );
    }

    if (approvedFailure) {
      return (
        <div className={cn(noteInfoClass, "mb-3")}>
          <strong>تعذر معتمد:</strong> {failureRecordTitle(approvedFailure)}
        </div>
      );
    }

    if (groupedPastFailures.length > 0) {
      return (
        <div className={cn(noteNeutralClass, "mb-3")}>
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
        </div>
      );
    }

    return null;
  }

  return (
    <div className="min-w-0">
      <div className={sectionClassName}>تسجيل تعذر</div>
      {raiseDisabled ? (
        <p className="mb-3 max-w-[560px] rounded-lg border border-[#fad7a0] bg-[#fef3d7] px-3 py-2.5 text-[11.5px] leading-[1.7] text-[#7a5b12]">
          {raiseDisabledReason ??
            "لا يمكن تسجيل تعذر في الوضع الحالي."}
        </p>
      ) : (
        <>
          {renderStatusSection()}

          {openFailureForCreate ? (
            <p className="m-0 max-w-[560px] text-[12px] leading-relaxed text-text-3">
              يوجد تعذر قائم على هذا العقار — أكمل معالجته قبل رفع تعذر جديد.
            </p>
          ) : (
            <div className="grid max-w-[560px] gap-2.5">
              <FailureRaiseFields
                idPrefix={`raise-${propertyId}`}
                description={description}
                onDescriptionChange={(v) => {
                  setDescription(v);
                  if (invalid) setInvalid(false);
                }}
                invalid={invalid}
                autoFocus={autoOpenRaise}
              />
              <div>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  loading={saving}
                  disabled={saving}
                  showActionToast={false}
                  className="!px-[18px] !py-[7px] !text-xs"
                  onClick={() => void handleSubmit()}
                >
                  رفع التعذر
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <div className={cn(sectionClassName, "mt-[18px]")}>سجل التعذرات</div>
      <FailureHistoryList failures={propertyFailures} />
    </div>
  );
}

function FailureHistoryList({
  failures,
}: {
  failures: ReturnType<typeof failuresForProperty>;
}) {
  if (failures.length === 0) {
    return (
      <p className="m-0 text-xs leading-relaxed text-text-3">
        لا توجد تعذرات مسجلة على هذا العقار.
      </p>
    );
  }

  const sorted = [...failures].sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return (
    <div className="grid gap-2">
      {sorted.map((failure) => {
        const text =
          failure.internalNote?.trim() || failureRecordTitle(failure);
        const open =
          failure.status === "internal" ||
          failure.status === "review" ||
          failure.status === "suspended";
        return (
          <div
            key={failure.id}
            className="flex items-start justify-between gap-2.5 rounded-lg border border-border bg-surface-2 px-3 py-2.5"
          >
            <span className="min-w-0 flex-1 text-xs leading-relaxed text-text">
              {text}
            </span>
            <span
              className={cn(
                "inline-flex shrink-0 rounded-md px-2 py-0.5 text-[10.5px] font-bold",
                open
                  ? "bg-[color-mix(in_srgb,#d9694f_12%,transparent)] text-[#d9694f]"
                  : "bg-[color-mix(in_srgb,#3f8f5f_12%,transparent)] text-[#3f8f5f]",
              )}
            >
              {open ? "مفتوح" : failureStatusLabel(failure.status)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
