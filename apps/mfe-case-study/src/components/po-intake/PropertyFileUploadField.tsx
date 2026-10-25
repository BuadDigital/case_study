"use client";

import { useState, type ReactNode } from "react";
import {
  Button,
  Label,
  UploadFileIcon,
  cn,
  useFileDropZone,
  useFormDensity,
} from "@platform/ui-kit";
import { invalidControlClass } from "@platform/app-shared/form-ux";
import {
  clearCachedPropertyDoc,
  type PropertyDocKind,
} from "../../lib/app-data/assignment-doc-attachments";
import { AssignmentDocAttachment } from "./AssignmentDocAttachment";

// What the attachments service actually stores (it reads the bytes, not the extension):
// PDF and JPG/PNG/GIF/WebP images. HEIC is refused here instead of after a failed upload.
const ACCEPT = "application/pdf,image/jpeg,image/png,image/gif,image/webp,.pdf,.jpg,.jpeg,.png,.gif,.webp";
const UNSUPPORTED_FILE_MESSAGE = "الصيغة غير مدعومة — ارفع PDF أو صورة JPG / PNG / WebP (HEIC غير مقبول).";

function isAcceptedFile(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();
  if (/\.(heic|heif)$/.test(name) || type === "image/heic" || type === "image/heif") return false;
  if (type === "application/pdf" || type.startsWith("image/")) return true;
  return /\.(pdf|png|jpe?g|gif|webp)$/.test(name);
}

