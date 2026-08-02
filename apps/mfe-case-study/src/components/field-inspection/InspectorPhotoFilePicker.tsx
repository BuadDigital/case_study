"use client";

import { useRef, type ChangeEvent } from "react";
import { Spinner, cn, useToast } from "@platform/design-system";

const UPLOAD_BTN =
  "inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border-md bg-surface px-2.5 py-2 text-[11px] text-text-2 hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60 max-lg:min-h-12 max-lg:rounded-xl max-lg:text-[13px] max-lg:font-semibold";

function useCoarsePointer(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

export function InspectorPhotoFilePicker({
  label,
  disabled,
  loading = false,
  multiple = false,
  className,
  onFilesSelected,
}: {
  label: string;
  disabled?: boolean;
  loading?: boolean;
  multiple?: boolean;
  className?: string;
  onFilesSelected: (files: File[]) => boolean | void | Promise<boolean | void>;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const isMobile = useCoarsePointer();
  const { runWithUploadToast } = useToast();
  const blocked = Boolean(disabled || loading);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length > 0) {
      void runWithUploadToast(() => onFilesSelected(files));
    }
  };

  if (isMobile) {
    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        <button
          type="button"
          className={UPLOAD_BTN}
          disabled={blocked}
          aria-busy={loading || undefined}
          data-no-action-toast=""
          onClick={() => cameraRef.current?.click()}
        >
          {loading ? <Spinner /> : <i className="ti ti-camera" aria-hidden />}
          {loading ? "جاري الرفع…" : "تصوير بالكاميرا"}
        </button>
        <button
          type="button"
          className={UPLOAD_BTN}
          disabled={blocked}
          aria-busy={loading || undefined}
          data-no-action-toast=""
          onClick={() => galleryRef.current?.click()}
        >
          {loading ? <Spinner /> : <i className="ti ti-photo" aria-hidden />}
          {loading ? "جاري الرفع…" : "اختيار من المعرض"}
        </button>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*,.heic,.heif"
          capture="environment"
          multiple={multiple}
          disabled={blocked}
          className="sr-only"
          onChange={handleChange}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*,.heic,.heif"
          multiple={multiple}
          disabled={blocked}
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
        disabled={blocked}
        aria-busy={loading || undefined}
        data-no-action-toast=""
        onClick={() => inputRef.current?.click()}
      >
        {loading ? <Spinner /> : <i className="ti ti-upload" aria-hidden />}
        {loading ? "جاري الرفع…" : label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple={multiple}
        disabled={blocked}
        className="sr-only"
        onChange={handleChange}
      />
    </>
  );
}
