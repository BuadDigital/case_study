"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { useOfflineSyncCoordinator } from "@/hooks/useOfflineSyncCoordinator";
import {
  outboxKindLabel,
  syncStatusIcon,
} from "@/components/offline-sync-state";

const OfflineSyncContext = createContext<ReturnType<
  typeof useOfflineSyncCoordinator
> | null>(null);

function useOfflineSyncState() {
  return useContext(OfflineSyncContext);
}

function LockOverlay({ locked }: { locked: boolean }) {
  if (!locked) return null;
  return (
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
          className="mt-4 min-h-11 rounded-xl bg-ink px-4 text-sm font-semibold text-white"
          onClick={() => {
            window.location.href = "/login";
          }}
        >
          تسجيل الدخول
        </button>
      </div>
    </div>
  );
}

/**
 * Runs the field-role sync loop once and always portals the 3-hour lock overlay,
 * even when the inspection topbar is hidden on phones.
 */
export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const state = useOfflineSyncCoordinator();
  return (
    <OfflineSyncContext.Provider value={state}>
      {state.active ? <LockOverlay locked={state.locked} /> : null}
      {children}
    </OfflineSyncContext.Provider>
  );
}

/**
 * Top-bar sync indicator + pending list for field roles.
 */
export function OfflineSyncCoordinator() {
  const state = useOfflineSyncState();
  const [open, setOpen] = useState(false);

  if (!state?.active) return null;

  const {
    syncState,
    pending,
    pendingItems,
    rejectedItems,
    dismissRejected,
    label,
  } = state;

  return (
    <div className="relative">
      <button
        type="button"
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-text-2 hover:bg-surface-2"
        aria-label={label}
        title={label}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden className="text-base">
          {syncStatusIcon(syncState, pending, rejectedItems.length)}
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
          {rejectedItems.length > 0 ? (
            <ul className="m-0 mb-2 list-none space-y-2 p-0">
              {rejectedItems.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-[11px] text-text-2"
                >
                  <div className="font-medium text-red-700">
                    {outboxKindLabel(item.kind)} — رفضه الخادم
                  </div>
                  {item.lastError ? <div>{item.lastError}</div> : null}
                  <button
                    type="button"
                    className="mt-1 text-[11px] font-semibold text-text-1 underline"
                    onClick={() => dismissRejected(item.id)}
                  >
                    إخفاء
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {pendingItems.length === 0 ? (
            rejectedItems.length === 0 ? (
              <p className="m-0 text-xs text-text-2">لا عناصر معلّقة</p>
            ) : null
          ) : (
            <ul className="m-0 max-h-56 list-none space-y-2 overflow-auto p-0">
              {pendingItems.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg bg-surface-2 px-2 py-1.5 text-[11px] text-text-2"
                >
                  <div className="font-medium text-text-1">
                    {outboxKindLabel(item.kind)}
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
  );
}
