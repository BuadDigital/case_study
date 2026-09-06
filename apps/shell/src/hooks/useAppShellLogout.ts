"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { clearAuthSession, getAuthSession } from "@platform/auth-client";
import { revokeAuthSession } from "@platform/api-client";
import { closeOfflineDb, countPendingOutbox, purgeOfflineData } from "@platform/offline-client";
import { unsubscribeFromPushSafe } from "@/lib/push-logout";

/**
 * Logout from the profile menu: warn about an unsynced outbox, then fire the
 * best-effort teardown (push, refresh token, offline store) and leave hard.
 */
export function useAppShellLogout(): () => Promise<void> {
  const queryClient = useQueryClient();

  return useCallback(async (): Promise<void> => {
    const session = getAuthSession();
    const userId = session?.user?.id;
    if (userId) {
      try {
        const pending = await Promise.race([
          countPendingOutbox(userId),
          new Promise<number>((resolve) => {
            window.setTimeout(() => resolve(0), 800);
          }),
        ]);
        if (pending > 0) {
          const proceed = window.confirm(
            `هناك ${pending} عناصر لم تُرفع بعد. أبقِ النظام مفتوحاً حتى تكتمل.\nهل تريد تسجيل الخروج على أي حال؟`,
          );
          if (!proceed) return;
        }
      } catch {
        /* continue logout */
      }
    }

    // Network / push / IDB must not block leaving — fire best-effort then navigate hard.
    void unsubscribeFromPushSafe();
    if (session?.refreshToken) {
      void revokeAuthSession(session.refreshToken);
    }
    if (userId) {
      void (async () => {
        try {
          await Promise.race([
            (async () => {
              await purgeOfflineData(userId, "logout");
              await closeOfflineDb();
            })(),
            new Promise<void>((resolve) => {
              window.setTimeout(resolve, 2000);
            }),
          ]);
        } catch {
          /* ignore */
        }
      })();
    }

    clearAuthSession();
    queryClient.clear();
    // Soft router.replace can stall behind hung fetches on localhost.
    window.location.assign("/login");
  }, [queryClient]);
}
