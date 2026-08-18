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

/** رفع إيصال التحويل — بديل لـ «Choose File» الأصلي */
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
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const blocked = Boolean(disabled || busy);

  function pickFromList(files: FileList | File[] | null | undefined) {
    if (blocked) return;
    const file = files?.[0];
    if (!file || !isAcceptedFile(file)) return;
    onPick(file);
  }

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
              onClick={() => {
                if (blocked) return;
                inputRef.current?.click();
              }}
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
              ? "border-[#102B4E] bg-[color-mix(in_srgb,#102B4E_6%,transparent)]"
              : "border-[#ddd8cc] bg-surface-2 hover:border-[#a4906f] hover:bg-[#faf8f3]",
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
          <span className="mt-2.5 inline-flex rounded-lg bg-[#102B4E] px-3.5 py-1.5 text-[11.5px] font-semibold text-white">
            {busy ? "جاري الرفع…" : "اختيار ملف"}
          </span>
        </div>
      )}

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
      />
    </div>
  );
}
