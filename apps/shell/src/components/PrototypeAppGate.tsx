"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { hasAuthSession } from "@platform/auth-client";

/**
 * App gate: requires a valid JWT from the login page.
 * Always starts as null on first render so SSR and client HTML match.
 * The useEffect resolves synchronously (no async work) so the flash is
 * a single invisible commit before children appear.
 */
export function PrototypeAppGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (hasAuthSession()) {
      setOk(true);
    } else {
      router.replace("/login");
      setOk(false);
    }
  }, [router]);

  if (ok === null) return null;
  if (!ok) return null;
  return <>{children}</>;
}
