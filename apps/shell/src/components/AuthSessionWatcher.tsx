"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  getAuthSession,
  isRefreshTokenExpired,
  isSessionExpired,
  notifyAuthExpired,
  subscribeAuthExpired,
} from "@platform/auth-client";
import { ensureFreshAuthSession } from "@platform/app-shared/auth/ensure-fresh-session";
import {
  evaluateOfflineLease,
  isOfflineCapableRole,
} from "@platform/app-shared/offline/offline-write";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { useDocumentVisible } from "@platform/app-shared/hooks/use-document-visible";
import { beginOfflineLease } from "@platform/offline-client";

const CHECK_INTERVAL_MS = 30_000;

/**
 * Keeps the access token renewed. For field roles, network failures during
 * offline work start a 3-hour offline lease instead of immediate logout.
 */
export function AuthSessionWatcher() {
  const router = useRouter();
  const { role } = usePrototype();
  const visible = useDocumentVisible();
  const checkRef = useRef<() => void>(() => {});
  const wasVisibleRef = useRef(visible);

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

    checkRef.current = () => void check();
    const timer = window.setInterval(() => void check(), CHECK_INTERVAL_MS);

    return () => {
      unsubscribe();
      window.clearInterval(timer);
      checkRef.current = () => {};
    };
  }, [router, role]);

  // Hidden → visible only: reading visibility state would also check the session on mount.
  useEffect(() => {
    const wasVisible = wasVisibleRef.current;
    wasVisibleRef.current = visible;
    if (visible && !wasVisible) checkRef.current();
  }, [visible]);

  return null;
}
