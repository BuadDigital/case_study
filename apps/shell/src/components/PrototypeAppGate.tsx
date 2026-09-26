"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  clearAuthSession,
  getAuthSession,
  setAuthSession,
  subscribeAuthExpired,
  type AuthSession,
} from "@platform/auth-client";
import { ensureFreshAuthSession } from "@platform/app-shared/auth/ensure-fresh-session";
import { isOfflineUsableSession } from "@platform/app-shared/auth/offline-session";
import { PanelSkeleton } from "@platform/ui-kit";

/**
 * App gate: requires a valid JWT from the login page.
 * Syncs auth cookie for middleware and shows skeleton while checking.
 *
 * Session is resolved only after mount. Reading localStorage in useState/render
 * causes a server/client hydration mismatch on hard navigation (new-tab paste),
 * which can leave the shell stuck on an empty skeleton until a manual reload.
 */
export function PrototypeAppGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void ensureFreshAuthSession().then((resolved) => {
      if (cancelled) return;
      if (resolved) {
        setAuthSession(resolved);
        setSession(resolved);
        setChecked(true);
        return;
      }
      // Offline field user with a lapsed access token: keep the login (the offline
      // lease in AuthSessionWatcher bounds it) instead of wiping it and bouncing to
      // a login screen that cannot work without a network.
      const stored = getAuthSession();
      if (isOfflineUsableSession(stored)) {
        setSession(stored);
        setChecked(true);
        return;
      }
      clearAuthSession();
      setSession(null);
      setChecked(true);
      router.replace("/login");
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    return subscribeAuthExpired(() => {
      setSession(null);
      router.replace("/login");
    });
  }, [router]);

  if (!checked || !session) return <PanelSkeleton className="min-h-svh" />;
  return <>{children}</>;
}
