"use client";

/**
 * Per-slot photo cells of `InspectorDefinedPhotosSection`: the mobile square
 * tile and the desktop c9 tile. Each owns its hidden file input and drop
 * zone; the slot state (done / «غير متوفر» / first photo) arrives as props.
 */
import { useEffect, useRef, useState } from "react";
import { cn, useToast } from "@platform/ui-kit";
import type { InspectorSlotPhoto } from "../../lib/app-data/inspector-workspace-data";
import {
  INSPECTOR_PHOTO_ACCEPT,
  filterInspectorPhotoFiles,
  useInspectorPhotoDropZone,
} from "../../lib/app-data/inspector-photo-drop";
import {
  getInspectorPhotoDataUrl,
  prefetchInspectorPhoto,
} from "../../lib/app-data/inspector-photo-upload";

type UploadHandler = (files: File[]) => boolean | void | Promise<boolean | void>;

/** Mobile square photo cell. */
export function MobilePhotoTile({
  label,
  required = true,
  done,
  none,
  disabled,
  onUpload,
  onToggleNone,
  onOpenDone,
}: {
  label: string;
  required?: boolean;
  done: boolean;
  none: boolean;
  disabled?: boolean;
  onUpload: UploadHandler;
  onToggleNone: () => void;
  onOpenDone?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { runWithUploadToast } = useToast();
  const dropBlocked = Boolean(disabled || none);
  const { dragOver, dropZoneProps } = useInspectorPhotoDropZone({
    disabled: dropBlocked,
    onFiles: (files) => runWithUploadToast(() => onUpload(files)),
  });

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={disabled}
        className={cn(
          "relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-[14px] border-[1.5px] p-2 font-inherit",
          done
            ? "border-solid border-border bg-surface-2"
            : "border-dashed border-[var(--border-md,#ddd8cc)] bg-surface",
          dragOver && "border-primary bg-[color-mix(in_srgb,var(--primary)_8%,transparent)]",
        )}
        {...dropZoneProps}
        onClick={() => {
          if (done && onOpenDone) {
            onOpenDone();
            return;
          }
          if (none) {
            onToggleNone();
            return;
          }
          inputRef.current?.click();
        }}
      >
        {done ? (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1f6f6f" strokeWidth="1.6" aria-hidden>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="8.5" cy="9.5" r="1.5" />
            <path d="m4 17 5-5 4 4 3-2 4 4" />
          </svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--gold-d,#a4906f)" strokeWidth="1.8" aria-hidden>
            <path d="M12 5v14M5 12h14" />
          </svg>
        )}
        <span className="text-center text-[11px] leading-tight text-text-2">
          {dragOver
            ? "أفلِت الصورة"
            : none
              ? `غير متوفر · ${label}`
              : label}
        </span>
        {!required && !none ? (
          <span className="text-[9px] font-semibold text-text-3">اختياري</span>
        ) : null}
        {done ? (
          <span className="absolute start-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-[#1f9d6f] text-white">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" aria-hidden>
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
        ) : null}
      </button>
      <button
        type="button"
        disabled={disabled}
        className="text-center text-[10px] font-medium text-text-3 underline-offset-2 hover:underline"
        onClick={onToggleNone}
      >
        {none ? "إلغاء «غير متوفر»" : "غير متوفر هنا"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={INSPECTOR_PHOTO_ACCEPT}
        capture="environment"
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          const files = filterInspectorPhotoFiles(e.target.files);
          e.target.value = "";
          if (files.length > 0) {
            void runWithUploadToast(() => onUpload(files));
          }
        }}
      />
    </div>
  );
}

/**
 * Desktop c9 tile: clear upload CTA; "not available" secondary.
 */
