"use client";

import {
  PDF_OR_IMAGE_ACCEPT,
  UploadFileIcon,
  cn,
  isPdfOrImageFile,
  useFileDropZone,
} from "@platform/ui-kit";

/**
 * Invoice file picker — selects a file only; parent submits with a separate button.
 */
export function VendorInvoicePdfField({
  disabled,
  busy,
  file,
  onPick,
  onClear,
}: {
  disabled?: boolean;
  busy?: boolean;
  /** Currently selected file (not yet uploaded). */
  file?: File | null;
  onPick: (file: File) => void;
  onClear?: () => void;
}) {
  const blocked = Boolean(disabled || busy);
  const selectedName = file?.name?.trim() || "";

  function pickFromList(files: FileList | File[] | null | undefined) {
    if (blocked) return;
    const next = files?.[0];
    if (!next || !isPdfOrImageFile(next)) return;
    onPick(next);
  }

  const { dragOver, inputRef, zoneProps } = useFileDropZone({
    onFiles: pickFromList,
    disabled: blocked,
    isolate: "drag",
  });

  return (
    <div>
      <div className="mb-1.5 text-[12px] font-medium text-text-2">
        PDF الفاتورة <span className="text-danger">*</span>
      </div>
      <div
        role="button"
        tabIndex={blocked ? -1 : 0}
        aria-disabled={blocked || undefined}
        aria-busy={busy || undefined}
        aria-label="اختيار ملف الفاتورة — اختر ملفاً أو اسحبه هنا"
        className={cn(
          "rounded-[10px] border-2 border-dashed p-4 text-center transition-[border-color,background,opacity]",
          blocked ? "cursor-not-allowed opacity-65" : "cursor-pointer",
          selectedName && !dragOver
            ? "border-primary/40 bg-[color-mix(in_srgb,var(--primary)_6%,transparent)]"
            : null,
          dragOver && !blocked
            ? "border-primary bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]"
            : !selectedName
              ? "border-border-md bg-surface-2 hover:border-primary/50 hover:bg-[color-mix(in_srgb,var(--primary)_4%,transparent)]"
              : null,
        )}
        {...zoneProps}
      >
        <div
          className="mx-auto mb-2.5 grid h-10 w-10 place-items-center rounded-full bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-primary"
          aria-hidden
        >
          <UploadFileIcon />
        </div>
        <div className="mb-1 text-[12.5px] font-bold text-heading">
          {busy
            ? "جاري إرسال الفاتورة…"
            : dragOver
              ? "أفلِت الملف هنا"
              : selectedName
                ? "تم اختيار الملف"
                : "اختر ملف الفاتورة"}
        </div>
        <div className="mb-3 text-[11px] leading-relaxed text-text-3">
          {busy
            ? "يرجى الانتظار حتى يكتمل الإرسال"
            : selectedName
              ? selectedName
              : "PDF أو صورة · اسحب الملف وأفلِته هنا، أو اختر من الجهاز — ثم اضغط «إرسال الفاتورة»"}
        </div>
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-lg px-4 py-1.5 text-[11.5px] font-semibold",
            "bg-[var(--ink,#102B4E)] text-white",
            blocked && "opacity-80",
          )}
        >
          {busy ? "جاري الإرسال…" : selectedName ? "استبدال" : "اختيار ملف"}
        </span>
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
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      {selectedName && onClear && !busy ? (
        <button
          type="button"
          className="mt-2 cursor-pointer border-none bg-transparent p-0 text-[11.5px] font-semibold text-text-3 underline underline-offset-2 hover:text-danger"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClear();
          }}
        >
          إزالة الملف
        </button>
      ) : null}
    </div>
  );
}
