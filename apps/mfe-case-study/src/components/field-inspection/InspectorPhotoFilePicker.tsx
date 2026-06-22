"use client";

import { useRef, type ChangeEvent } from "react";
import { cn } from "@platform/design-system";

const UPLOAD_BTN =
  "inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border-md bg-surface px-2.5 py-2 text-[11px] text-text-2 hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60";

function useCoarsePointer(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

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
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const isMobile = useCoarsePointer();

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length > 0) {
      void onFilesSelected(files);
    }
  };

  if (isMobile) {
    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        <button
          type="button"
          className={UPLOAD_BTN}
          disabled={disabled}
          onClick={() => cameraRef.current?.click()}
        >
          <i className="ti ti-camera" aria-hidden /> تصوير بالكاميرا
        </button>
        <button
          type="button"
          className={UPLOAD_BTN}
          disabled={disabled}
          onClick={() => galleryRef.current?.click()}
        >
          <i className="ti ti-photo" aria-hidden /> اختيار من المعرض
        </button>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple={multiple}
          disabled={disabled}
          className="sr-only"
          onChange={handleChange}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          disabled={disabled}
          className="sr-only"
          onChange={handleChange}
        />
      </div>
    );
  }

  const inputRef = galleryRef;
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
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={handleChange}
      />
    </>
  );
}