export function PropertyFileUploadField({
  id,
  label,
  fileName,
  fileNames,
  error,
  attachPo,
  propertyId,
  docKind,
  multiple,
  maxFiles,
  onUpload,
  onUploadMany,
  onClear,
  onRemove,
  onTooManyFiles,
  uploading,
}: {
  id: string;
  label: ReactNode;
  /** Single-file mode display name. */
  fileName?: string;
  /** Multi-file mode names. */
  fileNames?: string[];
  error?: string;
  attachPo?: string;
  propertyId?: string;
  docKind?: PropertyDocKind;
  multiple?: boolean;
  /** Cap how many files can be attached (e.g. 1 for decree / delegation). */
  maxFiles?: number;
  onUpload: (file: File) => void;
  onUploadMany?: (files: File[]) => void;
  onClear: () => void;
  /** Remove one file in multi mode. */
  onRemove?: (fileName: string) => void;
  /** Called when the user picks more files than `maxFiles` allows. */
  onTooManyFiles?: () => void;
  /** The file is on its way to the server; the picker waits and says so. */
  uploading?: boolean;
}) {
  const names = multiple
    ? (fileNames ?? []).map((n) => n.trim()).filter(Boolean)
    : fileName?.trim()
      ? [fileName.trim()]
      : [];
  const hasFiles = names.length > 0;
  const showPreview = Boolean(docKind && attachPo && propertyId);
  // Hide the dashed upload box once a document is on file; clear first to upload again.
  const atCapacity = multiple
    ? typeof maxFiles === "number" && names.length >= maxFiles
    : hasFiles;
  const showPicker = !atCapacity;

  // Compact forms (تعديل العقار) show uploads as small square tiles instead of full-width bars.
  const tile = useFormDensity() === "compact";
  const [unsupported, setUnsupported] = useState<string | null>(null);
  const shownError = error ?? unsupported ?? undefined;

  const handleClearAll = () => {
    if (docKind && attachPo && propertyId) {
      clearCachedPropertyDoc(docKind, attachPo, propertyId);
    }
    onClear();
  };

  function applyFiles(list: FileList | File[] | null | undefined) {
    const all = Array.from(list ?? []);
    const picked = all.filter(isAcceptedFile);
    if (picked.length === 0) {
      if (all.length > 0) setUnsupported(UNSUPPORTED_FILE_MESSAGE);
      return;
    }
    setUnsupported(null);

    if (
      typeof maxFiles === "number" &&
      (names.length >= maxFiles || names.length + picked.length > maxFiles)
    ) {
      // Single-file replace: still allow one new file.
      if (!multiple && picked[0]) {
        onUpload(picked[0]);
        return;
      }
      onTooManyFiles?.();
      return;
    }

    if (multiple) {
      if (onUploadMany) onUploadMany(picked);
      else picked.forEach((file) => onUpload(file));
    } else {
      onUpload(picked[0]!);
    }
  }

  // Only the full-width bar stops its click, key and drag events at the zone.
  const { dragOver, inputRef, openPicker, zoneProps } = useFileDropZone({
    onFiles: applyFiles,
    isolate: tile ? "none" : "all",
  });

  const pickerTitle = hasFiles && !multiple
    ? "استبدال"
    : hasFiles && multiple
      ? "إضافة ملفات"
      : "ارفع المستند";

  // Scroll/focus targets this visible root — not the sr-only file input (that hid the pulse).
  const fileInputId = `${id}-input`;

  if (tile) {
    return (
      <div
        id={id}
        className={cn("w-40 max-w-full", shownError && invalidControlClass)}
      >
        <Label className="mb-1 line-clamp-2 min-h-[2rem] text-[11px]" htmlFor={fileInputId}>
          {label}
        </Label>

        {hasFiles ? (
          names.map((name) => (
            <div
              key={name}
              className="mb-2 flex h-40 w-40 max-w-full flex-col items-center justify-between gap-1 overflow-hidden rounded-[10px] border border-border-md bg-surface-2 p-2 text-center"
            >
              <div className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden">
                {showPreview ? (
                  <div className="[&_.min-w-0>span:not(:first-child)]:hidden [&_.min-w-0>span]:line-clamp-2 [&_.min-w-0>span]:text-center">
                    <AssignmentDocAttachment
                      key={`${docKind}-${attachPo}-${propertyId}-${name}`}
                      poNumber={attachPo!}
                      propertyId={propertyId!}
                      fileName={name}
                      docKind={docKind}
                      variant="thumb"
                    />
                  </div>
                ) : (
                  <p className="m-0 line-clamp-3 break-all text-[11px] font-medium text-text">
                    📎 {name}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!multiple ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto px-1.5 text-[11px] text-primary"
                    onClick={openPicker}
                  >
                    استبدال
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="dangerOutline"
                  size="sm"
                  className="h-8 w-8 shrink-0 px-0"
                  aria-label={multiple ? "إزالة الملف" : "مسح الملف"}
                  title={multiple ? "إزالة الملف" : "مسح الملف"}
                  onClick={() => (multiple && onRemove ? onRemove(name) : handleClearAll())}
                >
                  <i className="ti ti-trash text-[16px]" aria-hidden />
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div
            role="button"
            tabIndex={0}
            aria-label={`${typeof label === "string" ? label : "مرفق"} — اختر ملفاً أو اسحبه هنا`}
            className={cn(
              "flex h-40 w-40 max-w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[10px] border-2 border-dashed p-2 text-center transition-[border-color,background]",
              uploading && "pointer-events-none opacity-60",
              dragOver
                ? "border-primary bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]"
                : shownError
                  ? "border-danger bg-danger-bg/30"
                  : "border-border-md bg-surface-2 hover:border-primary/50 hover:bg-[color-mix(in_srgb,var(--primary)_4%,transparent)]",
            )}
            {...zoneProps}
          >
            <UploadFileIcon size={22} className="text-primary" aria-hidden />
            <span className="text-[12px] font-bold text-heading">
              {uploading ? "جارٍ الرفع…" : dragOver ? "أفلِت الملف هنا" : "ارفع المستند"}
            </span>
            <span className="text-[10px] leading-snug text-text-3">
              PDF أو صورة
            </span>
          </div>
        )}

        <input
          ref={inputRef}
          id={fileInputId}
          type="file"
          accept={ACCEPT}
          multiple={multiple}
          className="sr-only"
          onChange={(e) => {
            applyFiles(e.target.files);
            e.target.value = "";
          }}
          onClick={(e) => e.stopPropagation()}
        />

        {shownError ? (
          <p className="mt-1 text-[10px] text-danger-text" role="alert">
            {shownError}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      id={id}
      className={cn("mt-2 w-full", shownError && invalidControlClass)}
    >
      <Label className="mb-1.5 text-[11px]" htmlFor={fileInputId}>
        {label}
      </Label>

      {hasFiles ? (
        <ul className="mb-2 space-y-2">
          {names.map((name) => (
            <li
              key={name}
              className="flex items-start justify-between gap-2 rounded-[10px] border border-border-md bg-surface-2 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                {showPreview ? (
                  <AssignmentDocAttachment
                    key={`${docKind}-${attachPo}-${propertyId}-${name}`}
                    poNumber={attachPo!}
                    propertyId={propertyId!}
                    fileName={name}
                    docKind={docKind}
                    variant="inline"
                  />
                ) : (
                  <p className="m-0 text-[12px] font-medium text-text">
                    📎 {name}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="dangerOutline"
                size="sm"
                className="h-8 w-8 shrink-0 self-center px-0"
                aria-label="مسح الملف"
                title="مسح الملف"
                onClick={() =>
                  multiple && onRemove ? onRemove(name) : handleClearAll()
                }
              >
                <i className="ti ti-trash text-[18px]" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {showPicker ? (
        <div
          role="button"
          tabIndex={0}
          aria-label={`${typeof label === "string" ? label : "مرفق"} — اختر ملفاً أو اسحبه هنا`}
          className={cn(
            "rounded-[10px] border-2 border-dashed p-4 text-center transition-[border-color,background]",
            "cursor-pointer",
            uploading && "pointer-events-none opacity-60",
            dragOver
              ? "border-primary bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]"
              : shownError
                ? "border-danger bg-danger-bg/30"
                : "border-border-md bg-surface-2 hover:border-primary/50 hover:bg-[color-mix(in_srgb,var(--primary)_4%,transparent)]",
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
            {uploading ? "جارٍ الرفع…" : dragOver ? "أفلِت الملف هنا" : pickerTitle}
          </div>
          <div className="mb-3 text-[11px] leading-relaxed text-text-3">
            PDF أو صورة · اسحب الملف وأفلِته هنا، أو اختر من الجهاز
          </div>
          <span className="inline-flex items-center justify-center rounded-lg bg-[var(--ink,#102B4E)] px-4 py-1.5 text-[11.5px] font-semibold text-white">
            اختيار ملف
          </span>
        </div>
      ) : null}

      <input
        ref={inputRef}
        id={fileInputId}
        type="file"
        accept={ACCEPT}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          applyFiles(e.target.files);
          e.target.value = "";
        }}
        onClick={(e) => e.stopPropagation()}
      />

      {shownError ? (
        <p className="mt-1.5 text-[10px] text-danger-text" role="alert">
          {shownError}
        </p>
      ) : null}
    </div>
  );
}
