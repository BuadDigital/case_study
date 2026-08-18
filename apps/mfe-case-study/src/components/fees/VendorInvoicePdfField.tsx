"use client";

import { useRef, useState } from "react";
import { cn } from "@platform/ui-kit";

function isAcceptedFile(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  if (type === "application/pdf" || type.startsWith("image/")) return true;
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".pdf") ||
    name.endsWith(".png") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".webp") ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  );
}

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
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const blocked = Boolean(disabled || busy);
  const selectedName = file?.name?.trim() || "";

  function pickFromList(files: FileList | File[] | null | undefined) {
    if (blocked) return;
    const next = files?.[0];
    if (!next || !isAcceptedFile(next)) return;
    onPick(next);
  }

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
        onClick={() => {
          if (blocked) return;
          inputRef.current?.click();
        }}
        onKeyDown={(e) => {
          if (blocked) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!blocked) setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!blocked) setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          pickFromList(e.dataTransfer.files);
        }}
      >
        <div
          className="mx-auto mb-2.5 grid h-10 w-10 place-items-center rounded-full bg-[color-mix(in_srgb,var(--primary)_10%,transparent)] text-primary"
          aria-hidden
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M12 18v-6" />
            <path d="M9 15l3-3 3 3" />
          </svg>
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
          {busy ? "جاري الإرسال…" : selectedName ? "تغيير الملف" : "اختيار ملف"}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/*,.pdf,.png,.jpg,.jpeg,.webp,.heic,.heif"
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
