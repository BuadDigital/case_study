"use client";

import { cn, opsLetterCard } from "@platform/ui-kit";

import type { buildNavItems, ValuationWorkScreenId } from "./lib/shell-state";

/** The work shell's own screen pills — shown when it is not embedded under the window's top tabs. */
export function ValuationWorkNav({
  items,
  active,
  onSelect,
}: {
  items: ReturnType<typeof buildNavItems>;
  active: ValuationWorkScreenId;
  onSelect: (id: ValuationWorkScreenId) => void;
}) {
  return (
    <div className={opsLetterCard}>
      <nav className="flex flex-wrap gap-1.5 px-[22px] py-3">
        {items
          .filter((n) => n.show)
          .map((n) => {
            const isActive = active === n.id;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => onSelect(n.id)}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-2 text-[12.5px] font-bold",
                  isActive
                    ? "border-ink bg-ink text-white"
                    : "border-border-md bg-surface text-text",
                )}
              >
                {n.label}
                {n.badge != null ? (
                  <span
                    className={cn(
                      "grid h-[17px] min-w-[17px] place-items-center rounded-full px-[5px] text-[9.5px] font-bold",
                      isActive
                        ? "bg-[rgba(200,181,145,.35)] text-white"
                        : "bg-gold-soft text-gold-d",
                    )}
                  >
                    {n.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
      </nav>
    </div>
  );
}
