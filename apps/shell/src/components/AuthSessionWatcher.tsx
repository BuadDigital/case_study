"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  getAuthSession,
  isRefreshTokenExpired,
  isSessionExpired,
  notifyAuthExpired,
  subscribeAuthExpired,
} from "@platform/auth-client";
import {
  ensureFreshAuthSession,
  evaluateOfflineLease,
  isOfflineCapableRole,
} from "@platform/app-shared";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { beginOfflineLease } from "@platform/offline-client";

const CHECK_INTERVAL_MS = 30_000;

/**
 * Keeps the access token renewed. For field roles, network failures during
 * offline work start a 3-hour offline lease instead of immediate logout.
 */
export function AuthSessionWatcher() {
  const router = useRouter();
  const { role } = usePrototype();

  useEffect(() => {
    const redirect = () => router.replace("/login");
    const unsubscribe = subscribeAuthExpired(redirect);

    let running = false;
    const check = async () => {
      if (running) return;
      running = true;
      try {
        const session = await ensureFreshAuthSession();
        if (session) return;

        const stored = getAuthSession();
        const offlineCapable = isOfflineCapableRole(role);
        const networkDown =
          typeof navigator !== "undefined" && navigator.onLine === false;

        if (
          offlineCapable &&
          stored &&
          !isRefreshTokenExpired(stored) &&
          (networkDown || isSessionExpired(stored))
        ) {
          await beginOfflineLease(stored.user.id);
          const lease = await evaluateOfflineLease();
          if (lease?.locked) {
            notifyAuthExpired();
          }
          return;
        }

        notifyAuthExpired();
      } finally {
        running = false;
      }
    };

    const timer = window.setInterval(() => void check(), CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      unsubscribe();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, role]);

  return null;
}
