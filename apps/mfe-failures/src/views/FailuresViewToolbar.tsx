"use client";

/** Failures queue — the search toolbar with the queue's two chips, and the viewer-mode note. */

import { FilterChips, Note, OperationalToolbarSearch, PageToolbar } from "@platform/ui-kit";
import type { FailuresTab } from "../lib/failures-list-page";
import { viewerModeNote } from "../lib/failures-view-state";
import type { FailuresViewWorkflow } from "./useFailuresViewWorkflow";

/**
 * The queue's two parts: «تحتاج إجراء» is the open work — possible, internal, returned and escalated
 * failures; «التعذّرات النهائية» is the final failures, decided on the platform by the assignment
 * specialist's direction, with nothing to do after. Which statuses each holds for which role lives in
 * `failuresTabStatuses`; resolved and suspended failures are on neither.
 */
const FAILURES_TABS: { id: FailuresTab; label: string }[] = [
  { id: "action", label: "تحتاج إجراء" },
  { id: "final", label: "التعذّرات النهائية" },
];

/**
 * Search, then the two parts as the system's quick-filter chips (as «أعمالي» and «أوامر العمل»).
 *
 * How it works: one chip is always selected — clicking the selected one keeps it (the list has no
 * «all»). Edge cases / changed 2026-11-09 (Omar: the small grey tab strip above the table read
 * badly): the counts appear once the list is loaded.
 */
export function FailuresViewToolbar({
  wf,
}: {
  wf: Pick<FailuresViewWorkflow, "search" | "setSearch" | "role" | "tab" | "setTab" | "tabCounts" | "isFetched">;
}) {
  const note = viewerModeNote(wf.role);
  return (
    <>
      <PageToolbar className="mb-0 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b-0 bg-transparent px-0 py-0">
        <OperationalToolbarSearch
          type="search"
          placeholder="بحث…"
          value={wf.search}
          onChange={(e) => wf.setSearch(e.target.value)}
          aria-label="بحث التعذّرات"
          className="max-lg:min-w-0 max-lg:flex-1"
        />
        <FilterChips
          options={FAILURES_TABS.map((t) => ({
            key: t.id,
            label: t.label,
            count: wf.isFetched ? wf.tabCounts[t.id] : undefined,
          }))}
          active={wf.tab}
          onChange={(key) => {
            if (key) wf.setTab(key as FailuresTab);
          }}
        />
      </PageToolbar>

      {note ? (
        <Note tone="info" className="m-0">
          {note}
        </Note>
      ) : null}
    </>
  );
}
