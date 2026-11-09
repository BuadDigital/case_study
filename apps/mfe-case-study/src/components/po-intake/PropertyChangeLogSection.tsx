"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listPropertyChangeLog } from "@platform/api-client/audit";
import { formatArDateTime } from "@platform/app-shared/format/date";
import { requireWorkOrdersApiConfig } from "@platform/app-shared/app-data/work-orders-api-config";
import { useWindowEvents } from "@platform/app-shared/hooks/useWindowEvents";
import { cn, opsPanelCard } from "@platform/ui-kit";
import { toPropertyChangeEntries } from "../../lib/app-data/property-change-log";
import {
  WORK_ORDERS_CHANGED_EVENT,
} from "@platform/app-shared/events/app-events";

/**
 * «سجل تعديلات البيانات» — who changed which field of the property, when, and in which capacity
 * (ruling 2026-11-02: every case-specialist sub-role and the appraiser edit property data, with a
 * trail for oversight). Collapsed by default; fetched only when opened, refreshed after a save.
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

  return (
    <section className={cn(opsPanelCard, "p-3")}>
      <button
        type="button"
        className="flex w-full items-center justify-between text-xs font-semibold text-heading"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        سجل تعديلات البيانات
        <span className="text-[11px] font-normal text-text-3">{open ? "إخفاء" : "عرض"}</span>
      </button>
      {open ? (
        <div className="mt-2 flex flex-col gap-2">
          {query.isPending ? (
            <p className="m-0 text-[11px] text-text-3">جاري التحميل…</p>
          ) : query.isError ? (
            <p className="m-0 text-[11px] text-danger">تعذّر تحميل سجل التعديلات.</p>
          ) : entries.length === 0 ? (
            <p className="m-0 text-[11px] text-text-3">لا توجد تعديلات مسجلة على بيانات العقار.</p>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="rounded-[var(--radius)] border border-border px-2.5 py-2">
                <p className="m-0 text-[11px] text-text-2">
                  <span className="font-semibold text-heading">{entry.actorName}</span>
                  {entry.actorCapacity ? ` — ${entry.actorCapacity}` : ""}
                  {" · "}
                  {formatArDateTime(entry.atUtc)}
                  {entry.autosave ? " · حفظ تلقائي" : ""}
                </p>
                <ul className="m-0 mt-1 list-none p-0">
                  {entry.lines.map((line) => (
                    <li key={line.field} className="text-[11px] leading-relaxed text-text">
                      <span className="text-text-2">{line.label}: </span>
                      <span className="line-through decoration-text-3/60">{line.before}</span>
                      {" ← "}
                      <span className="font-medium">{line.after}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}
