"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { AppModal, Button, Spinner, cn, useToast } from "@platform/ui-kit";
import {
  isPropertyDetailDocumentAvailable,
  type PropertyDetailDocumentEntry,
} from "../../lib/app-data/property-detail-documents";
import {
  INSPECTOR_PHOTO_ACCEPT,
  filterInspectorPhotoFiles,
  useInspectorPhotoDropZone,
} from "../../lib/app-data/inspector-photo-drop";

const UPLOAD_BTN =
  "inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border-md bg-surface px-2.5 py-2 text-[11px] text-text-2 hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60 max-lg:min-h-12 max-lg:rounded-xl max-lg:text-[13px] max-lg:font-semibold";

const COMPACT_TOUCH_BTN =
  "inline-flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border-md bg-surface px-1.5 py-1.5 text-[10px] font-semibold text-text-2 hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60";

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
  /** Single-line control height — for grid rows next to inputs/selects. */
  compact = false,
  transactionPhotos,
  onTransactionPhotoSelected,
  className,
  onFilesSelected,
}: {
  label: string;
  disabled?: boolean;
  loading?: boolean;
  multiple?: boolean;
  compact?: boolean;
  transactionPhotos?: PropertyDetailDocumentEntry[];
  onTransactionPhotoSelected?: (
    photo: PropertyDetailDocumentEntry,
  ) => boolean | void | Promise<boolean | void>;
  className?: string;
  onFilesSelected: (files: File[]) => boolean | void | Promise<boolean | void>;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const isTouch = useTouchDevice();
  const { runWithUploadToast } = useToast();
  const blocked = Boolean(disabled || loading);
  const [transactionPickerOpen, setTransactionPickerOpen] = useState(false);

  const availableTransactionPhotos = useMemo(
    () =>
      (transactionPhotos ?? []).filter(
        (photo) =>
          photo.kind === "image" && isPropertyDetailDocumentAvailable(photo),
      ),
    [transactionPhotos],
  );
  const canPickFromTransaction =
    Boolean(onTransactionPhotoSelected) && availableTransactionPhotos.length > 0;

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

  const handleTransactionPick = (photo: PropertyDetailDocumentEntry) => {
    if (!onTransactionPhotoSelected) return;
    void runWithUploadToast(async () => {
      await onTransactionPhotoSelected(photo);
      setTransactionPickerOpen(false);
    });
  };

  const transactionModal = (
    <AppModal
      open={transactionPickerOpen}
      title="اختر من صور المعاملة"
      onClose={() => setTransactionPickerOpen(false)}
      footer={
        <Button
          type="button"
          variant="ghost"
          onClick={() => setTransactionPickerOpen(false)}
        >
          إغلاق
        </Button>
      }
    >
      {availableTransactionPhotos.length === 0 ? (
        <p className="m-0 text-[13px] text-text-3">
          لا توجد صور متاحة في مستندات المعاملة بعد.
        </p>
      ) : (
        <div className="grid max-h-[min(420px,60vh)] grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2 overflow-y-auto">
          {availableTransactionPhotos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              className="overflow-hidden rounded-lg border border-border bg-surface-2 p-0 text-start hover:border-gold"
              onClick={() => handleTransactionPick(photo)}
            >
              <div className="relative h-[88px] w-full bg-surface-2">
                {photo.dataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.dataUrl}
                    alt={photo.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[11px] text-text-3">
                    معاينة
                  </div>
                )}
              </div>
              <div className="px-2 py-1.5">
                <div className="truncate text-[11px] font-semibold text-heading">
                  {photo.name}
                </div>
                <div className="truncate text-[10px] text-text-3">
                  {photo.source}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </AppModal>
  );

  if (isTouch) {
    const touchBtnClass = compact ? COMPACT_TOUCH_BTN : UPLOAD_BTN;
    return (
      <>
        <div
          className={cn(
            "flex flex-col gap-1",
            compact ? "h-full justify-center" : "gap-1.5",
            dragOver && "rounded-xl ring-2 ring-primary/40",
            className,
          )}
          {...dropZoneProps}
        >
          <button
            type="button"
            className={touchBtnClass}
            disabled={blocked}
            aria-busy={loading || undefined}
            data-no-action-toast=""
            onClick={() => cameraRef.current?.click()}
          >
            {loading ? <Spinner /> : <i className="ti ti-camera" aria-hidden />}
            {loading ? "جاري الرفع…" : "تصوير بالكاميرا"}
          </button>
          {canPickFromTransaction ? (
            <button
              type="button"
              className={touchBtnClass}
              disabled={blocked}
              aria-busy={loading || undefined}
              data-no-action-toast=""
              onClick={() => setTransactionPickerOpen(true)}
            >
              {loading ? (
                <Spinner />
              ) : (
                <i className="ti ti-photo" aria-hidden />
              )}
              {loading ? "جاري الرفع…" : "من صور المعاملة"}
            </button>
          ) : (
            <button
              type="button"
              className={touchBtnClass}
              disabled={blocked}
              aria-busy={loading || undefined}
              data-no-action-toast=""
              onClick={() => galleryRef.current?.click()}
            >
              {loading ? <Spinner /> : <i className="ti ti-photo" aria-hidden />}
              {loading ? "جاري الرفع…" : "اختيار من المعرض"}
            </button>
          )}
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
        {transactionModal}
      </>
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
          compact
            ? "h-full min-h-9 flex-row gap-1.5 px-2.5 py-2"
            : "flex-col gap-1 py-3",
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
        {loading ? (
          <Spinner />
        ) : (
          <i
            className={cn("ti ti-upload", compact ? "text-sm" : "text-base")}
            aria-hidden
          />
        )}
        <span className="font-semibold">
          {loading ? "جاري الرفع…" : dragOver ? "أفلِت الصور هنا" : label}
        </span>
        {!compact && !loading && !dragOver ? (
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
      {transactionModal}
    </>
  );
}
