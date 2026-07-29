"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  clearAuthSession,
  setAuthSession,
  subscribeAuthExpired,
  type AuthSession,
} from "@platform/auth-client";
import { ensureFreshAuthSession } from "@platform/app-shared";
import { PanelSkeleton } from "@platform/design-system";

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