export function DesktopHtmlPhotoTile({
  label,
  required = true,
  done,
  none,
  taskId,
  photoRef,
  photo,
  disabled,
  onUpload,
  onToggleNone,
  onOpen,
}: {
  label: string;
  required?: boolean;
  done: boolean;
  none: boolean;
  taskId: string;
  photoRef?: string;
  photo?: InspectorSlotPhoto;
  disabled?: boolean;
  onUpload: UploadHandler;
  onToggleNone: () => void;
  onOpen?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { runWithUploadToast } = useToast();
  const dropBlocked = Boolean(disabled || none);
  const { dragOver, dropZoneProps } = useInspectorPhotoDropZone({
    disabled: dropBlocked,
    onFiles: (files) => runWithUploadToast(() => onUpload(files)),
  });
  const [dataUrl, setDataUrl] = useState(
    () =>
      photoRef ? getInspectorPhotoDataUrl(taskId, photoRef) : undefined,
  );

  useEffect(() => {
    if (!photoRef || !photo) {
      setDataUrl(undefined);
      return;
    }
    const cached = getInspectorPhotoDataUrl(taskId, photoRef);
    if (cached) {
      setDataUrl(cached);
      return;
    }
    let cancelled = false;
    void prefetchInspectorPhoto(taskId, photoRef, photo).then((url) => {
      if (!cancelled && url) setDataUrl(url);
    }).catch(() => {
      if (!cancelled) setDataUrl(undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [taskId, photoRef, photo]);

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        disabled={disabled}
        title={
          none
            ? "اضغط لإلغاء «غير متوفر»"
            : dragOver
              ? "أفلِت الصور هنا"
              : done
                ? "معاينة — أو اسحب صوراً إضافية"
                : "رفع صورة — اسحب وأفلت أو اضغط"
        }
        className={cn(
          "relative grid h-[108px] w-full place-items-center overflow-hidden rounded-lg border font-inherit",
          none
            ? "border-dashed border-border bg-surface-2"
            : done
              ? "border-solid border-border bg-surface-2"
              : "border-dashed border-[var(--gold-d,#a4906f)] bg-[color-mix(in_srgb,var(--gold)_6%,transparent)]",
          dragOver &&
            "border-primary bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]",
          !disabled && "cursor-pointer",
        )}
        style={
          dataUrl && !none && !dragOver
            ? {
                backgroundImage: `url(${dataUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
        {...dropZoneProps}
        onClick={() => {
          if (none) {
            onToggleNone();
            return;
          }
          if (done && onOpen) {
            onOpen();
            return;
          }
          inputRef.current?.click();
        }}
      >
        {!dataUrl || none ? (
          none ? (
            <span className="flex flex-col items-center gap-0.5 pb-4 text-center">
              <span className="text-[11px] font-semibold text-text-3">غير متوفر</span>
              <span className="text-[9px] text-text-3">اضغط للإلغاء</span>
            </span>
          ) : done ? (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-3)"
              strokeWidth="1.5"
              aria-hidden
            >
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <circle cx="8.5" cy="9.5" r="1.5" />
              <path d="m4 17 5-5 4 4 3-2 4 4" />
            </svg>
          ) : dragOver ? (
            <span className="flex flex-col items-center gap-1 px-1.5 pb-5 text-center">
              <i className="ti ti-upload text-xl text-primary" aria-hidden />
              <span className="text-[11px] font-bold text-primary">
                أفلِت الصور هنا
              </span>
            </span>
          ) : (
            <span className="flex flex-col items-center gap-1 px-1.5 pb-5 text-center">
              <i className="ti ti-camera-plus text-xl text-[var(--gold-d,#a4906f)]" aria-hidden />
              <span className="text-[11px] font-bold text-[var(--gold-d,#a4906f)]">
                ارفع صورة
              </span>
              <span className="text-[9px] font-normal text-text-3">
                أو اسحب وأفلت
              </span>
            </span>
          )
        ) : null}
        <span className="absolute inset-x-0 bottom-0 bg-[rgba(16,43,78,0.78)] px-1.5 py-[3px] text-center text-[9.5px] text-white">
          {label}
          {!required ? (
            <span className="ms-1 opacity-80">· اختياري</span>
          ) : null}
        </span>
      </button>
      <button
        type="button"
        disabled={disabled}
        className="py-0.5 text-center text-[10px] font-medium text-text-3 underline-offset-2 hover:text-text-2 hover:underline"
        onClick={onToggleNone}
      >
        {none ? "إلغاء «غير متوفر»" : "غير متوفر هنا"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={INSPECTOR_PHOTO_ACCEPT}
        multiple
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          const files = filterInspectorPhotoFiles(e.target.files);
          e.target.value = "";
          if (files.length > 0) {
            void runWithUploadToast(() => onUpload(files));
          }
        }}
      />
    </div>
  );
}
