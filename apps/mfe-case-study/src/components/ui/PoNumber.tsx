"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@platform/design-system";
import { formatPoDisplay } from "@case-study/mfe";
import { poPropertiesPath } from "@case-study/mfe";
import { prefetchPoRecord } from "../../query/case-study-queries";

const poNumBase =
  "inline-block font-mono text-[11px] font-semibold [unicode-bidi:isolate]";

/** PO number isolated for correct display in RTL (Arabic label + LTR code). */
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
  const display = formatPoDisplay(value);
  const cls = cn(
    poNumBase,
    link &&
      "text-primary decoration-primary underline-offset-2 hover:underline hover:text-primary-mid",
    className,
  );

  const warmCache = () => {
    if (value.trim()) prefetchPoRecord(queryClient, value);
  };

  if (link && value.trim()) {
    return (
      <Link
        href={poPropertiesPath(value)}
        dir="ltr"
        className={cls}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={warmCache}
        onFocus={warmCache}
      >
        {display}
      </Link>
    );
  }

  return (
    <span dir="ltr" className={cls}>
      {display}
    </span>
  );
}
