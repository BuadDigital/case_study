"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { countOpenFailuresForPartyRole } from "@failures/mfe/lib/failures-party-raiser-scope";
import type { FailureRecord } from "@platform/app-shared/failures/failures-types";
import { loadFailuresQuery } from "@failures/mfe/lib/failures-repository";

const STALE_MS = 60_000;
const GC_MS = 10 * 60_000;

/** Live red badge count for Failures management in the sidebar. */
export function useFailuresNavBadge(): number {
  const { role, rolePages } = useAppAccess();
  const scoped = rolePages.includes("failures");

  const selectCount = useCallback(
    (failures: FailureRecord[]) =>
      scoped ? countOpenFailuresForPartyRole(role, failures) : 0,
    [role, scoped],
  );

  const { data } = useQuery({
    queryKey: appDataKeys.failures(),
    queryFn: loadFailuresQuery,
    staleTime: STALE_MS,
    gcTime: GC_MS,
    select: selectCount,
  });

  return data ?? 0;
}
