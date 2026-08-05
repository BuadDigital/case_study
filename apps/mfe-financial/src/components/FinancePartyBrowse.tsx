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
  finCard,
  finEmpty,
  finEmptyT,
  finKpi,
  finKpiCell,
  finKpiCellFirst,
  finKpiLbl,
  finKpiNum,
} from "../lib/finance-tw";

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

  const allRows = data?.rows ?? [];
  const kpi = useMemo(() => {
    const ready = allRows.filter(
      (r) =>
        r.workStatus === "done" &&
        (r.billingStatus === "at-finance" || r.billingStatus === "disb-req"),
    ).length;
    const disbursed = allRows.filter(
      (r) => r.billingStatus === "disbursed",
    ).length;
    return {
      parties: parties.length,
      ready,
      disbursed,
      total: allRows.length,
    };
  }, [allRows, parties.length]);

  const activeAssigneeId =
    selectedAssigneeId ?? parties[0]?.assigneeId ?? null;
  const activeParty = parties.find((p) => p.assigneeId === activeAssigneeId);

  if (isPending) {
    return (
      <div className={finCard}>
        <div className={finEmpty}>
          <div className={finEmptyT}>جاري التحميل…</div>
        </div>
      </div>
    );
  }

  if (!activeParty) {
    return (
      <div className={finCard}>
        <div className={finEmpty}>
          <div className={finEmptyT}>لا مستحقين لعرض معاملاتهم.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className={finKpi}>
        <div className={finKpiCellFirst}>
          <div className={finKpiLbl}>المستحقون</div>
          <div className={finKpiNum}>{kpi.parties}</div>
        </div>
        <div className={finKpiCell}>
          <div className={finKpiLbl}>جاهز للصرف</div>
          <div className={finKpiNum}>{kpi.ready}</div>
        </div>
        <div className={finKpiCell}>
          <div className={finKpiLbl}>مصروفة</div>
          <div className={finKpiNum}>{kpi.disbursed}</div>
        </div>
        <div className={finKpiCell}>
          <div className={finKpiLbl}>إجمالي البنود</div>
          <div className={finKpiNum}>{kpi.total}</div>
        </div>
      </div>

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
        variant="finance"
      />
    </div>
  );
}
