"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { notifyAuthExpired, subscribeAuthExpired } from "@platform/auth-client";
import { ensureFreshAuthSession } from "@platform/app-shared";

const CHECK_INTERVAL_MS = 30_000;

/** Keeps the access token renewed and redirects to login once renewal fails. */
export function AuthSessionWatcher() {
  const router = useRouter();

  useEffect(() => {
    const redirect = () => router.replace("/login");
    const unsubscribe = subscribeAuthExpired(redirect);

    let running = false;
    const check = async () => {
      if (running) return;
      running = true;
      try {
        const session = await ensureFreshAuthSession();
        if (!session) notifyAuthExpired();
      } finally {
        running = false;
      }
    };

    const timer = window.setInterval(() => void check(), CHECK_INTERVAL_MS);
    // Timers are throttled in background tabs, so re-check as soon as one returns.
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      unsubscribe();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return null;
}
