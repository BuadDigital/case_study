"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import {
  loadPartyBillingReadyLines,
  loadPartyBillingStatements,
} from "@platform/app-shared/app-data/party-billing-statements-api";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import { buildFinanceCostParties } from "../lib/finance-cost-parties";

const EMPTY_STAFF_USERS: StaffUser[] = [];

/**
 * Every ready line and every statement, unpaged, grouped by payee. A payee row is an
 * aggregate — its balance sums the payee's whole ledger, and a payee with no ready line
 * still appears through its statements — so neither list can be paged. `scope` keeps the
 * parties list and the account screen on their own cache entries, as before.
 */
export function useFinanceCostParties(scope: "parties" | "account") {
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? EMPTY_STAFF_USERS;
  const readyQuery = useQuery({
    queryKey: [...appDataKeys.partyBilling(), "ready-lines", scope],
    queryFn: () => loadPartyBillingReadyLines(),
    staleTime: 20_000,
  });
  const statementsQuery = useQuery({
    queryKey: [...appDataKeys.partyBilling(), "statements", scope],
    queryFn: () => loadPartyBillingStatements(),
    staleTime: 20_000,
  });
  const parties = useMemo(
    () =>
      buildFinanceCostParties({
        readyLines: readyQuery.data ?? [],
        statements: statementsQuery.data ?? [],
        staffUsers,
      }),
    [readyQuery.data, statementsQuery.data, staffUsers],
  );
  return { readyQuery, statementsQuery, parties, staffUsers };
}
