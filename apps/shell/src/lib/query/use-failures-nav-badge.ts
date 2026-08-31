"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { countOpenFailuresForPartyRole } from "@failures/mfe/lib/failures-party-raiser-scope";
import type { FailureRecord } from "@platform/app-shared/failures/failures-types";
import { loadFailuresQuery } from "@failures/mfe/lib/failures-repository";

const STALE_MS = 60_000;
const GC_MS = 10 * 60_000;

/** Live red badge count for Failures management in the sidebar. */
export function useFailuresNavBadge(): number {
  const { role, rolePages } = usePrototype();
  const scoped = rolePages.includes("failures");

  const selectCount = useCallback(
    (failures: FailureRecord[]) =>
      scoped ? countOpenFailuresForPartyRole(role, failures) : 0,
    [role, scoped],
  );

  const { data } = useQuery({
    queryKey: prototypeKeys.failures(),
    queryFn: loadFailuresQuery,
    staleTime: STALE_MS,
    gcTime: GC_MS,
    select: selectCount,
  });

  return data ?? 0;
}
