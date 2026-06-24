"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { loadInspectorFeesSummary } from "@platform/app-shared/prototype/inspector-fees-api";
import { PartyPropertyBrowse } from "@platform/app-shared/fees/PartyPropertyBrowse";
import {
  groupInspectorFeesByParty,
  resolvePartyCategory,
  resolvePartyName,
} from "@platform/app-shared/fees/party-fee-meta";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import {
  EmptyState,
  SkeletonTableRows,
  SubpagePanel,
  Table,
  TBody,
} from "@platform/design-system";

export function FinancePartyBrowse() {
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(
    null,
  );
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];

  const { data, isPending } = useQuery({
    queryKey: [...prototypeKeys.all, "inspector-fees", "finance-browse"],
    queryFn: () =>
      loadInspectorFeesSummary({
        submittedOnly: false,
      }),
  });

  const parties = useMemo(
    () => groupInspectorFeesByParty(data?.rows ?? [], staffUsers),
    [data?.rows, staffUsers],
  );

  const activeAssigneeId =
    selectedAssigneeId ?? parties[0]?.assigneeId ?? null;
  const activeParty = parties.find((p) => p.assigneeId === activeAssigneeId);

  if (isPending) {
    return (
      <SubpagePanel>
        <Table pending>
          <TBody>
            <SkeletonTableRows rows={6} cols={7} />
          </TBody>
        </Table>
      </SubpagePanel>
    );
  }

  if (!activeParty) {
    return (
      <SubpagePanel>
        <EmptyState line="لا أطراف لعرض عقاراتها." />
      </SubpagePanel>
    );
  }

  return (
    <SubpagePanel>
      <PartyPropertyBrowse
        rows={activeParty.rows}
        partyName={resolvePartyName(activeParty.assigneeId, staffUsers)}
        partyCategory={resolvePartyCategory(
          activeParty.assigneeId,
          activeParty.rows,
          staffUsers,
        )}
        showPartyPicker
        parties={parties}
        selectedAssigneeId={activeAssigneeId ?? undefined}
        onSelectParty={setSelectedAssigneeId}
      />
    </SubpagePanel>
  );
}
