"use client";

/**
 * Write side shared by the fee screens and tables: the busy-row marker and one
 * fee transition with its error toast (`useFeeTransition`), plus the screens'
 * ledger + billing invalidation (`useFeeLedgerWrites`).
 */
import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@platform/ui-kit";
import type {
  InspectorFeeAction,
  InspectorFeeRowDto,
} from "@platform/api-client";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { runInspectorFeeTransition } from "@platform/app-shared/app-data/inspector-fees-api";

export function useFeeTransition() {
  const { showToast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  /** Runs `action` on the row (busy while in flight); `onDone` follows a success only. */
  const runFeeTransition = async (
    row: InspectorFeeRowDto,
    action: InspectorFeeAction,
    extra: { reason?: string; disbursementVoucher?: string } | undefined,
    onDone: () => Promise<void>,
  ) => {
    setBusyId(row.workflowTaskId);
    try {
      const result = await runInspectorFeeTransition(row.workflowTaskId, {
        action,
        reason: extra?.reason,
        disbursementVoucher: extra?.disbursementVoucher,
      });
      if (!result.ok) {
        showToast(
          result.error || "تعذّر تنفيذ الإجراء — حاول مرة أخرى",
          "error",
        );
        return;
      }
      await onDone();
    } finally {
      setBusyId(null);
    }
  };

  return { showToast, busyId, setBusyId, runFeeTransition };
}

/** `useFeeTransition` + invalidating the fee ledger and the billing statements. */
export function useFeeLedgerWrites() {
  const queryClient = useQueryClient();
  const transition = useFeeTransition();

  const invalidate = useCallback(async () => {
    // Two independent keys — in parallel (async-parallel).
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: [...appDataKeys.all, "inspector-fees"],
      }),
      queryClient.invalidateQueries({
        queryKey: [...appDataKeys.all, "party-billing"],
      }),
    ]);
  }, [queryClient]);

  return { ...transition, invalidate };
}
