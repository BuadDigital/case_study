"use client";

import { useRef, type ChangeEvent } from "react";
import { Spinner, cn, useToast } from "@platform/design-system";
import {
  INSPECTOR_PHOTO_ACCEPT,
  filterInspectorPhotoFiles,
  useInspectorPhotoDropZone,
} from "../../lib/prototype/inspector-photo-drop";

const UPLOAD_BTN =
  "inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border-md bg-surface px-2.5 py-2 text-[11px] text-text-2 hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60 max-lg:min-h-12 max-lg:rounded-xl max-lg:text-[13px] max-lg:font-semibold";

const DROP_ACTIVE =
  "border-primary bg-[color-mix(in_srgb,var(--primary)_8%,transparent)] text-primary";

/** Prefer real file dialog on mouse/trackpad; dual buttons only on touch devices. */
function useTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: coarse)").matches &&
    ("ontouchstart" in window || navigator.maxTouchPoints > 0)
  );
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
  const isTouch = useTouchDevice();
  const { runWithUploadToast } = useToast();
  const blocked = Boolean(disabled || loading);

  const handleFiles = (files: File[]) => {
    if (files.length > 0) {
      void runWithUploadToast(() => onFilesSelected(files));
    }
  };

  const { dragOver, dropZoneProps } = useInspectorPhotoDropZone({
    disabled: blocked,
    onFiles: handleFiles,
  });

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(filterInspectorPhotoFiles(e.target.files));
    e.target.value = "";
  };

  if (isTouch) {
    return (
      <div
        className={cn(
          "flex flex-col gap-1.5",
          dragOver && "rounded-xl ring-2 ring-primary/40",
          className,
        )}
        {...dropZoneProps}
      >
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
        {dragOver ? (
          <p className="text-center text-[11px] font-semibold text-primary">
            أفلِت الصور هنا
          </p>
        ) : null}
        <input
          ref={cameraRef}
          type="file"
          accept={INSPECTOR_PHOTO_ACCEPT}
          capture="environment"
          multiple={multiple}
          disabled={blocked}
          className="sr-only"
          onChange={handleChange}
        />
        <input
          ref={galleryRef}
          type="file"
          accept={INSPECTOR_PHOTO_ACCEPT}
          multiple={multiple}
          disabled={blocked}
          className="sr-only"
          onChange={handleChange}
        />
      </div>
    );
  }

  /* Computer / laptop: drop zone + native file picker. */
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-busy={loading || undefined}
        aria-label={`${label} — اختر صوراً أو اسحبها هنا`}
        className={cn(
          UPLOAD_BTN,
          "flex-col gap-1 py-3",
          dragOver && DROP_ACTIVE,
          className,
        )}
        onClick={() => !blocked && galleryRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!blocked) galleryRef.current?.click();
          }
        }}
        {...dropZoneProps}
      >
        {loading ? <Spinner /> : <i className="ti ti-upload text-base" aria-hidden />}
        <span className="font-semibold">
          {loading ? "جاري الرفع…" : dragOver ? "أفلِت الصور هنا" : label}
        </span>
        {!loading && !dragOver ? (
          <span className="text-[10px] font-normal text-text-3">
            اسحب الصور وأفلتها، أو اضغط للاختيار
          </span>
        ) : null}
      </div>
      <input
        ref={galleryRef}
        type="file"
        accept={INSPECTOR_PHOTO_ACCEPT}
        multiple={multiple}
        disabled={blocked}
        className="sr-only"
        onChange={handleChange}
      />
    </>
  );
}
