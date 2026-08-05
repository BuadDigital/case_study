"use client";

import { cn } from "@platform/design-system";
import type { CaseStudyPartyAssignee } from "../../lib/prototype/case-study-tracks";
import { INSPECTION_TABLE_TYPE } from "../../lib/prototype/queue-table-type";

function progressBarClass(pct: number, done: boolean): string {
  // Real green — design-token --success is ink (navy), not a success green.
  if (done || pct >= 100) return "bg-emerald-600";
  if (pct > 0) return "bg-amber";
  return "bg-teal-light";
}

export function PartyAssigneeCell({ party }: { party: CaseStudyPartyAssignee }) {
  if (!party.enabled) {
    return <span className={INSPECTION_TABLE_TYPE.empty}>—</span>;
  }

  const name = party.name.trim();
  if (!name || name === "—") {
    return <span className={INSPECTION_TABLE_TYPE.empty}>—</span>;
  }

  const pct = party.progressPct;
  const done = party.state === "done" || pct >= 100;

  return (
    <div
      className="mx-auto flex w-[6.75rem] flex-col items-stretch gap-1"
      title={done ? `${name} · مكتمل` : name}
    >
      <div
        className={cn(
          "truncate text-center leading-snug",
          INSPECTION_TABLE_TYPE.name,
        )}
      >
        {name}
      </div>
      <div className="flex w-full items-center gap-1.5">
        <div className="h-[5px] w-[4.75rem] shrink-0 overflow-hidden rounded bg-surface-3">
          <div
            className={cn(
              "h-full rounded transition-[width] duration-[400ms]",
              progressBarClass(pct, done),
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span
          className={cn(
            "min-w-[1.75em] shrink-0 text-end tabular-nums",
            INSPECTION_TABLE_TYPE.meta,
            done && "text-emerald-700",
          )}
        >
          {pct}%
        </span>
      </div>
    </div>
  );
}
