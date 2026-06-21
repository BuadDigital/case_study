"use client";

import { Button } from "@platform/design-system";

export function InspectorSubmitFooter({
  disabled,
  saving,
  locked,
  failureRaiseId = "inspector-failure-raise",
  onRegisterFailure,
  onSubmit,
}: {
  disabled?: boolean;
  saving?: boolean;
  locked?: boolean;
  failureRaiseId?: string;
  onRegisterFailure?: () => void;
  onSubmit?: () => void;
}) {
  if (locked) return null;

  function openFailureRaise() {
    if (onRegisterFailure) {
      onRegisterFailure();
      return;
    }
    document.getElementById(failureRaiseId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <div className="mt-4 rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-[0_-4px_16px_rgba(15,52,96,0.08)]">
      <p className="mb-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-text-3">
        <i className="ti ti-info-circle mt-0.5 shrink-0 text-sm" aria-hidden />
        يجب التقاط الموقع (GPS)، وإكمال صور العقار الموثّقة، وإرفاق صورة لكل
        ملاحظة، والتأشير على إقرار المعاينة قبل الإرسال.
      </p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-orange text-orange hover:bg-orange-bg"
          disabled={disabled}
          onClick={openFailureRaise}
        >
          <i className="ti ti-alert-triangle" aria-hidden /> تسجيل تعذر
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={disabled || saving}
          onClick={() => void onSubmit?.()}
        >
          <i className="ti ti-send" aria-hidden />{" "}
          {saving ? "جاري الإرسال…" : "حفظ وإرسال المعاينة"}
        </Button>
      </div>
    </div>
  );
}
