"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listPropertyChangeLog } from "@platform/api-client/audit";
import { formatArDateTime } from "@platform/app-shared/format/date";
import { requireWorkOrdersApiConfig } from "@platform/app-shared/app-data/work-orders-api-config";
import { useWindowEvents } from "@platform/app-shared/hooks/useWindowEvents";
import { initialsFromDisplayName } from "@platform/app-shared/lib/display-name-initials";
import { AppModal, cn, opsPanelCard } from "@platform/ui-kit";
import {
  CHANGE_CHAIN_PER_ROW,
  propertyChangeChainRows,
  toPropertyChangeEntries,
  type PropertyChangeEntry,
} from "../../lib/app-data/property-change-log";
import {
  WORK_ORDERS_CHANGED_EVENT,
} from "@platform/app-shared/events/app-events";

/** Half the circle's width — the arrow starts and ends this far from a cell's middle. */
const CIRCLE_HALF = "1.75rem";
const CHAIN_LINE = "border-[color:color-mix(in_srgb,var(--gold)_55%,var(--border))]";

/**
 * One save in the chain: the editor's initials in a circle, an arrow to the next save, and under
 * the circle who saved, when, and each field's old ← new value.
 *
 * How it works: every cell is one fifth of the line and the circle sits in its middle, so the
 * arrow is drawn from this circle's edge to the next one's (a line of the cell's width less one
 * circle, with a head at its end). The page reads right to left, so the arrow points left.
 * Edge cases: the last save of a line draws no arrow (`arrow` false — the line's turn is drawn by
 * `ChainTurn`); the newest save of all is filled so it stands out; long values wrap.
 */
