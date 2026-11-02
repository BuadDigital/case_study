"use client";

import { useMemo } from "react";
import { useEnabledValuationListRows } from "@platform/app-shared/query/valuation-lists-query";

/**
 * Admin-managed «أنواع الواجهات» for the inspector's facade picker.
 * `undefined` until the dictionary has loaded — see useEnabledValuationListRows.
 */
export function useFacadeOptions(): string[] | undefined {
  const rows = useEnabledValuationListRows("facades");
  return useMemo(() => rows?.map((row) => row.name.trim()), [rows]);
}
