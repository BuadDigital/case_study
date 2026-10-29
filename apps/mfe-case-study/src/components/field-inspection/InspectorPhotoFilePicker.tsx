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
import { TransactionPhotoPickGrid } from "./TransactionPhotoPickGrid";

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

  /**
   * The «اختر من صور المعاملة» window.
   *
   * How it works: the grid picks a transaction photo; with `withDeviceUpload` the footer also has
   * «رفع من الجهاز», which closes the window and opens the file picker.
   *
   * Edge cases: on a computer the window is the control's click target, so the device upload must
   * stay one click away inside it; on touch the camera and gallery have their own buttons.
   */
  const renderTransactionModal = (withDeviceUpload: boolean) => (
    <AppModal
      open={transactionPickerOpen}
      title="اختر من صور المعاملة"
      onClose={() => setTransactionPickerOpen(false)}
      footer={
        <>
          {withDeviceUpload ? (
            <Button
              type="button"
              variant="outline"
              disabled={blocked}
              onClick={() => {
                setTransactionPickerOpen(false);
                galleryRef.current?.click();
              }}
            >
              رفع من الجهاز
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            onClick={() => setTransactionPickerOpen(false)}
          >
            إغلاق
          </Button>
        </>
      }
    >
      <TransactionPhotoPickGrid
        photos={availableTransactionPhotos}
        emptyText="لا توجد صور متاحة في مستندات المعاملة بعد."
        onPick={handleTransactionPick}
      />
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
        {renderTransactionModal(false)}
      </>
    );
  }

  /*
   * Computer / laptop: drop zone + native file picker.
   *
   * How it works: a click (or Enter/Space) opens the transaction-photo window when transaction
   * photos can be picked, else the file picker; files dropped on the zone upload directly.
   *
   * Fixed: the click always opened the file picker, so «من صور المعاملة» on a computer never showed
   * the transaction photos — the window existed only in the touch layout.
   */
  const openPicker = () => {
    if (blocked) return;
    if (canPickFromTransaction) setTransactionPickerOpen(true);
    else galleryRef.current?.click();
  };
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-busy={loading || undefined}
        aria-label={
          canPickFromTransaction
            ? `${label} — اختر من صور المعاملة أو اسحب صورة هنا`
            : `${label} — اختر صوراً أو اسحبها هنا`
        }
        className={cn(
          UPLOAD_BTN,
          compact
            ? "h-full min-h-9 flex-row gap-1.5 px-2.5 py-2"
            : "flex-col gap-1 py-3",
          dragOver && DROP_ACTIVE,
          className,
        )}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
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
            {canPickFromTransaction
              ? "اضغط للاختيار من صور المعاملة، أو اسحب صورة من جهازك"
              : "اسحب الصور وأفلتها، أو اضغط للاختيار"}
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
      {renderTransactionModal(true)}
    </>
  );
}
