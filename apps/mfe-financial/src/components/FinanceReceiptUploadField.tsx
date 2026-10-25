"use client";

import {
  PDF_OR_IMAGE_ACCEPT,
  cn,
  isPdfOrImageFile,
  useFileDropZone,
} from "@platform/ui-kit";

/** Upload transfer receipt — replacement for the original «Choose File» */
export function FinanceReceiptUploadField({
  label = "إيصال التحويل",
  required,
  disabled,
  busy,
  fileName,
  onPick,
  onPreview,
}: {
  label?: string;
  required?: boolean;
  disabled?: boolean;
  busy?: boolean;
  fileName?: string | null;
  onPick: (file: File) => void;
  onPreview?: () => void;
}) {
  const blocked = Boolean(disabled || busy);

  function pickFromList(files: FileList | File[] | null | undefined) {
    if (blocked) return;
    const file = files?.[0];
    if (!file || !isPdfOrImageFile(file)) return;
    onPick(file);
  }

  const { dragOver, inputRef, openPicker, zoneProps } = useFileDropZone({
    onFiles: pickFromList,
    disabled: blocked,
    isolate: "drag",
  });

  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[12px] font-semibold text-text-2">
        {label}
        {required ? <span className="text-[#c0553d]"> *</span> : null}
      </div>

      {fileName ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-border bg-surface-2 px-3.5 py-2.5">
          <div className="min-w-0">
            <div className="text-[11px] text-text-3">المرفق الحالي</div>
            <div
              className="truncate text-[12.5px] font-bold text-heading"
              dir="ltr"
              title={fileName}
            >
              {fileName}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {onPreview ? (
              <button
                type="button"
                className="cursor-pointer rounded-lg border border-border bg-surface px-3 py-1.5 text-[11.5px] font-bold text-heading hover:bg-[#faf6ee]"
                onClick={onPreview}
              >
                معاينة
              </button>
            ) : null}
            <button
              type="button"
              disabled={blocked}
              className="cursor-pointer rounded-lg border border-border bg-surface px-3 py-1.5 text-[11.5px] font-semibold text-text-2 hover:bg-[#faf6ee] disabled:opacity-60"
              onClick={openPicker}
            >
              استبدال
            </button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={blocked ? -1 : 0}
          aria-disabled={blocked || undefined}
          aria-busy={busy || undefined}
          aria-label={`${label} — اختر ملفاً أو اسحبه هنا`}
          className={cn(
            "rounded-[10px] border-2 border-dashed px-4 py-4 text-center transition-[border-color,background,opacity]",
            blocked ? "cursor-not-allowed opacity-65" : "cursor-pointer",
            dragOver && !blocked
              ? "border-heading bg-[color-mix(in_srgb,var(--heading)_8%,transparent)]"
              : "border-[#ddd8cc] bg-surface-2 hover:border-[#a4906f] hover:bg-surface-2",
          )}
          {...zoneProps}
        >
          <div className="text-[12.5px] font-bold text-heading">
            {busy
              ? "جاري الرفع…"
              : dragOver
                ? "أفلِت الملف هنا"
                : "ارفع إيصال التحويل"}
          </div>
          <div className="mt-1 text-[11px] text-text-3">
            PDF أو صورة · اسحب وأفلِت أو اختر من الجهاز
          </div>
          <span className="mt-2.5 inline-flex rounded-lg bg-[color-mix(in_srgb,var(--heading)_18%,var(--ink))] px-3.5 py-1.5 text-[11.5px] font-semibold text-on-ink">
            {busy ? "جاري الرفع…" : "اختيار ملف"}
          </span>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={PDF_OR_IMAGE_ACCEPT}
        className="sr-only"
        disabled={blocked}
        onChange={(e) => {
          pickFromList(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
