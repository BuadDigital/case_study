"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  clearAuthSession,
  getValidAuthSession,
  setAuthSession,
} from "@platform/auth-client";
import { PanelSkeleton } from "@platform/design-system";

/**
 * App gate: requires a valid JWT from the login page.
 * Syncs auth cookie for middleware and shows skeleton while checking.
 */
export function PrototypeAppGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const session = getValidAuthSession();

  useEffect(() => {
    if (session) {
      setAuthSession(session);
      return;
    }
    clearAuthSession();
    router.replace("/login");
  }, [router, session]);

  if (!session) return <PanelSkeleton className="min-h-svh" />;
  return <>{children}</>;
}
