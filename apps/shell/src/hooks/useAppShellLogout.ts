"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { clearAuthSession, getAuthSession } from "@platform/auth-client";
import { revokeAuthSession } from "@platform/api-client";
import { closeOfflineDb, countPendingOutbox, purgeOfflineData } from "@platform/offline-client";
import { unsubscribeFromPushSafe } from "@/lib/push-logout";

/**
 * Logout from the profile menu: warn about an unsynced outbox, keep encrypted
 * unsynced rows unless the queue is empty, then leave.
 */
export function useAppShellLogout(): () => Promise<void> {
  const queryClient = useQueryClient();

  return useCallback(async (): Promise<void> => {
    const session = getAuthSession();
    const userId = session?.user?.id;
    let keepUnsynced = false;
    if (userId) {
      try {
        const pending = await Promise.race([
          countPendingOutbox(userId),
          new Promise<number>((resolve) => {
            window.setTimeout(() => resolve(-1), 800);
          }),
        ]);
        if (pending !== 0) {
          const proceed = window.confirm(
            pending > 0
              ? `هناك ${pending} عناصر لم تُرفع بعد. أبقِ النظام مفتوحاً حتى تكتمل.\nهل تريد تسجيل الخروج على أي حال؟ البيانات المعلّقة تبقى مشفّرة على الجهاز.`
              : `تعذّر التأكد من عناصر المزامنة. قد تكون هناك بيانات لم تُرفع بعد.\nهل تريد تسجيل الخروج على أي حال؟`,
          );
          if (!proceed) return;
          keepUnsynced = true;
        }
      } catch {
        keepUnsynced = true;
        const proceed = window.confirm(
          `تعذّر التأكد من عناصر المزامنة. قد تكون هناك بيانات لم تُرفع بعد.\nهل تريد تسجيل الخروج على أي حال؟`,
        );
        if (!proceed) return;
      }
    }

    void unsubscribeFromPushSafe();
    if (session?.refreshToken) {
      void revokeAuthSession(session.refreshToken);
    }
    if (userId && !keepUnsynced) {
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
    }

    clearAuthSession();
    queryClient.clear();
    window.location.assign("/login");
  }, [queryClient]);
}
