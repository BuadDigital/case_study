"use client";

import { cn } from "@platform/design-system";

function SuccessCheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TaskCompletionSuccess({
  title,
  message,
  className,
  compact = false,
}: {
  title: string;
  message?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--radius-DEFAULT)] border border-border bg-surface text-center",
        compact ? "px-5 py-10" : "px-6 py-14",
        className,
      )}
    >
      <div
        className={cn(
          "mb-4 flex items-center justify-center rounded-full bg-success text-white shadow-[0_4px_14px_rgba(14,102,85,0.22)]",
          compact ? "h-12 w-12" : "h-16 w-16",
        )}
        aria-hidden
      >
        <SuccessCheckIcon className={compact ? "h-6 w-6" : "h-8 w-8"} />
      </div>
      <h3
        className={cn(
          "m-0 font-semibold text-text",
          compact ? "text-base" : "text-lg",
        )}
      >
        {title}
      </h3>
      {message ? (
        <p
          className={cn(
            "m-0 mt-2 max-w-md leading-relaxed text-text-3",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
