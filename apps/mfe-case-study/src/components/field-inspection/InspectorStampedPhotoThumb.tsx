"use client";

import { useEffect, useState } from "react";
import { cn } from "@platform/design-system";
import type { InspectorPhotoAttachment } from "../../lib/prototype/inspector-workspace-data";
import {
  getInspectorPhotoDataUrl,
  prefetchInspectorPhoto,
} from "../../lib/prototype/inspector-photo-upload";

export function InspectorStampedPhotoThumb({
  stamp,
  compact,
  className,
  taskId,
  photoRef,
  attachment,
  dataUrl: dataUrlProp,
  onClear,
  onClick,
}: {
  stamp: string;
  compact?: boolean;
  className?: string;
  taskId?: string;
  photoRef?: string;
  attachment?: InspectorPhotoAttachment | null;
  dataUrl?: string;
  onClear?: () => void;
  onClick?: () => void;
}) {
  const [dataUrl, setDataUrl] = useState(
    () =>
      dataUrlProp ??
      (taskId && photoRef ? getInspectorPhotoDataUrl(taskId, photoRef) : undefined),
  );

  useEffect(() => {
    if (dataUrlProp !== undefined) {
      setDataUrl(dataUrlProp);
      return;
    }
    if (!taskId || !photoRef || !attachment) return;

    const cached = getInspectorPhotoDataUrl(taskId, photoRef);
    if (cached) {
      setDataUrl(cached);
      return;
    }

    let cancelled = false;
    void prefetchInspectorPhoto(taskId, photoRef, attachment).then((url) => {
      if (!cancelled && url) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [dataUrlProp, taskId, photoRef, attachment]);

  const sizeClass = compact
    ? "h-[60px] w-[84px] text-[10px]"
    : "h-[72px] w-[116px] text-[11px]";

  return (
    <div className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "relative overflow-hidden rounded-md border bg-cover bg-center",
          dataUrl
            ? "border-teal-light"
            : "border-teal-light bg-teal-light text-teal-text",
          sizeClass,
        )}
        style={dataUrl ? { backgroundImage: `url(${dataUrl})` } : undefined}
      >
        {!dataUrl ? (
          <span className="flex h-full flex-col items-center justify-center">
            <i className="ti ti-photo-check text-lg" aria-hidden />
            {stamp ? (
              <span className="mt-0.5 max-w-full truncate px-1 text-[8px] leading-tight opacity-90">
                {stamp}
              </span>
            ) : null}
          </span>
        ) : (
          <span className="absolute bottom-0 left-0 right-0 bg-black/55 px-0.5 py-0.5 text-[8px] leading-tight text-white">
            {stamp}
          </span>
        )}
      </button>
      {onClear ? (
        <button
          type="button"
          title="إزالة"
          aria-label="إزالة الصورة"
          className="absolute -start-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface text-danger-text shadow-sm hover:bg-danger-surface"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
        >
          <span className="text-sm font-bold leading-none" aria-hidden>
            ×
          </span>
        </button>
      ) : null}
    </div>
  );
}
