"use client";

import { useQuery } from "@tanstack/react-query";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { loadFieldInspectionWorkspaces } from "../lib/field-inspection-workspaces-api";

const STALE_MS = 30_000;
const GC_MS = 10 * 60_000;

export function useFieldInspectionWorkspacesQuery(enabled = true) {
  return useQuery({
    queryKey: appDataKeys.fieldInspectionWorkspaces(),
    queryFn: loadFieldInspectionWorkspaces,
    enabled,
    staleTime: STALE_MS,
    gcTime: GC_MS,
  });
}
