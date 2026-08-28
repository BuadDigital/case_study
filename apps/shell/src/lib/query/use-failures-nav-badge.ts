"use client";

import { useMemo } from "react";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { countOpenFailuresForPartyRole } from "@failures/mfe/lib/failures-party-raiser-scope";
import type { FailureRecord } from "@failures/mfe/lib/failures-types";
import { useFailuresQuery } from "@/lib/query/prototype-queries";

const EMPTY_FAILURES: FailureRecord[] = [];

/** Live red badge count for إدارة التعذرات in the sidebar. */
export function useFailuresNavBadge(): number {
  const { role, rolePages } = usePrototype();
  const { data: failures = EMPTY_FAILURES } = useFailuresQuery();

  return useMemo(() => {
    if (!rolePages.includes("failures")) return 0;
    return countOpenFailuresForPartyRole(role, failures);
  }, [role, rolePages, failures]);
}
