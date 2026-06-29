"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { PanelSkeleton } from "@platform/design-system";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import {
  canAccessPathname,
  defaultLandingPath,
  pageIdFromPathname,
} from "@platform/app-shared/prototype/page-access";

/** Redirects to the user's first allowed page when they lack permission for the current route. */
export function PageAccessGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const { rolePages, authReady } = usePrototype();

  useEffect(() => {
    if (!authReady) return;

    const pageId = pageIdFromPathname(pathname);
    if (pageId === null) return;
    if (!canAccessPathname(pathname, rolePages)) {
      router.replace(defaultLandingPath(rolePages));
    }
  }, [authReady, pathname, rolePages, router]);

  if (!authReady) {
    return <PanelSkeleton className="min-h-svh" />;
  }

  return <>{children}</>;
}
