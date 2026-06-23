"use client";

import { useQuery } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { loadFieldInspectionWorkspaces } from "../lib/field-inspection-workspaces-api";

const STALE_MS = 30_000;
const GC_MS = 10 * 60_000;

export function useFieldInspectionWorkspacesQuery(enabled = true) {
  return useQuery({
    queryKey: prototypeKeys.fieldInspectionWorkspaces(),
    queryFn: loadFieldInspectionWorkspaces,
    enabled,
    staleTime: STALE_MS,
    gcTime: GC_MS,
  });
}
