"use client";

import { useRef, useState, type ReactNode } from "react";
import { Button, Label, cn } from "@platform/ui-kit";
import {
  clearCachedPropertyDoc,
  type PropertyDocKind,
} from "../../lib/prototype/assignment-doc-attachments";
import { AssignmentDocWithReportClassify } from "./AssignmentDocWithReportClassify";

const ACCEPT =
  "application/pdf,image/*,.pdf,.jpg,.jpeg,.png,.heic,.heif,.webp";

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
}) {
  const names = multiple
    ? (fileNames ?? []).map((n) => n.trim()).filter(Boolean)
    : fileName?.trim()
      ? [fileName.trim()]
      : [];
  const hasFiles = names.length > 0;
  const showPreview = Boolean(docKind && attachPo && propertyId);
  const atMax =
    typeof maxFiles === "number" && names.length >= maxFiles && multiple;
  const showPicker = !atMax;

  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClearAll = () => {
    if (docKind && attachPo && propertyId) {
      clearCachedPropertyDoc(docKind, attachPo, propertyId);
    }
    onClear();
  };

  function applyFiles(list: FileList | File[] | null | undefined) {
    const picked = Array.from(list ?? []).filter(isAcceptedFile);
    if (picked.length === 0) return;

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

  const pickerTitle = hasFiles && !multiple
    ? "استبدال الملف"
    : hasFiles && multiple
      ? "إضافة ملفات"
      : "ارفع المستند";

  return (
    <div className="mt-2 w-full">
      <Label className="mb-1.5 text-[11px]" htmlFor={id}>
        {label}
      </Label>

      {hasFiles ? (
        <ul className="mb-2 space-y-2">
          {names.map((name) => (
            <li
              key={name}
              className="flex items-start justify-between gap-2 rounded-[10px] border border-[#a9dfbf] bg-[#d5f5ef]/40 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                {showPreview ? (
                  <AssignmentDocWithReportClassify
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
              {multiple && onRemove ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto shrink-0 px-1.5 text-[11px] text-danger-text"
                  onClick={() => onRemove(name)}
                >
                  إزالة
                </Button>
              ) : null}
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
            dragOver
              ? "border-primary bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]"
              : error
                ? "border-danger bg-danger-bg/30"
                : "border-border-md bg-surface-2 hover:border-primary/50 hover:bg-[color-mix(in_srgb,var(--primary)_4%,transparent)]",
          )}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(true);
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
            applyFiles(e.dataTransfer.files);
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
            {dragOver ? "أفلِت الملف هنا" : pickerTitle}
          </div>
          <div className="mb-3 text-[11px] leading-relaxed text-text-3">
            PDF أو صورة · اسحب الملف وأفلِته هنا، أو اختر من الجهاز
          </div>
          <span className="inline-flex items-center justify-center rounded-lg bg-[var(--ink,#102B4E)] px-4 py-1.5 text-[11.5px] font-semibold text-white">
            اختيار ملف
          </span>
          <input
            ref={inputRef}
            id={id}
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
        </div>
      ) : null}

      {hasFiles ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1.5 h-auto px-0 text-[11px] text-primary"
          onClick={handleClearAll}
        >
          {multiple ? "مسح كل الملفات" : "مسح الملف"}
        </Button>
      ) : null}

      {error ? (
        <p className="mt-1.5 text-[10px] text-danger-text" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
