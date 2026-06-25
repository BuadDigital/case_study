"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { loadInspectorFeesSummary } from "@platform/app-shared/prototype/inspector-fees-api";
import { runInspectorFeeBatchTransition,
  runInspectorFeeTransition,
} from "@platform/app-shared/prototype/inspector-fees-api";
import { pushNotification } from "@platform/app-shared";
import { FeeActionReasonModal } from "@platform/app-shared/fees/FeeActionReasonModal";
import {
  groupInspectorFeesByParty,
  resolvePartyCategory,
  resolvePartyName,
} from "@platform/app-shared/fees/party-fee-meta";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import {
  Badge,
  Button,
  EmptyState,
  SkeletonTableRows,
  SubpageHeader,
  SubpagePanel,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  cn,
  pageToolbarClassName,
} from "@platform/design-system";
import type { InspectorFeeAction, InspectorFeeRowDto } from "@platform/api-client";
import {
  inspectorFeeStatusLabel,
  inspectorFeeStatusTone,
  inspectorFeeWorkStatusTone,
} from "@platform/api-client";

export function FinancePartyDisburse() {
  const queryClient = useQueryClient();
  const [selectedParty, setSelectedParty] = useState<string | null>(null);
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];

  const { data, isPending } = useQuery({
    queryKey: [...prototypeKeys.all, "inspector-fees", "finance-disburse"],
    queryFn: () =>
      loadInspectorFeesSummary({
        submittedOnly: false,
        billingStatus: undefined,
      }),
  });

  const parties = useMemo(() => {
    const rows = (data?.rows ?? []).filter(
      (r) =>
        r.workStatus !== "cancelled" &&
        r.billingStatus !== "disbursed" &&
        r.billingStatus !== "draft" &&
        r.billingStatus !== "sup-review",
    );
    return groupInspectorFeesByParty(rows, staffUsers);
  }, [data?.rows, staffUsers]);

  const activeParty = parties.find((p) => p.assigneeId === selectedParty) ?? null;

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: [...prototypeKeys.all, "inspector-fees"],
    });
  }, [queryClient]);

  if (isPending) {
    return (
      <SubpagePanel>
        <SubpageHeader title="صرف الالتزامات (حسب الطرف)" />
        <Table pending>
          <TBody>
            <SkeletonTableRows rows={4} cols={7} />
          </TBody>
        </Table>
      </SubpagePanel>
    );
  }

  if (!activeParty) {
    return (
      <SubpagePanel>
        <SubpageHeader title="صرف الالتزامات (حسب الطرف)" />
        <p className="mb-3 text-xs text-text-3">
          فهرس الأطراف — ادخل لتنفيذ الصرف أو الإرجاع/الاستفسار.
        </p>
        {parties.length === 0 ? (
          <EmptyState line="لا التزامات معلقة حالياً." />
        ) : (
          <Table>
            <THead>
              <Tr hoverable={false}>
                <Th>الطرف</Th>
                <Th>الفئة</Th>
                <Th>العقارات</Th>
                <Th>ضمن أمر صرف</Th>
                <Th>مُعاد/استفسار</Th>
                <Th className="text-end">المستحق (صافي)</Th>
                <Th />
              </Tr>
            </THead>
            <TBody>
              {parties.map((party) => {
                const disbReq = party.rows.filter(
                  (r) => r.billingStatus === "disb-req",
                ).length;
                const returned = party.rows.filter((r) =>
                  ["returned", "inquiry"].includes(r.billingStatus),
                ).length;
                const due = party.rows.reduce((s, r) => s + r.netFeeSar, 0);
                return (
                  <Tr key={party.assigneeId} hoverable={false}>
                    <Td className="font-medium">{party.name}</Td>
                    <Td className="text-text-2">{party.category}</Td>
                    <Td>{party.rows.length}</Td>
                    <Td>
                      {disbReq > 0 ? (
                        <Badge tone="info">{disbReq}</Badge>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>
                      {returned > 0 ? (
                        <Badge tone="danger">{returned}</Badge>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="text-end tabular-nums">
                      {due.toLocaleString("ar-SA")} ر.س
                    </Td>
                    <Td>
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        onClick={() => setSelectedParty(party.assigneeId)}
                      >
                        دخول
                      </Button>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        )}
      </SubpagePanel>
    );
  }

  const dueNet = activeParty.rows.reduce((s, r) => s + r.netFeeSar, 0);

  return (
    <SubpagePanel>
      <div className={cn(pageToolbarClassName, "mb-3 rounded-[var(--radius-lg)]")}>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setSelectedParty(null)}
        >
          رجوع لفهرس الأطراف
        </Button>
        <span className="text-sm font-semibold text-text">
          {resolvePartyName(activeParty.assigneeId, staffUsers)}
        </span>
        <span className="text-xs text-text-3">
          {resolvePartyCategory(
            activeParty.assigneeId,
            activeParty.rows,
            staffUsers,
          )}
        </span>
        <span className="mr-auto text-xs text-text-2">
          المستحق: {dueNet.toLocaleString("ar-SA")} ر.س
        </span>
      </div>
      <FinancePartyDetailTable
        rows={activeParty.rows}
        onChanged={() => void invalidate()}
      />
    </SubpagePanel>
  );
}

type ReasonModalState =
  | { kind: "return"; row: InspectorFeeRowDto }
  | { kind: "inquiry"; row: InspectorFeeRowDto }
  | null;

function FinancePartyDetailTable({
  rows,
  onChanged,
}: {
  rows: InspectorFeeRowDto[];
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reasonModal, setReasonModal] = useState<ReasonModalState>(null);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const batchA = a.disbursementBatchId ?? "";
      const batchB = b.disbursementBatchId ?? "";
      if (batchA && batchB && batchA !== batchB) return batchA.localeCompare(batchB);
      if (batchA && !batchB) return -1;
      if (!batchA && batchB) return 1;
      return a.propertyLabel.localeCompare(b.propertyLabel, "ar");
    });
  }, [rows]);

  const disbReqRows = sortedRows.filter((r) => r.billingStatus === "disb-req");
  const selectedDisbReq = disbReqRows.filter((r) =>
    selected.has(r.workflowTaskId),
  );

  const toggle = (id: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const act = async (
    row: InspectorFeeRowDto,
    action: InspectorFeeAction,
    extra?: { reason?: string },
  ) => {
    setBusyId(row.workflowTaskId);
    try {
      const result = await runInspectorFeeTransition(row.workflowTaskId, {
        action,
        reason: extra?.reason,
      });
      if (result) onChanged();
    } finally {
      setBusyId(null);
    }
  };

  const bulkDisburse = async () => {
    const ids = selectedDisbReq.map((r) => r.workflowTaskId);
    if (ids.length === 0) return;
    setBusyId("bulk");
    try {
      const result = await runInspectorFeeBatchTransition({
        workflowTaskIds: ids,
        action: "disburse",
      });
      if (result) {
        if (result.succeeded.length > 0) {
          pushNotification({
            title: "تم الصرف",
            body: `صُرف ${result.succeeded.length} عقار بنجاح.`,
            tone: "success",
            category: "financial",
            href: "/financial",
            sourceEvent: "financial-disburse-success",
          });
        }
        if (result.failed.length > 0) {
          pushNotification({
            title: "تعذر صرف بعض العقارات",
            body: result.failed.map((f) => f.error).join(" · "),
            tone: "warn",
            category: "financial",
            href: "/financial",
            sourceEvent: "financial-disburse-failed",
          });
        }
        setSelected(new Set());
        onChanged();
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className={cn(pageToolbarClassName, "mb-3 rounded-[var(--radius-lg)]")}>
        <span className="text-xs text-text-2">
          {selectedDisbReq.length > 0
            ? `محدّد: ${selectedDisbReq.length}`
            : "حدّد «ضمن أمر صرف» للصرف الجماعي"}
        </span>
        <Button
          type="button"
          size="sm"
          variant="primary"
          disabled={busyId === "bulk" || selectedDisbReq.length === 0}
          onClick={() => void bulkDisburse()}
        >
          صرف الدفعة
        </Button>
      </div>

      <Table>
        <THead>
          <Tr hoverable={false}>
            <Th className="w-10" />
            <Th>المعاملة</Th>
            <Th className="text-end">الصافي</Th>
            <Th>حالة العمل</Th>
            <Th>حالة الدفع</Th>
            <Th>أمر الصرف</Th>
            <Th>إجراء</Th>
          </Tr>
        </THead>
        <TBody>
          {sortedRows.map((row) => (
            <Tr key={row.workflowTaskId} hoverable={false}>
              <Td>
                {row.billingStatus === "disb-req" ? (
                  <input
                    type="checkbox"
                    checked={selected.has(row.workflowTaskId)}
                    onChange={(e) =>
                      toggle(row.workflowTaskId, e.target.checked)
                    }
                  />
                ) : null}
              </Td>
              <Td className="font-medium">{row.propertyLabel}</Td>
              <Td className="text-end tabular-nums">
                {row.netFeeSar.toLocaleString("ar-SA")} ر.س
              </Td>
              <Td>
                <Badge tone={inspectorFeeWorkStatusTone(row.workStatus)}>
                  {row.workStatusLabel}
                </Badge>
              </Td>
              <Td>
                <Badge tone={inspectorFeeStatusTone(row.billingStatus)}>
                  {row.billingStatusLabel ||
                    inspectorFeeStatusLabel(row.billingStatus)}
                </Badge>
              </Td>
              <Td className="text-[10px] text-text-3">
                {row.disbursementBatchId
                  ? row.disbursementBatchId.slice(0, 8)
                  : "—"}
              </Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {row.billingStatus === "disb-req" ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      disabled={busyId === row.workflowTaskId}
                      onClick={() => void act(row, "disburse")}
                    >
                      صرف
                    </Button>
                  ) : null}
                  {row.billingStatus === "at-finance" ||
                  row.billingStatus === "disb-req" ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busyId === row.workflowTaskId}
                        onClick={() =>
                          setReasonModal({ kind: "return", row })
                        }
                      >
                        إرجاع للمشرف
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busyId === row.workflowTaskId}
                        onClick={() =>
                          setReasonModal({ kind: "inquiry", row })
                        }
                      >
                        استفسار للمكتب
                      </Button>
                    </>
                  ) : null}
                </div>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>

      <FeeActionReasonModal
        open={reasonModal !== null}
        title={
          reasonModal?.kind === "inquiry"
            ? "استفسار للمكتب"
            : "إرجاع للمشرف"
        }
        label={
          reasonModal?.kind === "inquiry" ? "نص الاستفسار" : "سبب الإرجاع"
        }
        confirmLabel="تأكيد"
        onClose={() => setReasonModal(null)}
        onConfirm={async (reason) => {
          if (!reasonModal) return;
          await act(
            reasonModal.row,
            reasonModal.kind === "inquiry"
              ? "inquiry-to-office"
              : "return-to-supervisor",
            { reason },
          );
        }}
      />
    </>
  );
}
