"use client";

import { useState } from "react";
import { useOfflineSyncCoordinator } from "@/hooks/useOfflineSyncCoordinator";
import {
  isStaleOutboxItem,
  outboxKindLabel,
  syncStatusIcon,
} from "@/components/offline-sync-state";

/**
 * Top-bar sync indicator + pending list + offline-lease lock screen for field
 * roles. All wiring lives in `useOfflineSyncCoordinator`; this only renders.
 */
export function OfflineSyncCoordinator() {
  const { active, syncState, pending, pendingItems, locked, label } =
    useOfflineSyncCoordinator();
  const [open, setOpen] = useState(false);

  if (!active) return null;

  return (
    <>
      {locked ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4">
          <div className="max-w-md rounded-2xl bg-surface p-6 text-center shadow-xl">
            <h2 className="m-0 text-lg font-semibold text-text-1">
              انتهت جلسة العمل دون اتصال
            </h2>
            <p className="mt-2 text-sm text-text-2">
              القفل كامل بعد ثلاث ساعات. بياناتك محفوظة مشفّرة وستُزامن بعد
              تسجيل الدخول مجدداً.
            </p>
            <button
              type="button"
              className="mt-4 min-h-11 rounded-xl bg-brand px-4 text-sm font-semibold text-white"
              onClick={() => {
                window.location.href = "/login";
              }}
            >
              تسجيل الدخول
            </button>
          </div>
        </div>
      ) : null}

      <div className="relative">
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-text-2 hover:bg-surface-2"
          aria-label={label}
          title={label}
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden className="text-base">
            {syncStatusIcon(syncState, pending)}
          </span>
          {pending > 0 ? (
            <span className="absolute -top-0.5 -left-0.5 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
              {pending}
            </span>
          ) : null}
        </button>
        {open ? (
          <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-border-md bg-surface p-3 shadow-lg">
            <p className="m-0 mb-2 text-xs font-semibold text-text-1">{label}</p>
            {pendingItems.length === 0 ? (
              <p className="m-0 text-xs text-text-2">لا عناصر معلّقة</p>
            ) : (
              <ul className="m-0 max-h-56 list-none space-y-2 overflow-auto p-0">
                {pendingItems.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-lg bg-surface-2 px-2 py-1.5 text-[11px] text-text-2"
                  >
                    <div className="font-medium text-text-1">
                      {outboxKindLabel(item.kind)}
                      {isStaleOutboxItem(item) ? (
                        <span className="ms-1 text-amber-600">
                          · معلّق &gt; ساعتين
                        </span>
                      ) : null}
                    </div>
                    <div>{item.targetId}</div>
                    {item.lastError ? <div>{item.lastError}</div> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}
