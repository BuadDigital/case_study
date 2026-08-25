"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@platform/app-shared/hooks/useAuth";
import { useSyncedNotifications } from "@platform/app-shared/notifications/useSyncedNotifications";
import { filterNotificationsForRole } from "@platform/app-shared/notifications/role-notification-policy";
import { formatNotificationTime } from "@platform/app-shared/notifications/format-notification-time";
import type { NotificationCategory } from "@platform/app-shared/notifications/notification-store";
import { isFeatureEnabled } from "@platform/app-shared/feature-flags";
import { cn, Button } from "@platform/ui-kit";

function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

const categoryLabel: Record<NotificationCategory, string> = {
  workflow: "سير العمل",
  financial: "مالي",
  failures: "تعذرات",
  system: "نظام",
};

const toneBorderClass = {
  info: "border-s-2 border-s-primary/40",
  success: "border-s-2 border-s-success",
  warn: "border-s-2 border-s-warning",
} as const;

export function NotificationCenter() {
  const { role } = useAuth();
  const { items: allItems, markRead, markAllRead, clear, remove } =
    useSyncedNotifications();
  const items = useMemo(
    () => filterNotificationsForRole(role, allItems),
    [role, allItems],
  );
  const unreadCount = useMemo(
    () => items.filter((item) => !item.read).length,
    [items],
  );
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    const mq = window.matchMedia("(max-width: 1023px)");
    if (mq.matches) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!isFeatureEnabled("notificationCenter")) return null;

  // Built only while the popover is open — skips mapping the notification
  // list on every re-render of the closed bell button.
  const panel = !open ? null : (
    <>
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5 max-lg:px-4 max-lg:py-3.5">
        <span className="text-sm font-semibold text-text">الإشعارات</span>
        <div className="flex items-center gap-1">
          {items.length > 0 ? (
            <>
              <Button type="button" size="sm" variant="ghost" onClick={markAllRead}>
                تعليم الكل كمقروء
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-danger hover:text-danger"
                onClick={clear}
              >
                حذف الكل
              </Button>
            </>
          ) : null}
          <button
            type="button"
            className="hidden size-9 place-items-center rounded-lg border-none bg-surface-2 text-[18px] leading-none text-text-2 max-lg:grid"
            aria-label="إغلاق"
            onClick={() => setOpen(false)}
          >
            ×
          </button>
        </div>
      </div>
      <div className="max-h-80 overflow-y-auto max-lg:max-h-none max-lg:flex-1 max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {items.length === 0 ? (
          <p className="m-0 px-3 py-4 text-center text-xs text-text-3">
            لا توجد إشعارات بعد.
          </p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "border-b border-border px-3 py-2.5 text-xs last:border-b-0 max-lg:px-4 max-lg:py-3.5 max-lg:text-[13px]",
                !item.read && "bg-primary/5",
                item.tone ? toneBorderClass[item.tone] : undefined,
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="block font-medium text-text no-underline hover:text-primary"
                      onClick={() => {
                        markRead(item.id);
                        setOpen(false);
                      }}
                    >
                      {item.title}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="block w-full border-none bg-transparent p-0 text-start font-medium text-text"
                      onClick={() => markRead(item.id)}
                    >
                      {item.title}
                    </button>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-text-3 max-lg:text-[11px]">
                    <time dateTime={item.createdAt}>
                      {formatNotificationTime(item.createdAt)}
                    </time>
                    {item.category ? (
                      <span>{categoryLabel[item.category]}</span>
                    ) : null}
                    {item.actor ? <span>{item.actor}</span> : null}
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-auto shrink-0 px-1 py-0 text-text-3 hover:text-danger max-lg:min-h-11 max-lg:px-2"
                  onClick={() => remove(item.id)}
                  aria-label="حذف الإشعار"
                >
                  حذف
                </Button>
              </div>
              {item.body ? (
                <p className="m-0 mt-1 text-text-3">{item.body}</p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </>
  );

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        className={cn(
          "relative inline-flex size-10 items-center justify-center rounded-lg border border-border/80 bg-surface",
          "text-text-2 shadow-[0_1px_2px_rgba(15,52,96,0.06)] transition-colors hover:bg-surface-2 hover:text-heading",
        )}
        aria-label={`الإشعارات${unreadCount ? ` — ${unreadCount} غير مقروء` : ""}`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        <BellIcon />
        {unreadCount > 0 ? (
          <span className="absolute top-2 end-[9px] size-[7px] rounded-full border-2 border-surface bg-red" />
        ) : null}
      </button>
      {open ? (
        <>
          <div
            className="fixed inset-0 z-40 bg-[rgba(10,33,56,0.35)] lg:hidden"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            className={cn(
              "absolute end-0 top-[calc(100%+6px)] z-50 w-80 overflow-hidden rounded-md border border-border bg-surface shadow-modal",
              "max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:top-auto max-lg:z-50 max-lg:flex max-lg:max-h-[min(88dvh,100%)] max-lg:w-full max-lg:flex-col max-lg:rounded-b-none max-lg:rounded-t-[16px]",
            )}
            role="dialog"
            aria-label="مركز الإشعارات"
          >
            {panel}
          </div>
        </>
      ) : null}
    </div>
  );
}
