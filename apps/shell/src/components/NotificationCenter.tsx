"use client";

import Link from "next/link";
import { useState } from "react";
import { useNotifications } from "@platform/app-shared/notifications/NotificationProvider";
import { isFeatureEnabled } from "@platform/app-shared/feature-flags";
import { cn, Button } from "@platform/design-system";

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

export function NotificationCenter() {
  const { items, unreadCount, markRead, markAllRead, clear, remove } = useNotifications();
  const [open, setOpen] = useState(false);

  if (!isFeatureEnabled("notificationCenter")) return null;

  return (
    <div className="relative">
      <button
        type="button"
        className={cn(
          "relative inline-flex size-8 items-center justify-center rounded-md border border-transparent",
          "text-text-2 hover:border-border hover:bg-surface-2",
        )}
        aria-label={`الإشعارات${unreadCount ? ` — ${unreadCount} غير مقروء` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <BellIcon />
        {unreadCount > 0 ? (
          <span className="absolute -top-1 -end-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute end-0 top-[calc(100%+6px)] z-50 w-80 overflow-hidden rounded-md border border-border bg-surface shadow-modal">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-semibold text-text">الإشعارات</span>
            {items.length > 0 ? (
              <div className="flex items-center gap-1">
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
              </div>
            ) : null}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="m-0 px-3 py-4 text-center text-xs text-text-3">
                لا توجد إشعارات بعد.
              </p>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "border-b border-border px-3 py-2.5 text-xs last:border-b-0",
                    !item.read && "bg-primary/5",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
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
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-auto px-1 py-0 text-text-3 hover:text-danger"
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
        </div>
      ) : null}
    </div>
  );
}
