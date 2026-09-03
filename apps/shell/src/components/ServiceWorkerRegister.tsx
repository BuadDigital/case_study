"use client";

import { useEffect, useRef, useState } from "react";

const PENDING_OUTBOX_EVENT = "ejada-offline-pending-changed";

function readPendingCount(): number {
  try {
    const raw = sessionStorage.getItem("ejada_offline_pending_count");
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function shouldRegisterServiceWorker(): boolean {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;
  if (process.env.NODE_ENV !== "development") return true;
  const flag = process.env.NEXT_PUBLIC_ENABLE_SW?.trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

/**
 * Registers `/sw.js` and coordinates updates.
 * Defers activation while offline outbox items are pending.
 */
export function ServiceWorkerRegister() {
  const [updateReady, setUpdateReady] = useState(false);
  const waitingRef = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    if (!shouldRegisterServiceWorker()) return;

    let cancelled = false;
    let registration: ServiceWorkerRegistration | null = null;

    const onControllerChange = () => {
      if (cancelled) return;
      window.location.reload();
    };

    const onUpdateFound = () => {
      const installing = registration?.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (installing.state !== "installed") return;
        if (!navigator.serviceWorker.controller) return;
        waitingRef.current = registration?.waiting ?? installing;
        if (readPendingCount() > 0) {
          setUpdateReady(true);
          return;
        }
        waitingRef.current?.postMessage({ type: "SKIP_WAITING" });
      });
    };

    const run = () => {
      if (cancelled) return;
      void navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((reg) => {
          if (cancelled) return;
          registration = reg;
          reg.addEventListener("updatefound", onUpdateFound);
          if (reg.waiting) {
            waitingRef.current = reg.waiting;
            setUpdateReady(true);
          }
          reg.update().catch(() => {});
        })
        .catch(() => {
          /* SW optional — app still works without installability */
        });

      navigator.serviceWorker.addEventListener(
        "controllerchange",
        onControllerChange,
      );
    };

    // Registration competes with hydration — defer it off the critical path.
    let cancelSchedule: () => void;
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(run, { timeout: 2_000 });
      cancelSchedule = () => cancelIdleCallback(id);
    } else {
      const timer = setTimeout(run, 250);
      cancelSchedule = () => clearTimeout(timer);
    }

    return () => {
      cancelled = true;
      cancelSchedule();
      registration?.removeEventListener("updatefound", onUpdateFound);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, []);

  useEffect(() => {
    const onPendingChanged = () => {
      if (!updateReady) return;
      if (readPendingCount() > 0) return;
      waitingRef.current?.postMessage({ type: "SKIP_WAITING" });
    };
    window.addEventListener(PENDING_OUTBOX_EVENT, onPendingChanged);
    return () => window.removeEventListener(PENDING_OUTBOX_EVENT, onPendingChanged);
  }, [updateReady]);

  if (!updateReady) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3 rounded-2xl border border-border-md bg-surface px-4 py-3 shadow-lg">
        <p className="m-0 text-sm text-text-1">يتوفر تحديث للتطبيق</p>
        <button
          type="button"
          className="min-h-11 rounded-xl bg-brand px-4 text-sm font-semibold text-white"
          onClick={() => {
            if (readPendingCount() > 0) {
              window.alert(
                "هناك عناصر لم تُرفع بعد. أبقِ النظام مفتوحاً حتى تكتمل المزامنة قبل التحديث.",
              );
              return;
            }
            waitingRef.current?.postMessage({ type: "SKIP_WAITING" });
          }}
        >
          تحديث الآن
        </button>
      </div>
    </div>
  );
}
