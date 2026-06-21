"use client";

import { cn } from "@platform/design-system";

export function InspectorStampedPhotoThumb({
  stamp,
  compact,
  className,
  dataUrl,
  onClear,
  onClick,
}: {
  stamp: string;
  compact?: boolean;
  className?: string;
  dataUrl?: string;
  onClear?: () => void;
  onClick?: () => void;
}) {
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
          className="absolute left-0.5 top-0.5 flex h-[18px] w-[18px] items-center justify-center rounded bg-white/90 text-[11px] text-text-3 hover:text-danger-text"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
        >
          <i className="ti ti-x" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
