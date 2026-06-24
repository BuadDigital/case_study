"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    const session = getValidAuthSession();
    if (session) {
      setAuthSession(session);
      setOk(true);
      return;
    }
    clearAuthSession();
    router.replace("/login");
    setOk(false);
  }, [router]);

  if (ok === null) return <PanelSkeleton className="min-h-svh" />;
  if (!ok) return null;
  return <>{children}</>;
}
