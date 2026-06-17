"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { pageIdFromPathname } from "@platform/app-shared/prototype/page-access";

/**
 * Redirects to dashboard when the signed-in user lacks API permission for the current route.
 */
export function PageAccessGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { rolePages, authReady } = usePrototype();

  useEffect(() => {
    if (!authReady) return;

    const pageId = pageIdFromPathname(pathname);
    if (pageId === null) return;
    if (pageId === "dashboard") return;
    if (!rolePages.includes(pageId)) {
      router.replace("/dashboard");
    }
  }, [authReady, pathname, rolePages, router]);

  return <>{children}</>;
}
