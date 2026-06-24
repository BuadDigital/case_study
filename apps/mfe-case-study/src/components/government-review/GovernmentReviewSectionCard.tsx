"use client";

import type { ReactNode } from "react";
import { cn } from "@platform/design-system";

export function GovernmentReviewSectionCard({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        className,
      )}
    >
      <header className="border-b border-border/70 bg-gradient-to-b from-surface-2/80 to-surface px-4 py-3">
        <h3 className="m-0 text-sm font-semibold leading-snug text-text">{title}</h3>
      </header>
      <div className="space-y-3 px-4 py-4">{children}</div>
    </section>
  );
}
