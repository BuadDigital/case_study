"use client";

/**
 * Chrome around the inspector form: the validation summary note with
 * jump-to-field links, the desktop entry-mode action bar, and the map-move
 * confirmation modal. Lifted out of `FieldInspectionWorkBody` — same
 * markup, state stays with the workflow hook.
 */
import { AppModal, Button, cn, Note } from "@platform/ui-kit";
import type { InspectorErrorLink } from "./field-inspection-work-state";

export function InspectorFormErrorNote({
  errorLinks,
  formError,
  mobile,
  scrollToErrorTarget,
}: {
  errorLinks: InspectorErrorLink[];
  formError: string;
  mobile: boolean;
  scrollToErrorTarget: (targetId: string) => void;
}) {
  return (
    <Note tone="warn" role="alert" className={cn("mb-4", mobile && "mx-4 mt-3")}>
      <div className="flex flex-col gap-2">
        <p className="m-0 font-semibold">{formError}</p>
        <p className="m-0 text-[11px] text-text-2">
          تم توجيهك لأول حقل ناقص — الحقول باللون الأحمر مطلوبة.
        </p>
        {errorLinks.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] text-text-2">
              أو اضغط على الخطأ للانتقال مباشرة:
            </span>
            <div className="flex flex-col gap-2">
              {errorLinks.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="flex w-full items-start justify-between gap-3 rounded-xl border border-[#F5C2C7] bg-white px-3 py-2 text-right text-[11px] text-danger-text transition-colors hover:bg-[#FFF5F5]"
                  onClick={() => scrollToErrorTarget(item.targetId)}
                >
                  <span className="min-w-0 flex-1 leading-5 break-words">
                    {item.message}
                  </span>
                  <span className="shrink-0 text-[10px] text-text-3">
                    فتح
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Note>
  );
}

/** Desktop-only «وضع الإدخال» bar: submit, register failure, save draft. */
export function InspectorDesktopActionBar({
  onRegisterFailure,
  onSaveDraft,
  onSubmit,
  submitting,
  workLocked,
}: {
  onRegisterFailure?: () => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
  submitting: boolean;
  workLocked: boolean;
}) {
  return (
    <div className="mt-3.5 flex flex-col gap-3 rounded-lg border border-[color-mix(in_srgb,var(--gold)_35%,transparent)] bg-[color-mix(in_srgb,var(--gold)_10%,transparent)] px-3.5 py-[11px] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2.5">
      <div className="text-xs leading-relaxed text-text-2">
        <strong className="text-gold-d">وضع الإدخال</strong> — تُدخل
        بيانات المعاينة الميدانية وتُرسل بعد اكتمالها.
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="primary"
          loading={submitting}
          disabled={submitting || workLocked}
          onClick={onSubmit}
        >
          حفظ وإرسال
        </Button>
        {onRegisterFailure ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={submitting || workLocked}
            onClick={onRegisterFailure}
          >
            تسجيل تعذر
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={submitting || workLocked}
          onClick={onSaveDraft}
        >
          حفظ مسودة
        </Button>
      </div>
    </div>
  );
}

export function InspectorMapMoveModal({
  onCancel,
  onConfirm,
  open,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
}) {
  return (
    <AppModal
      open={open}
      title="تأكيد تحريك الموقع"
      onClose={onCancel}
      footer={
        <>
          <Button type="button" onClick={onCancel}>
            إلغاء
          </Button>
          <Button
            type="button"
            variant="primary"
            showActionToast={false}
            onClick={onConfirm}
          >
            تثبيت الموقع الجديد
          </Button>
        </>
      }
    >
      <p className="m-0 text-[13px] leading-6 text-text-2">
        هل تريد اعتماد هذا الموقع بدل الموقع الحالي؟ يمكنك الرجوع للموقع السابق
        بعد التثبيت.
      </p>
    </AppModal>
  );
}
