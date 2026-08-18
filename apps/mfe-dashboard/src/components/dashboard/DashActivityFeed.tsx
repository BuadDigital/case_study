"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useAuth } from "@platform/app-shared/hooks/useAuth";
import { useSyncedNotifications } from "@platform/app-shared/notifications/useSyncedNotifications";
import { filterNotificationsForRole } from "@platform/app-shared/notifications/role-notification-policy";
import type { AppNotification } from "@platform/app-shared/notifications/notification-store";
import { formatRelativeAr, formatGapAr } from "../../lib/dashboard-metrics";
import {
  dashCard,
  dashIco,
  dashLine,
  dashLineNew,
} from "../../lib/dashboard-tw";
import { cn } from "@platform/ui-kit";
import {
  DashActivityIconSvg,
  type DashActivityIcon,
} from "./DashIcons";

const FEED_LIMIT = 8;

function activityVisual(item: AppNotification): {
  ic: DashActivityIcon;
  c: string;
} {
  if (item.category === "failures" || item.entityType === "failure") {
    return { ic: "tri", c: "#d9694f" };
  }
  if (item.category === "financial") {
    return { ic: "file", c: "var(--gold-d)" };
  }
  if (item.tone === "success") {
    return { ic: "check", c: "#3f8f5f" };
  }
  if (item.tone === "warn") {
    return { ic: "bell", c: "#d9a441" };
  }
  switch (item.entityType) {
    case "work-order":
      return { ic: "file", c: "var(--gold-d)" };
    case "property":
      return { ic: "eye", c: "#3f8f5f" };
    case "task":
    case "operations-task":
      return { ic: "pin", c: "var(--ink)" };
    default:
      break;
  }
  if (item.category === "system") {
    return { ic: "mail", c: "#9aa3b2" };
  }
  return { ic: "bell", c: "var(--ink)" };
}

function displayText(item: AppNotification): string {
  const title = item.title.trim();
  const body = item.body?.trim();
  if (body && body !== title) return `${title} — ${body}`;
  return title;
}

export function DashActivityFeed() {
  const router = useRouter();
  const { role } = useAuth();
  const { items: allItems, markRead, markAllRead } = useSyncedNotifications();
  const now = useMemo(() => Date.now(), []);

  const items = useMemo(() => {
    return filterNotificationsForRole(role, allItems)
      .slice()
      .sort(
        (a, b) =>
          Date.parse(b.createdAt) - Date.parse(a.createdAt) ||
          b.id.localeCompare(a.id),
      )
      .slice(0, FEED_LIMIT);
  }, [allItems, role]);

  const unreadCount = items.filter((item) => !item.read).length;
  const newestTs = items.length ? Date.parse(items[0]!.createdAt) : Number.NaN;
  const gapTxt = Number.isFinite(newestTs)
    ? formatGapAr(Math.max(0, Math.round((now - newestTs) / 60_000)))
    : null;

  const onOpen = (item: AppNotification) => {
    markRead(item.id);
    if (item.href) router.push(item.href);
  };

  return (
    <div className={cn(dashCard, "mb-4 border-s-[3px] border-s-gold")}>
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <h3 className="m-0 text-[14px] font-bold text-heading">آخر الأحداث</h3>
        {unreadCount ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#d9694f] px-1.5 text-[11px] font-bold text-white">
            {unreadCount}
          </span>
        ) : null}
        {gapTxt ? (
          <span className="text-[11.5px] text-text-3">{gapTxt}</span>
        ) : null}
        {unreadCount ? (
          <button
            type="button"
            className="ms-auto border-0 bg-transparent p-0 text-[12px] font-bold text-heading underline-offset-2 hover:underline"
            onClick={markAllRead}
          >
            تحديد كمقروء
          </button>
        ) : (
          <span className="ms-auto text-[12px] font-bold text-[#3f8f5f]">
            لا جديد
          </span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="m-0 py-3 text-center text-[12.5px] text-text-3">
          لا توجد أحداث بعد. ستظهر هنا إشعاراتك الحقيقية عند وصولها.
        </p>
      ) : (
        items.map((item) => {
          const isNew = !item.read;
          const clickable = Boolean(item.href);
          const { ic, c } = activityVisual(item);
          const ts = Date.parse(item.createdAt);
          return (
            <div
              key={item.id}
              className={cn(
                dashLine,
                isNew && dashLineNew,
                clickable && "cursor-pointer",
              )}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
              onClick={() => onOpen(item)}
              onKeyDown={
                clickable
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOpen(item);
                      }
                    }
                  : undefined
              }
            >
              <span
                className={dashIco}
                style={{
                  background: `color-mix(in srgb, ${c} 13%, transparent)`,
                  color: c,
                }}
              >
                <DashActivityIconSvg name={ic} />
              </span>
              <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] leading-normal text-text">
                {displayText(item)}
              </span>
              {isNew ? (
                <span className="shrink-0 rounded-full bg-gold-soft px-[7px] py-0.5 text-[9.5px] font-bold text-gold-d">
                  جديد
                </span>
              ) : null}
              <span className="w-16 shrink-0 whitespace-nowrap text-end text-[11px] text-text-3">
                {Number.isFinite(ts) ? formatRelativeAr(ts, now) : ""}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}
