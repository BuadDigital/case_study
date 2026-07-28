"use client";

import { Button } from "@platform/design-system";

export function InspectorSubmitFooter({
  disabled,
  saving,
  locked,
  failureRaiseId = "inspector-failure-raise",
  onRegisterFailure,
  onSaveDraft,
  onSubmit,
}: {
  disabled?: boolean;
  saving?: boolean;
  locked?: boolean;
  failureRaiseId?: string;
  onRegisterFailure?: () => void;
  onSaveDraft?: () => void;
  onSubmit?: () => void;
}) {
  if (locked) return null;

  function scrollWithinNearestContainer(target: HTMLElement) {
    let scrollContainer: HTMLElement | null = target.parentElement;
    while (scrollContainer) {
      const { overflowY } = window.getComputedStyle(scrollContainer);
      if (overflowY === "auto" || overflowY === "scroll") break;
      scrollContainer = scrollContainer.parentElement;
    }

    if (!scrollContainer) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const targetRect = target.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    const top =
      scrollContainer.scrollTop + (targetRect.top - containerRect.top) - 16;

    scrollContainer.scrollTo({
      top: Math.max(0, top),
      behavior: "smooth",
    });
  }

  function openFailureRaise() {
    if (onRegisterFailure) {
      onRegisterFailure();
      return;
    }
    const target = document.getElementById(failureRaiseId);
    if (target instanceof HTMLElement) scrollWithinNearestContainer(target);
  }

  return (
    <div
      className="mt-4 rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-[0_-4px_16px_rgba(15,52,96,0.08)] max-lg:sticky max-lg:bottom-0 max-lg:z-20 max-lg:-mx-0 max-lg:mt-6 max-lg:rounded-none max-lg:border-x-0 max-lg:border-b-0 max-lg:bg-surface/95 max-lg:pb-[max(0.875rem,env(safe-area-inset-bottom))] max-lg:backdrop-blur-sm"
    >
      <p className="mb-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-text-3 max-lg:text-[12px]">
        <i className="ti ti-info-circle mt-0.5 shrink-0 text-sm" aria-hidden />
        يجب التقاط الموقع (GPS)، وإكمال صور العقار الموثّقة، وإرفاق صورة لكل
        ملاحظة، والتأشير على إقرار المعاينة قبل الإرسال.
      </p>
      <div className="flex flex-wrap items-center justify-end gap-2 max-lg:grid max-lg:grid-cols-2 max-lg:gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-orange text-orange hover:bg-orange-bg max-lg:min-h-11 max-lg:justify-center"
          disabled={disabled}
          showActionToast={false}
          onClick={openFailureRaise}
        >
          <i className="ti ti-alert-triangle" aria-hidden /> تسجيل تعذر
        </Button>
        {onSaveDraft ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="max-lg:min-h-11 max-lg:justify-center"
            loading={saving}
            disabled={disabled}
            showActionToast={false}
            actionLabel="حفظ مسودة المعاينة"
            onClick={() => void onSaveDraft()}
          >
            حفظ مسودة المعاينة
          </Button>
        ) : null}
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="max-lg:col-span-2 max-lg:min-h-12 max-lg:justify-center max-lg:text-[14px] max-lg:font-semibold"
          loading={saving}
          disabled={disabled}
          showActionToast={false}
          actionLabel="حفظ وإرسال المعاينة"
          onClick={() => void onSubmit?.()}
        >
          <i className="ti ti-send" aria-hidden /> حفظ وإرسال المعاينة
        </Button>
      </div>
    </div>
  );
}
