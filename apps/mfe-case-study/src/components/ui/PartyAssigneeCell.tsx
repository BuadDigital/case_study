"use client";

import { cn } from "@platform/design-system";
import type { CaseStudyPartyAssignee } from "../../lib/prototype/case-study-tracks";

function progressBarClass(pct: number): string {
  if (pct >= 100) return "bg-success";
  if (pct > 0) return "bg-amber";
  return "bg-teal-light";
}

export function PartyAssigneeCell({ party }: { party: CaseStudyPartyAssignee }) {
  if (!party.enabled) return <>—</>;

  const name = party.name.trim();
  if (!name || name === "—") return <>—</>;

  const pct = party.progressPct;

  return (
    <div
      className="mx-auto flex w-[6.75rem] flex-col items-stretch gap-1"
      title={name}
    >
      <div className="truncate text-center text-[11px] leading-snug text-text-2">
        {name}
      </div>
      <div className="flex w-full items-center gap-1">
        <div className="h-[5px] w-[4.75rem] shrink-0 overflow-hidden rounded bg-surface-3">
          <div
            className={cn("h-full rounded transition-[width] duration-[400ms]", progressBarClass(pct))}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="min-w-[1.75em] shrink-0 text-end text-[9px] font-semibold text-text-3 tabular-nums">
          {pct}%
        </span>
      </div>
    </div>
  );
}
