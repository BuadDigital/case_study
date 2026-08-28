"use client";

import { useCallback, useMemo } from "react";
import { revokeAuthSession } from "@platform/api-client";
import { clearAuthSession, getValidAuthSession } from "@platform/auth-client";
import { usePrototype } from "../contexts/PrototypeContext";

export function useAuth() {
  const {
    role,
    authReady,
    viewerEmail,
    viewerDisplayName,
    capabilities,
    hasCapability,
    rolePages,
  } = usePrototype();
  // مرجع الجلسة مستقر (كاش بالسلسلة الخام في auth-client) فيصلح كاعتمادية.
  const session = getValidAuthSession();

  const logout = useCallback(() => {
    void (async () => {
      const current = getValidAuthSession();
      const refreshToken = current?.refreshToken;
      const userId = current?.user?.id;
      try {
        const { purgeOfflineData, closeOfflineDb } = await import(
          "@platform/offline-client"
        );
        if (userId) {
          await Promise.race([
            (async () => {
              await purgeOfflineData(userId, "logout");
              await closeOfflineDb();
            })(),
            new Promise<void>((resolve) => {
              window.setTimeout(resolve, 2000);
            }),
          ]);
        }
      } catch {
        /* ignore */
      }
      if (refreshToken) void revokeAuthSession(refreshToken);
      clearAuthSession();
      window.location.assign("/login");
    })();
  }, []);

  // قيمة مستقرة الهوية — كائن جديد كل تصيير كان يكسر أي memo/dep يعتمد عليها
  // (rerender-split-combined-hooks).
  return useMemo(
    () => ({
      isAuthenticated: Boolean(session),
      authReady,
      user: session?.user ?? null,
      token: session?.token ?? null,
      expiresAtUtc: session?.expiresAtUtc ?? null,
      role,
      email: viewerEmail,
      displayName: viewerDisplayName,
      capabilities,
      hasCapability,
      rolePages,
      logout,
    }),
    [
      session,
      authReady,
      role,
      viewerEmail,
      viewerDisplayName,
      capabilities,
      hasCapability,
      rolePages,
      logout,
    ],
  );
}
