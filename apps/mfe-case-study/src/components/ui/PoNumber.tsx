"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  PoNumber as PoNumberDisplay,
  cn,
  formatPoDisplay,
  poNumberClassName,
  poNumberLinkClassName,
} from "@platform/ui-kit";
import { poPropertiesPath } from "@platform/app-shared/domain/po-routes";
import { prefetchPoRecord } from "../../query/case-study-queries";

/**
 * PO number with case-study routing: adds the linked variant on top of the
 * shared display contract (ui-kit is framework-free, so `next/link` and the
 * query-cache warm-up stay here).
 */
export function PoNumber({
  value,
  className,
  link = false,
}: {
  value: string;
  className?: string;
  /** Open PO properties page when clicked */
  link?: boolean;
}) {
  const queryClient = useQueryClient();

  const warmCache = () => {
    if (value.trim()) prefetchPoRecord(queryClient, value);
  };

  if (link && value.trim()) {
    return (
      <Link
        href={poPropertiesPath(value)}
        dir="ltr"
        className={cn(poNumberClassName, poNumberLinkClassName, className)}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={warmCache}
        onFocus={warmCache}
      >
        {formatPoDisplay(value)}
      </Link>
    );
  }

  return <PoNumberDisplay value={value} className={className} />;
}
