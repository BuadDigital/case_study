"use client";

/** Failures queue — the search toolbar and the viewer-mode note for roles that only look. */

import { Note, OperationalToolbarSearch, PageToolbar } from "@platform/ui-kit";
import { viewerModeNote } from "../lib/failures-view-state";
import type { FailuresViewWorkflow } from "./useFailuresViewWorkflow";

export function FailuresViewToolbar({
  wf,
}: {
  wf: Pick<FailuresViewWorkflow, "search" | "setSearch" | "role">;
}) {
  const note = viewerModeNote(wf.role);
  return (
    <>
      <PageToolbar className="mb-0 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b-0 bg-transparent px-0 py-0">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
          <OperationalToolbarSearch
            type="search"
            placeholder="بحث…"
            value={wf.search}
            onChange={(e) => wf.setSearch(e.target.value)}
            aria-label="بحث التعذرات"
          />
        </div>
      </PageToolbar>

      {note ? (
        <Note tone="info" className="m-0">
          {note}
        </Note>
      ) : null}
    </>
  );
}
