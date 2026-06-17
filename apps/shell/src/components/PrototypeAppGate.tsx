"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import { hasAuthSession } from "@platform/auth-client";
import { bootstrapPrototypeAuth } from "@/lib/prototype/prototype-auth";

/**
 * App gate: requires a valid JWT from the login page.
 */
export function PrototypeAppGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState<boolean | null>(() =>
    hasAuthSession() ? true : null,
  );

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const booted = await bootstrapPrototypeAuth();
      if (cancelled) return;

      if (booted || hasAuthSession()) {
        setOk(true);
        return;
      }

      router.replace("/login");
      setOk(false);
    }

    startTransition(() => {
      void run();
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (ok === null) {
    return null;
  }
  if (!ok) return null;
  return <>{children}</>;
}
