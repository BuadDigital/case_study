"use client";

import { useQuery } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { loadInspectorFeesSummary } from "@platform/app-shared/prototype/inspector-fees-api";
import { loadPartyBillingStatements } from "@platform/app-shared/prototype/party-billing-statements-api";

export function useFinanceTabCounts() {
  const statementsQuery = useQuery({
    queryKey: [...prototypeKeys.all, "party-billing", "statements", "counts"],
    queryFn: () => loadPartyBillingStatements(),
    staleTime: 30_000,
  });

  const feesQuery = useQuery({
    queryKey: [...prototypeKeys.all, "inspector-fees", "excluded-counts"],
    queryFn: () => loadInspectorFeesSummary({ submittedOnly: false }),
    staleTime: 60_000,
  });

  const statements = statementsQuery.data ?? [];
  const feeRows = feesQuery.data?.rows ?? [];

  const excludedCount =
    feeRows.filter(
      (r) =>
        r.excludedFromBatch ||
        (r.netFeeSar === 0 && r.workStatus === "done"),
    ).length + statements.filter((s) => s.status === "cancelled").length;

  return { excludedCount };
}
