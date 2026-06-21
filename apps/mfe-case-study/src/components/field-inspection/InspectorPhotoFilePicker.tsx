"use client";

import { useRef } from "react";
import { cn } from "@platform/design-system";

const UPLOAD_BTN =
  "inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border-md bg-surface px-2.5 py-2 text-[11px] text-text-2 hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60";

export function InspectorPhotoFilePicker({
  label,
  disabled,
  multiple = false,
  className,
  onFilesSelected,
}: {
  label: string;
  disabled?: boolean;
  multiple?: boolean;
  className?: string;
  onFilesSelected: (files: File[]) => void | Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        className={cn(UPLOAD_BTN, className)}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <i className="ti ti-upload" aria-hidden /> {label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length > 0) {
            void onFilesSelected(files);
          }
        }}
      />
    </>
  );
}
