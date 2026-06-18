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

export function StatSkeleton() {
  return (
    <div className="flex flex-col items-start px-4 py-3.5" aria-busy aria-label="جاري التحميل">
      <Skeleton className="mb-2 h-3 w-24" />
      <Skeleton className="h-7 w-14" />
      <Skeleton className="mt-2 h-2.5 w-32" />
    </div>
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
