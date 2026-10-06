"use client";

import { cn, opsLetterCard } from "@platform/ui-kit";

/**
 * Placeholder sized like the real valuation screen — no buttons or chips before
 * the data lands, so the layout does not jump when it does.
 */
export function ValuationWorkLoadingSkeleton() {
  return (
    <div aria-busy="true" aria-label="جاري تحميل مساحة عمل التقييم">
      {[0, 1, 2].map((i) => (
        <div key={i} className={cn(opsLetterCard, "mb-5")}>
          <div className="p-[18px_22px]">
            <div className="h-4 w-44 animate-pulse rounded-md bg-[var(--navy-soft)]" />
            <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
              {[0, 1, 2].map((j) => (
                <div key={j} className="min-w-0">
                  <div className="h-3 w-24 animate-pulse rounded bg-[var(--navy-soft)]" />
                  <div className="mt-2 h-9 animate-pulse rounded-[var(--radius)] bg-[var(--navy-soft)]" />
                </div>
              ))}
            </div>
            {i === 2 ? (
              <div className="mt-4 h-24 animate-pulse rounded-[var(--radius)] bg-[var(--navy-soft)]" />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
