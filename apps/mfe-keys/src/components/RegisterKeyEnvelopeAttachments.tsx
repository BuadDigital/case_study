"use client";

/**
 * Attachment sections of the register-envelope form: the envelope photo
 * dropzone (camera capture or drag-and-drop) and the plain file button used
 * for the receipt letter and the third-party letter.
 */
import type { DragEvent, RefObject } from "react";
import { Spinner, cn } from "@platform/ui-kit";
import type { FilePick, SourceKind } from "./register-key-envelope-state";
import { Fld, FldLabel } from "./RegisterKeyEnvelopeSections";

function CameraIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <circle cx="12" cy="13" r="3.2" />
      <path d="M8 6l1.5-2h5L16 6" />
    </svg>
  );
}

export function EnvelopePhotoField({
  source,
  photo,
  uploading,
  dragOver,
  inputRef,
  onFile,
  onDragOverChange,
  onRemove,
}: {
  source: SourceKind;
  photo: FilePick | null;
  uploading: boolean;
  dragOver: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onFile: (file: File | undefined) => void;
  onDragOverChange: (over: boolean) => void;
  onRemove: () => void;
}) {
  const photoPicked = Boolean(photo);
  return (
    <Fld full>
      <FldLabel>
        صورة الظرف — اضغط الخانة للالتقاط بالكاميرا أو اسحب الملف إليها
      </FldLabel>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <div
        role="button"
        tabIndex={0}
        className={cn(
          "cursor-pointer rounded-[12px] border-[1.5px] border-dashed px-3 py-3.5 text-center transition-[border-color,background] duration-150",
          photoPicked
            ? "border-[#3f8f5f] bg-[color-mix(in_srgb,#3f8f5f_7%,transparent)]"
            : dragOver
              ? "border-[var(--gold)] bg-[var(--gold-soft)]"
              : "border-border-md",
        )}
        onClick={() => {
          if (uploading) return;
          inputRef.current?.click();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e: DragEvent<HTMLDivElement>) => {
          e.preventDefault();
          onDragOverChange(true);
        }}
        onDragLeave={() => onDragOverChange(false)}
        onDrop={(e: DragEvent<HTMLDivElement>) => {
          e.preventDefault();
          onDragOverChange(false);
          onFile(e.dataTransfer.files?.[0]);
        }}
      >
        {photoPicked && photo ? (
          <div>
            <div className="flex items-center justify-center gap-2 text-[#2f7a4d]">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              <span className="text-[12.5px] font-bold text-heading">
                صورة الظرف
              </span>
            </div>
            <div
              className="mt-[5px] truncate text-[11px] text-text-2"
              dir="ltr"
            >
              {uploading ? "جاري الرفع…" : photo.file.name}
            </div>
            <div className="mt-2 flex justify-center gap-3">
              <button
                type="button"
                className="cursor-pointer border-none bg-transparent text-[11px] font-bold text-[var(--gold-d)]"
                onClick={(e) => {
                  e.stopPropagation();
                  inputRef.current?.click();
                }}
              >
                استبدال
              </button>
              <button
                type="button"
                className="cursor-pointer border-none bg-transparent text-[11px] font-bold text-[#d9694f]"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
              >
                حذف
              </button>
            </div>
          </div>
        ) : (
          <div className="grid place-items-center gap-1.5 text-text-3">
            <CameraIcon />
            <span className="text-[12.5px] font-bold text-heading">
              صورة الظرف {source === "court" ? "*" : ""}
            </span>
            <span className="text-[11px]">التقط الظرف وعليه رقم الطلب</span>
          </div>
        )}
      </div>
    </Fld>
  );
}

/** Receipt letter / third-party letter — one hidden input and a labelled button. */
export function AttachmentFileField({
  id,
  label,
  placeholder,
  inputRef,
  pick,
  uploading,
  onFile,
}: {
  id: string;
  label: string;
  placeholder: string;
  inputRef: RefObject<HTMLInputElement | null>;
  pick: FilePick | null;
  uploading: boolean;
  onFile: (file: File | undefined) => void;
}) {
  return (
    <Fld full>
      <FldLabel htmlFor={id}>{label}</FldLabel>
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/*,.pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        className={cn(
          "flex w-full items-center justify-between rounded-[10px] border border-border-md bg-surface-2 px-3 py-2.5 text-start text-[12.5px]",
          pick?.attachmentId && "border-[#3f8f5f]",
        )}
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        aria-busy={uploading || undefined}
      >
        <span className="inline-flex items-center gap-1.5 font-semibold text-heading">
          {uploading ? <Spinner /> : null}
          {uploading ? "جاري الرفع…" : (pick?.file.name ?? placeholder)}
        </span>
        <span className="text-[11px] text-text-3">
          {pick?.attachmentId ? "مرفوع" : "PDF / صورة"}
        </span>
      </button>
    </Fld>
  );
}
