"use client";

import { useEffect } from "react";

/** Registers `/sw.js` once on the client. Safe to mount in the root layout. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Skip noisy re-register loops under Turbopack HMR in development.
    if (process.env.NODE_ENV === "development") return;

    let cancelled = false;

    void navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        if (cancelled) return;
        reg.update().catch(() => {});
      })
      .catch(() => {
        /* SW optional — app still works without installability */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