function ChainCircle({
  entry,
  arrow,
  latest,
}: {
  entry: PropertyChangeEntry;
  arrow: boolean;
  latest: boolean;
}) {
  return (
    <li className="relative flex min-w-0 flex-col items-center px-2 text-center">
      <span
        aria-hidden
        className={cn(
          "flex size-14 shrink-0 items-center justify-center rounded-full border-2 text-[15px] font-bold",
          CHAIN_LINE,
          latest
            ? "bg-[color-mix(in_srgb,var(--gold)_30%,var(--surface))] text-gold-d"
            : "bg-surface text-heading",
        )}
      >
        {initialsFromDisplayName(entry.actorName) || "—"}
      </span>
      {arrow ? (
        <span
          aria-hidden
          className={cn("absolute top-7 border-t-2", CHAIN_LINE)}
          style={{
            insetInlineStart: `calc(50% + ${CIRCLE_HALF})`,
            width: `calc(100% - 2 * ${CIRCLE_HALF})`,
          }}
        >
          <span
            className={cn(
              // Bottom + left edges turned 45° make a head that points left (the page is RTL).
              "absolute -top-[5px] end-0 size-2 rotate-45 border-b-2 border-l-2",
              CHAIN_LINE,
            )}
          />
        </span>
      ) : null}
      <p className="m-0 mt-2 text-[12px] font-bold leading-5 text-heading">{entry.actorName}</p>
      {entry.actorCapacity ? (
        <p className="m-0 text-[10.5px] leading-4 text-text-3">{entry.actorCapacity}</p>
      ) : null}
      <p className="m-0 text-[10.5px] leading-4 text-text-3">
        <bdi>{formatArDateTime(entry.atUtc)}</bdi>
        {entry.autosave ? " · حفظ تلقائي" : ""}
      </p>
      <ul className="m-0 mt-1.5 w-full list-none rounded-[var(--radius)] bg-surface-2 px-2 py-1.5 text-start">
        {entry.lines.map((line) => (
          <li key={line.field} className="break-words text-[11px] leading-relaxed text-text">
            <span className="text-text-2">{line.label}: </span>
            <span className="line-through decoration-text-3/60">{line.before}</span>
            {" ← "}
            <span className="font-medium">{line.after}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}

/**
 * The turn between two lines of the chain: down from under the line's last circle, across, and
 * down with an arrow head onto the next line's first circle.
 *
 * How it works: the block is inset by half a cell on each side, so its two ends sit under the
 * middles of the last and the first circle; the upper half draws the drop and the crossing, the
 * lower half the drop that ends in the head.
 */
function ChainTurn() {
  return (
    <div
      aria-hidden
      className="relative h-9"
      style={{ marginInline: `${100 / CHANGE_CHAIN_PER_ROW / 2}%` }}
    >
      <span className={cn("absolute inset-x-0 top-0 h-1/2 rounded-ee-xl border-b-2 border-e-2", CHAIN_LINE)} />
      <span className={cn("absolute bottom-0 start-0 h-1/2 border-s-2", CHAIN_LINE)}>
        <span
          className={cn(
            // Bottom + right edges turned 45° make a head that points down.
            "absolute -start-[3px] bottom-0.5 size-2 rotate-45 border-b-2 border-r-2",
            CHAIN_LINE,
          )}
        />
      </span>
    </div>
  );
}

/**
 * «سجل تعديلات البيانات» — who changed which field of the property, when, and in which capacity
 * (ruling 2026-11-02: every case-specialist sub-role and the appraiser edit property data, with a
 * trail for oversight).
 *
 * How it works (Omar 2026-11-15): the card is one button that opens a window; the window draws the
 * saves as a chain of circles joined by arrows, from the first save to the latest, five circles a
 * line and then a turn down to the next line. The log is fetched only when the window opens and
 * refreshed after a save while it is open.
 * Edge cases: loading, a failed load and an empty log each print one line in the window; on a
 * narrow screen the chain keeps its five columns and scrolls sideways.
 */
export function PropertyChangeLogSection({ propertyId }: { propertyId: string }) {
  const [open, setOpen] = useState(false);
  const query = useQuery({
    queryKey: ["property-change-log", propertyId],
    enabled: open && Boolean(propertyId),
    staleTime: 30_000,
    queryFn: async () => {
      const config = requireWorkOrdersApiConfig();
      const page = await listPropertyChangeLog({ token: config.token }, propertyId);
      return toPropertyChangeEntries(page.items);
    },
  });
  useWindowEvents({
    [WORK_ORDERS_CHANGED_EVENT]: () => {
      if (open) void query.refetch();
    },
  });
  const entries = query.data ?? [];
  const rows = propertyChangeChainRows(entries);
  const latestId = entries[0]?.id;

  return (
    <section className={cn(opsPanelCard, "p-3")}>
      <button
        type="button"
        className="flex w-full items-center justify-between text-xs font-semibold text-heading"
        aria-haspopup="dialog"
        data-no-action-toast=""
        onClick={() => setOpen(true)}
      >
        سجل تعديلات البيانات
        <span className="text-[11px] font-normal text-text-3">عرض</span>
      </button>
      <AppModal
        open={open}
        title="سجل تعديلات البيانات"
        subtitle={
          entries.length > 0 ? `${entries.length} تعديل — من الأول إلى الأحدث` : undefined
        }
        maxWidthPx={1040}
        onClose={() => setOpen(false)}
      >
        {query.isPending ? (
          <p className="m-0 text-[12px] text-text-3">جاري التحميل…</p>
        ) : query.isError ? (
          <p className="m-0 text-[12px] text-danger">تعذّر تحميل سجل التعديلات.</p>
        ) : rows.length === 0 ? (
          <p className="m-0 text-[12px] text-text-3">لا توجد تعديلات مسجلة على بيانات العقار.</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[760px] py-1">
              {rows.map((row, rowIndex) => (
                <div key={row[0].id}>
                  <ol className="m-0 grid list-none grid-cols-5 p-0">
                    {row.map((entry, i) => (
                      <ChainCircle
                        key={entry.id}
                        entry={entry}
                        arrow={i < row.length - 1}
                        latest={entry.id === latestId}
                      />
                    ))}
                  </ol>
                  {rowIndex < rows.length - 1 ? <ChainTurn /> : null}
                </div>
              ))}
            </div>
          </div>
        )}
      </AppModal>
    </section>
  );
}
