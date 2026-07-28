"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
  DASH_ACTIVITY_ITEMS,
  DASH_SEEN_KEY,
} from "../../lib/dashboard-mock";
import {
  formatGapAr,
  formatRelativeAr,
} from "../../lib/dashboard-metrics";
import {
  dashCard,
  dashIco,
  dashLine,
  dashLineNew,
} from "../../lib/dashboard-tw";
import { cn } from "@platform/design-system";
import { DashActivityIconSvg } from "./DashIcons";

function readLastSeen(now: number): number {
  if (typeof window === "undefined") return now - 55 * 60_000;
  try {
    const raw = window.localStorage.getItem(DASH_SEEN_KEY);
    const n = raw ? parseInt(raw, 10) : Number.NaN;
    if (!Number.isFinite(n)) return now - 55 * 60_000;
    return n;
  } catch {
    return now - 55 * 60_000;
  }
}

export function DashActivityFeed() {
  const router = useRouter();
  const now = useMemo(() => Date.now(), []);
  const [lastSeen, setLastSeen] = useState(() => readLastSeen(now));

  const items = useMemo(
    () =>
      DASH_ACTIVITY_ITEMS.map((u) => ({
        ...u,
        ts: now - u.o * 60_000,
      })),
    [now],
  );

  const newCount = items.filter((u) => u.ts > lastSeen).length;
  const gapMin = Math.round((now - lastSeen) / 60_000);
  const gapTxt = formatGapAr(Math.max(0, gapMin));

  const markSeen = useCallback(() => {
    const ts = Date.now();
    try {
      window.localStorage.setItem(DASH_SEEN_KEY, String(ts));
    } catch {
      /* ignore */
    }
    setLastSeen(ts);
  }, []);

  const onOpen = (open: string) => {
    if (open.startsWith("po:")) {
      const po = open.slice(3);
      router.push(`/po/${encodeURIComponent(po)}/property`);
      return;
    }
    if (open.startsWith("task:")) {
      router.push("/operations-tasks");
    }
  };

  return (
    <div
      className={cn(dashCard, "mb-4 border-s-[3px] border-s-gold")}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <h3 className="m-0 text-[14px] font-bold text-heading">آخر الأحداث</h3>
        {newCount ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#d9694f] px-1.5 text-[11px] font-bold text-white">
            {newCount}
          </span>
        ) : null}
        <span className="text-[11.5px] text-text-3">{gapTxt}</span>
        {newCount ? (
          <button
            type="button"
            className="ms-auto border-0 bg-transparent p-0 text-[12px] font-bold text-heading underline-offset-2 hover:underline"
            onClick={markSeen}
          >
            تحديد كمقروء
          </button>
        ) : (
          <span className="ms-auto text-[12px] font-bold text-[#3f8f5f]">
            لا جديد
          </span>
        )}
      </div>
      {items.slice(0, 6).map((u) => {
        const isNew = u.ts > lastSeen;
        const clickable = Boolean(u.open);
        return (
          <div
            key={u.t}
            className={cn(dashLine, isNew && dashLineNew, clickable && "cursor-pointer")}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={clickable ? () => onOpen(u.open) : undefined}
            onKeyDown={
              clickable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpen(u.open);
                    }
                  }
                : undefined
            }
          >
            <span
              className={dashIco}
              style={{
                background: `color-mix(in srgb, ${u.c} 13%, transparent)`,
                color: u.c,
              }}
            >
              <DashActivityIconSvg name={u.ic} />
            </span>
            <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] leading-normal text-text">
              {u.t}
            </span>
            {isNew ? (
              <span className="shrink-0 rounded-full bg-gold-soft px-[7px] py-0.5 text-[9.5px] font-bold text-gold-d">
                جديد
              </span>
            ) : null}
            <span className="w-16 shrink-0 whitespace-nowrap text-end text-[11px] text-text-3">
              {formatRelativeAr(u.ts, now)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
