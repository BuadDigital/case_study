"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { lastWarmedOfflinePlan } from "@/lib/offline-page-cache";
import { shouldApplyUpdate, type SwUpdateMoment } from "@/lib/sw-update-policy";

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
 * Registers the service worker and applies each new build silently (: the
 * «تحديث الآن» banner is gone). The waiting worker takes over at the first moment nobody is
 * typing — right at load, on the next screen change, or when the tab goes to the background —
 * and never while offline outbox items are still pending. The new worker warms the offline
 * pages before it takes over, so a field user keeps a complete offline copy.
 */
export function ServiceWorkerRegister() {
  const pathname = usePathname();
  const waitingRef = useRef<ServiceWorker | null>(null);
  /** First install also fires controllerchange (clients.claim) — only reload for an accepted update. */
  const reloadOnControllerChangeRef = useRef(false);
  const applyingRef = useRef(false);
  /** The screen the update became ready on — a change of it is the "navigation" moment. */
  const readyOnPathRef = useRef<string | null>(null);

  const tryApply = (moment: SwUpdateMoment) => {
    const waiting = waitingRef.current;
    if (!waiting || applyingRef.current) return;
    if (!shouldApplyUpdate({ moment, pendingOfflineItems: readPendingCount() })) return;
    applyingRef.current = true;
    reloadOnControllerChangeRef.current = true;
    const plan = lastWarmedOfflinePlan();
    void (async () => {
      if (plan && plan.urls.length > 0) {
        await new Promise<void>((resolve) => {
          const done = () => {
            navigator.serviceWorker.removeEventListener("message", onMsg);
            resolve();
          };
          const onMsg = (event: MessageEvent) => {
            if (event.data?.type === "WARM_OFFLINE_PAGES_DONE") done();
          };
          navigator.serviceWorker.addEventListener("message", onMsg);
          waiting.postMessage({
            type: "WARM_OFFLINE_PAGES",
            urls: plan.urls,
            landing: plan.landing,
          });
          window.setTimeout(done, 15_000);
        });
      }
      waiting.postMessage({ type: "SKIP_WAITING" });
    })();
  };
  const tryApplyRef = useRef(tryApply);
  useEffect(() => {
    tryApplyRef.current = tryApply;
  });

  useEffect(() => {
    if (!shouldRegisterServiceWorker()) return;

    let cancelled = false;
    let registration: ServiceWorkerRegistration | null = null;

    const onControllerChange = () => {
      if (cancelled || !reloadOnControllerChangeRef.current) return;
      window.location.reload();
    };

    const markReady = (worker: ServiceWorker, moment: SwUpdateMoment) => {
      waitingRef.current = worker;
      readyOnPathRef.current = window.location.pathname;
      tryApplyRef.current(moment);
    };

    const onUpdateFound = () => {
      const installing = registration?.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (installing.state !== "installed") return;
        if (!navigator.serviceWorker.controller) return;
        // Ready mid-session: wait for the next screen change or a hidden tab.
        markReady(registration?.waiting ?? installing, "hidden");
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") tryApplyRef.current("hidden");
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
            // A build that arrived while the tab was closed: nothing is on screen yet.
            markReady(reg.waiting, "load");
          }
          reg.update().catch(() => {});
        })
        .catch(() => {
          /* SW optional — app still works without installability */
        });

      navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
      document.addEventListener("visibilitychange", onVisibilityChange);
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
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  // The employee moved to another screen: the next page can be the new build.
  useEffect(() => {
    if (!waitingRef.current) return;
    if (readyOnPathRef.current === null || readyOnPathRef.current === pathname) return;
    tryApplyRef.current("navigation");
  }, [pathname]);

  return null;
}
