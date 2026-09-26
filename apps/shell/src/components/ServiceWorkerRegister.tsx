"use client";

import { useEffect, useRef, useState } from "react";

/** Set per build in next.config — a new value installs a fresh worker with fresh caches. */
const SW_URL = `/sw.js?v=${encodeURIComponent(
  process.env.NEXT_PUBLIC_SW_VERSION ?? "dev",
)}`;

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
 * Registers the service worker and offers each new build through a banner.
 * The page reloads only after the user accepts, so a deploy never interrupts a form,
 * and never while offline outbox items are still pending.
 */
export function ServiceWorkerRegister() {
  const [updateReady, setUpdateReady] = useState(false);
  const waitingRef = useRef<ServiceWorker | null>(null);
  /** First install also fires controllerchange (clients.claim) — only reload for an accepted update. */
  const reloadOnControllerChangeRef = useRef(false);

  useEffect(() => {
    if (!shouldRegisterServiceWorker()) return;

    let cancelled = false;
    let registration: ServiceWorkerRegistration | null = null;

    const onControllerChange = () => {
      if (cancelled || !reloadOnControllerChangeRef.current) return;
      window.location.reload();
    };

    const onUpdateFound = () => {
      const installing = registration?.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (installing.state !== "installed") return;
        if (!navigator.serviceWorker.controller) return;
        waitingRef.current = registration?.waiting ?? installing;
        setUpdateReady(true);
      });
    };

    const run = () => {
      if (cancelled) return;
      void navigator.serviceWorker
        .register(SW_URL, { scope: "/", updateViaCache: "none" })
        .then((reg) => {
          if (cancelled) return;
          registration = reg;
          reg.addEventListener("updatefound", onUpdateFound);
          if (reg.waiting && navigator.serviceWorker.controller) {
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
            reloadOnControllerChangeRef.current = true;
            waitingRef.current?.postMessage({ type: "SKIP_WAITING" });
          }}
        >
          تحديث الآن
        </button>
      </div>
    </div>
  );
}
