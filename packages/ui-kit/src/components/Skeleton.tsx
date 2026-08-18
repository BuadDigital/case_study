import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";
import { Tr, Td } from "./Table";

export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded bg-surface-3 ui-skeleton-shimmer",
        className,
      )}
      aria-hidden
      {...props}
    />
  );
}

/** Full panel / page block while content loads */
export function PanelSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("space-y-3 p-6", className)}
      aria-busy
      aria-label="جاري التحميل"
    >
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-10 w-36" />
    </div>
  );
}

/** Compact inline block (forms, tabs, side panels) */
export function InlineLoadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-busy aria-label="جاري التحميل">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}

export function SkeletonTableRows({
  rows = 5,
  cols = 4,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <Tr key={rowIndex} hoverable={false} className={className}>
          {Array.from({ length: cols }, (_, colIndex) => (
            <Td key={colIndex}>
              <Skeleton
                className={cn(
                  "h-3",
                  colIndex === 0 ? "w-20" : "w-full max-w-[120px]",
                )}
              />
            </Td>
          ))}
        </Tr>
      ))}
    </>
  );
}
