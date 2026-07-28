"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PoRow } from "@platform/app-shared/prototype/constants";
import {
  daysUntilDue,
  formatDateLtr,
  formatDueChip,
  parseDashDate,
  startOfLocalDay,
} from "../../lib/dashboard-metrics";
import { dashCard, dashLine } from "../../lib/dashboard-tw";
import { cn } from "@platform/design-system";

export function DashDueSoonOrders({ orders }: { orders: PoRow[] }) {
  const router = useRouter();
  const today = startOfLocalDay();
  const dueSoon = [...orders]
    .map((o) => ({ o, dueTs: parseDashDate(o.dueDate) }))
    .filter((x) => !Number.isNaN(x.dueTs))
    .sort((a, b) => a.dueTs - b.dueTs)
    .slice(0, 6);

  return (
    <div className={dashCard}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="m-0 text-[14px] font-bold text-heading">
          أوامر قاربت المهلة
        </h3>
        <Link
          href="/po"
          className="text-[12px] font-bold text-heading no-underline hover:underline"
        >
          أوامر العمل
        </Link>
      </div>
      {dueSoon.length === 0 ? (
        <div className="py-2 text-[12.5px] text-text-3">
          لا توجد أوامر قريبة من المهلة.
        </div>
      ) : (
        dueSoon.map(({ o, dueTs }) => {
          const dleft = daysUntilDue(dueTs, today);
          const chip = formatDueChip(dleft);
          return (
            <div
              key={o.id}
              className={cn(dashLine, "cursor-pointer")}
              role="button"
              tabIndex={0}
              onClick={() =>
                router.push(`/po/${encodeURIComponent(o.id)}/property`)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(`/po/${encodeURIComponent(o.id)}/property`);
                }
              }}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="shrink-0 text-[13px] font-bold text-heading">
                  <bdi>{o.id}</bdi>
                </span>
                <span className="ms-auto overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] text-text-3">
                  {o.type} · {o.count} عقار · {o.done}/{o.count} منجز
                </span>
              </div>
              <span
                className="w-[82px] shrink-0 whitespace-nowrap text-end text-[11px] text-text-3"
                dir="ltr"
              >
                {formatDateLtr(o.dueDate)}
              </span>
              <span
                className="w-[74px] shrink-0 rounded-full py-[3px] text-center text-[11px] font-bold whitespace-nowrap"
                style={{
                  background: `color-mix(in srgb, ${chip.color} 13%, transparent)`,
                  color: chip.color,
                }}
              >
                {chip.text}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
