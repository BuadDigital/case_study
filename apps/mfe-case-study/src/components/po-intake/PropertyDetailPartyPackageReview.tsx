"use client";

import { useCallback, useState } from "react";
import {
  Button,
  Label,
  cn,
  formControlClassName,
  useToast,
} from "@platform/ui-kit";
import { useIdempotentAction } from "@platform/app-shared";
import {
  acceptPartySubmission,
  reopenPartySubmission,
} from "@platform/app-shared/app-data/party-submission-api";
import { formatDateAr } from "../../lib/app-data/po-intake-data";

function formatAcceptedDate(iso: string): string {
  const day = iso.trim().slice(0, 10);
  return day ? formatDateAr(day) : iso.trim();
}

/**
 * Specialist accept / return bar for a party package on property detail tabs.
 * Accept stamps server AcceptedAtUtc; return requires a reason and clears acceptance.
 */
export function PropertyDetailPartyPackageReview({
  taskId,
  submissionStatus,
  acceptedAtUtc,
  acceptedByName,
  acceptLabel = "اعتماد البيانات",
  acceptedLabel = "معتمد",
  returnLabel = "إعادة للتصحيح",
  returnAfterAcceptLabel = "إلغاء الاعتماد وإعادة للتصحيح",
  returnPlaceholder = "صف ما يجب تصحيحه…",
  acceptSuccessToast = "تم اعتماد البيانات — تظهر في حزمة إنفاذ",
  returnSuccessToast = "أُعيدت الحزمة للتصحيح",
  hint,
  disabled,
  onChanged,
}: {
  taskId: string | null | undefined;
  submissionStatus: string | null | undefined;
  acceptedAtUtc?: string | null;
  acceptedByName?: string | null;
  acceptLabel?: string;
  acceptedLabel?: string;
  returnLabel?: string;
  returnAfterAcceptLabel?: string;
  returnPlaceholder?: string;
  acceptSuccessToast?: string;
  returnSuccessToast?: string;
  /** Optional note under the actions (e.g. survey fee accrual). */
  hint?: string;
  disabled?: boolean;
  onChanged?: () => void;
}) {
  const { showToast } = useToast();
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnNote, setReturnNote] = useState("");
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returnBusy, setReturnBusy] = useState(false);

  const { execute: executeAccept, loading: acceptBusy } = useIdempotentAction(
    useCallback(
      async (idempotencyKey: string) => acceptPartySubmission(taskId!, idempotencyKey),
      [taskId],
    ),
  );

  const busy = acceptBusy || returnBusy;

  const status = (submissionStatus ?? "").trim().toLowerCase();
  const canReview = Boolean(taskId) && status === "submitted" && !disabled;
  const accepted =
    typeof acceptedAtUtc === "string" && acceptedAtUtc.trim().length > 0;
  const canAccept = canReview && !accepted;
  const canReturn = canReview && !accepted;

  if (!canReview && !accepted) {
    if (status === "reopened") return null;
    return null;
  }

  async function handleAccept() {
    if (!taskId || busy) return;
    try {
      const outcome = await executeAccept();
      if (outcome.status === "skipped") return;
      const result = outcome.value;
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      showToast(acceptSuccessToast, "success");
      onChanged?.();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "تعذّر قبول مخرجات المهمة",
        "error",
      );
    }
  }

  async function handleReturn() {
    if (!taskId || busy) return;
    const trimmed = returnNote.trim();
    if (!trimmed) {
      setReturnError("يجب إدخال سبب الإرجاع للتصحيح");
      return;
    }
    setReturnBusy(true);
    setReturnError(null);
    try {
      const result = await reopenPartySubmission(taskId, trimmed);
      if (!result.ok) {
        setReturnError(result.error);
        return;
      }
      setReturnOpen(false);
      setReturnNote("");
      showToast(returnSuccessToast, "success");
      onChanged?.();
    } finally {
      setReturnBusy(false);
    }
  }

  return (
    <div className="mb-3.5">
      {!returnOpen && canReview ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {accepted ? (
            <div className="me-auto rounded-lg border border-[color-mix(in_srgb,var(--success)_35%,var(--border))] bg-[var(--success-bg)] px-3 py-1.5 text-[11.5px] font-semibold text-[var(--success)] max-lg:w-full">
              {acceptedLabel}
              {acceptedByName?.trim() ? ` — ${acceptedByName.trim()}` : ""}
              {acceptedAtUtc ? ` · ${formatAcceptedDate(acceptedAtUtc)}` : ""}
            </div>
          ) : null}
          {canAccept ? (
            <Button
              type="button"
              size="sm"
              variant="primary"
              loading={busy}
              showActionToast={false}
              className="max-lg:min-h-11 max-lg:flex-1"
              onClick={() => void handleAccept()}
            >
              {acceptLabel}
            </Button>
          ) : null}
          {canReturn ? (
            <button
              type="button"
              className="rounded-lg border border-border-md bg-surface px-3.5 py-1.5 text-[11.5px] font-bold text-text-2 max-lg:min-h-11 max-lg:flex-1 max-lg:rounded-[12px] max-lg:text-[13px]"
              disabled={busy}
              onClick={() => {
                setReturnOpen(true);
                setReturnError(null);
              }}
            >
              {returnLabel}
            </button>
          ) : null}
          {accepted ? (
            <button
              type="button"
              className="rounded-lg border border-border-md bg-surface px-3.5 py-1.5 text-[11.5px] font-bold text-text-2 max-lg:min-h-11 max-lg:w-full max-lg:rounded-[12px] max-lg:text-[13px]"
              disabled={busy}
              onClick={() => {
                setReturnOpen(true);
                setReturnError(null);
              }}
            >
              {returnAfterAcceptLabel}
            </button>
          ) : null}
        </div>
      ) : null}

      {returnOpen ? (
        <div className="rounded-lg border border-border bg-surface px-3.5 py-3">
          <Label htmlFor={`party-return-note-${taskId}`} className="text-xs">
            سبب الإرجاع للتصحيح <span className="text-danger-text">*</span>
          </Label>
          <textarea
            id={`party-return-note-${taskId}`}
            className={cn(formControlClassName, "mt-1 min-h-[72px] text-xs")}
            value={returnNote}
            onChange={(e) => setReturnNote(e.target.value)}
            placeholder={returnPlaceholder}
          />
          {returnError ? (
            <p className="mt-1 mb-0 text-xs text-danger-text">{returnError}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="primary"
              loading={busy}
              showActionToast={false}
              onClick={() => void handleReturn()}
            >
              تأكيد الإرجاع
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setReturnOpen(false);
                setReturnError(null);
                setReturnNote("");
              }}
            >
              إلغاء
            </Button>
          </div>
        </div>
      ) : null}

      {hint && canReview && !accepted ? (
        <p className="mt-2 mb-0 text-[11px] leading-relaxed text-text-3">{hint}</p>
      ) : null}
    </div>
  );
}
