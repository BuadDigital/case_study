"use client";

import { useMemo } from "react";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { countOpenFailuresForPartyRole } from "@failures/mfe";
import { useFailuresQuery } from "@/lib/query/prototype-queries";

/** Live red badge count for إدارة التعذرات in the sidebar. */
export function useFailuresNavBadge(): number {
  const { role, rolePages } = usePrototype();
  const { data: failures = [] } = useFailuresQuery();

  return useMemo(() => {
    if (!rolePages.includes("failures")) return 0;
    return countOpenFailuresForPartyRole(role, failures);
  }, [role, rolePages, failures]);
}
