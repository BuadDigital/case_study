"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import { loadInspectorFeesSummary, runInspectorFeeBatchTransition, runInspectorFeeTransition } from "@platform/app-shared/prototype/inspector-fees-api";
import { pushNotification } from "@platform/app-shared";
import { FeeActionReasonModal } from "@platform/app-shared/fees/FeeActionReasonModal";
import { groupInspectorFeesByParty, resolvePartyCategory, resolvePartyName } from "@platform/app-shared/fees/party-fee-meta";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import {
  Badge,
  Button,
  EmptyState,
  Note,
  PageToolbar,
  QueueTableHint,
  SkeletonTableRows,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  cn,
  pageToolbarClassName,
  queueTableWrapClassName,
  useToast,
} from "@platform/design-system";
import type { InspectorFeeAction, InspectorFeeRowDto } from "@platform/api-client";
import { inspectorFeeStatusLabel, inspectorFeeStatusTone, inspectorFeeWorkStatusTone } from "@platform/api-client";
import { bucketFinanceDisburseRows, financeDisburseVisibleRows } from "../lib/finance-queue-stats";
import { FinanceSectionTitle, FinanceStatusSummary} from "./FinanceStatusSummary";

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
    const rows = financeDisburseVisibleRows(data?.rows ?? []);
    return groupInspectorFeesByParty(rows, staffUsers);
  }, [data?.rows, staffUsers]);

  const sortedParties = useMemo(() => {
    return [...parties].sort((a, b) => {
      const aReady = a.rows.filter((r) => r.billingStatus === "disb-req").length;
      const bReady = b.rows.filter((r) => r.billingStatus === "disb-req").length;
      if (aReady !== bReady) return bReady - aReady;
      return a.name.localeCompare(b.name, "ar");
    });
  }, [parties]);

  const queueTotals = useMemo(() => {
    const rows = financeDisburseVisibleRows(data?.rows ?? []);
    return bucketFinanceDisburseRows(rows);
  }, [data?.rows]);

  const activeParty = parties.find((p) => p.assigneeId === selectedParty) ?? null;

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: [...prototypeKeys.all, "inspector-fees"],
    });
  }, [queryClient]);

  if (isPending) {
    return (
      <Table pending>
        <TBody>
          <SkeletonTableRows rows={4} cols={7} />
        </TBody>
      </Table>
    );
  }

  if (!activeParty) {
    return (
      <div className="flex flex-col gap-3">
        <PageToolbar className="border-0 bg-surface-2/60">
          <Note tone="info" className="m-0 flex-1">
            مسار الصرف: المشرف يعتمد ← المكتب ينشئ <strong>أمر صرف</strong> من
            «الاتعاب والصرف» ← المالية تصرف من القسم «جاهز للصرف الآن» أدناه.
          </Note>
        </PageToolbar>

        <FinanceStatusSummary
          readyToDisburse={queueTotals.readyToDisburse.length}
          waitingOffice={queueTotals.waitingOffice.length}
          needsAttention={queueTotals.needsAttention.length}
        />

        {sortedParties.length === 0 ? (
          <EmptyState
            line="لا التزامات معلقة حالياً."
            hint="تظهر بعد اعتماد المشرف. الصرف الفعلي يكون فقط لصفوف «ضمن أمر صرف» بعد أن ينشئ المكتب أمر الصرف."
          />
        ) : (
          <div
            className={cn(
              queueTableWrapClassName,
              "rounded-[var(--radius-lg)] border border-border bg-surface",
            )}
          >
            <Table>
              <THead>
                <Tr hoverable={false}>
                  <Th>الطرف</Th>
                  <Th>الفئة</Th>
                  <Th>العقارات</Th>
                  <Th>جاهز للصرف</Th>
                  <Th>بانتظار المكتب</Th>
                  <Th className="text-end">المستحق (صافي)</Th>
                  <Th />
                </Tr>
              </THead>
              <TBody>
                {sortedParties.map((party) => {
                  const ready = party.rows.filter(
                    (r) => r.billingStatus === "disb-req",
                  ).length;
                  const waiting = party.rows.filter(
                    (r) => r.billingStatus === "at-finance",
                  ).length;
                  const due = party.rows.reduce((s, r) => s + r.netFeeSar, 0);
                  return (
                    <Tr
                      key={party.assigneeId}
                      hoverable={false}
                      className={ready > 0 ? "bg-success-bg/30" : undefined}
                    >
                      <Td className="font-medium">{party.name}</Td>
                      <Td className="text-text-2">{party.category}</Td>
                      <Td>{party.rows.length}</Td>
                      <Td>
                        {ready > 0 ? (
                          <Badge tone="success">{ready}</Badge>
                        ) : (
                          <span className="text-text-3">—</span>
                        )}
                      </Td>
                      <Td>
                        {waiting > 0 ? (
                          <Badge tone="info">{waiting}</Badge>
                        ) : (
                          <span className="text-text-3">—</span>
                        )}
                      </Td>
                      <Td className="text-end tabular-nums">
                        {due.toLocaleString("ar-SA")} ر.س
                      </Td>
                      <Td>
                        <Button
                          type="button"
                          size="sm"
                          variant={ready > 0 ? "primary" : "outline"}
                          onClick={() => setSelectedParty(party.assigneeId)}
                        >
                          {ready > 0 ? "صرف الآن" : "مراجعة"}
                        </Button>
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </div>
        )}

        {queueTotals.waitingOffice.length > 0 &&
        queueTotals.readyToDisburse.length === 0 ? (
          <Note tone="warn">
            يوجد {queueTotals.waitingOffice.length} عقار «جاهز للصرف لدى المالية»
            لكن لا يمكن صرفه بعد — المكتب لم يُنشئ أمر صرف. اطلب من الطرف فتح
            «الاتعاب والصرف → طلب صرف».
          </Note>
        ) : null}

        <QueueTableHint className="px-0">
          الأطراف ذات شارة «جاهز للصرف» يمكن صرفها فوراً. الباقي بانتظار إجراء
          المكتب.
        </QueueTableHint>
      </div>
    );
  }

  const buckets = bucketFinanceDisburseRows(activeParty.rows);
  const dueNet = activeParty.rows.reduce((s, r) => s + r.netFeeSar, 0);
  const readyNet = buckets.readyToDisburse.reduce((s, r) => s + r.netFeeSar, 0);

  return (
    <div className="flex flex-col gap-3">
      <PageToolbar className="rounded-[var(--radius-lg)] border border-border bg-surface">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setSelectedParty(null)}
        >
          ← فهرس الأطراف
        </Button>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-text">
            {resolvePartyName(activeParty.assigneeId, staffUsers)}
          </div>
          <div className="text-[11px] text-text-3">
            {resolvePartyCategory(
              activeParty.assigneeId,
              activeParty.rows,
              staffUsers,
            )}
          </div>
        </div>
        <div className="text-end text-xs text-text-2">
          <div>
            المستحق الكلي:{" "}
            <span className="font-semibold tabular-nums text-text">
              {dueNet.toLocaleString("ar-SA")} ر.س
            </span>
          </div>
          {buckets.readyToDisburse.length > 0 ? (
            <div className="text-success">
              قابل للصرف: {readyNet.toLocaleString("ar-SA")} ر.س
            </div>
          ) : null}
        </div>
      </PageToolbar>

      <FinanceStatusSummary
        readyToDisburse={buckets.readyToDisburse.length}
        waitingOffice={buckets.waitingOffice.length}
        needsAttention={buckets.needsAttention.length}
      />

      <FinancePartyDetailSections
        buckets={buckets}
        onChanged={() => void invalidate()}
      />
    </div>
  );
}

type ReasonModalState =
  | { kind: "return"; row: InspectorFeeRowDto }
  | { kind: "inquiry"; row: InspectorFeeRowDto }
  | null;

function FinancePartyDetailSections({
  buckets,
  onChanged,
}: {
  buckets: ReturnType<typeof bucketFinanceDisburseRows>;
  onChanged: () => void;
}) {
  const { showToast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reasonModal, setReasonModal] = useState<ReasonModalState>(null);

  const { readyToDisburse, waitingOffice, needsAttention } = buckets;
  const selectedRows = readyToDisburse.filter((r) =>
    selected.has(r.workflowTaskId),
  );
  const selectedTotal = selectedRows.reduce((s, r) => s + r.netFeeSar, 0);

  const toggle = (id: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectAllReady = () => {
    setSelected(new Set(readyToDisburse.map((r) => r.workflowTaskId)));
  };

  const clearSelection = () => setSelected(new Set());

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
      if (result.ok) {
        onChanged();
        return;
      }
      showToast(result.error ?? "تعذّر تنفيذ الإجراء — حاول مرة أخرى", "error");
    } finally {
      setBusyId(null);
    }
  };

  const bulkDisburse = async () => {
    const ids = selectedRows.map((r) => r.workflowTaskId);
    if (ids.length === 0) return;
    setBusyId("bulk");
    try {
      const result = await runInspectorFeeBatchTransition({
        workflowTaskIds: ids,
        action: "disburse",
      });
      if (result.ok) {
        if (result.data.succeeded.length > 0) {
          pushNotification({
            title: "تم الصرف",
            body: `صُرف ${result.data.succeeded.length} عقار بنجاح.`,
            tone: "success",
            category: "financial",
            href: "/financial",
            sourceEvent: "financial-disburse-success",
          });
        }
        if (result.data.failed.length > 0) {
          pushNotification({
            title: "تعذر صرف بعض العقارات",
            body: result.data.failed.map((f) => f.error).join(" · "),
            tone: "warn",
            category: "financial",
            href: "/financial",
            sourceEvent: "financial-disburse-failed",
          });
        }
        setSelected(new Set());
        onChanged();
        return;
      }
      showToast(result.error ?? "تعذّر تنفيذ الصرف — حاول مرة أخرى", "error");
    } finally {
      setBusyId(null);
    }
  };

  const hasAny =
    readyToDisburse.length + waitingOffice.length + needsAttention.length > 0;

  if (!hasAny) {
    return <EmptyState line="لا معاملات لهذا الطرف حالياً." />;
  }

  return (
    <>
      {readyToDisburse.length > 0 ? (
        <section>
          <FinanceSectionTitle
            title="جاهز للصرف الآن"
            count={readyToDisburse.length}
            hint="هذه المعاملات ضمن أمر صرف — يمكنك تحديدها وتنفيذ الصرف."
          />

          <div
            className={cn(
              pageToolbarClassName,
              "mb-2 rounded-[var(--radius-lg)] border border-success/30 bg-success-bg/20",
            )}
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-text-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={selectAllReady}
                disabled={selectedRows.length === readyToDisburse.length}
              >
                تحديد الكل
              </Button>
              {selectedRows.length > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={clearSelection}
                >
                  إلغاء التحديد
                </Button>
              ) : null}
              <span className="text-text-3">|</span>
              <span>
                المحدّد: <strong>{selectedRows.length}</strong>
                {selectedRows.length > 0 ? (
                  <>
                    {" "}
                    ·{" "}
                    <strong className="tabular-nums">
                      {selectedTotal.toLocaleString("ar-SA")} ر.س
                    </strong>
                  </>
                ) : null}
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="primary"
              disabled={busyId === "bulk" || selectedRows.length === 0}
              onClick={() => void bulkDisburse()}
            >
              صرف الدفعة
            </Button>
          </div>

          <FinanceDisburseTable
            rows={readyToDisburse}
            mode="disburse"
            busyId={busyId}
            selected={selected}
            onToggle={toggle}
            onDisburse={(row) => void act(row, "disburse")}
            onReturn={(row) => setReasonModal({ kind: "return", row })}
            onInquiry={(row) => setReasonModal({ kind: "inquiry", row })}
          />
        </section>
      ) : null}

      {waitingOffice.length > 0 ? (
        <section className={readyToDisburse.length > 0 ? "mt-5" : undefined}>
          <FinanceSectionTitle
            title="بانتظار أمر صرف من المكتب"
            count={waitingOffice.length}
            hint="المشرف اعتمد هذه الأتعاب لكن المكتب لم يُنشئ أمر صرف بعد — لا يمكن الصرف من هنا."
          />
          <Note tone="warn" className="mb-2">
            لصرف هذه العقارات: يجب على المكتب/المعاين فتح «الاتعاب والصرف → طلب
            صرف» واختيارها ثم «إنشاء أمر صرف واعتماده». بعدها تنتقل تلقائياً
            إلى قسم «جاهز للصرف الآن».
          </Note>
          <FinanceDisburseTable
            rows={waitingOffice}
            mode="review"
            busyId={busyId}
            selected={selected}
            onToggle={toggle}
            onDisburse={() => {}}
            onReturn={(row) => setReasonModal({ kind: "return", row })}
            onInquiry={(row) => setReasonModal({ kind: "inquiry", row })}
          />
        </section>
      ) : null}

      {needsAttention.length > 0 ? (
        <section
          className={
            readyToDisburse.length + waitingOffice.length > 0 ? "mt-5" : undefined
          }
        >
          <FinanceSectionTitle
            title="مُعاد أو استفسار"
            count={needsAttention.length}
            hint="بانتظار معالجة المشرف أو المكتب — لا صرف حتى يُعاد رفعها."
          />
          <FinanceDisburseTable
            rows={needsAttention}
            mode="readonly"
            busyId={busyId}
            selected={selected}
            onToggle={toggle}
            onDisburse={() => {}}
            onReturn={() => {}}
            onInquiry={() => {}}
          />
        </section>
      ) : null}

      {readyToDisburse.length === 0 && waitingOffice.length > 0 ? (
        <QueueTableHint className="px-0">
          لا يوجد ما يمكن صرفه الآن — كل المعاملات بانتظار المكتب.
        </QueueTableHint>
      ) : null}

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
          setReasonModal(null);
        }}
      />
    </>
  );
}

function FinanceDisburseTable({
  rows,
  mode,
  busyId,
  selected,
  onToggle,
  onDisburse,
  onReturn,
  onInquiry,
}: {
  rows: InspectorFeeRowDto[];
  mode: "disburse" | "review" | "readonly";
  busyId: string | null;
  selected: Set<string>;
  onToggle: (id: string, on: boolean) => void;
  onDisburse: (row: InspectorFeeRowDto) => void;
  onReturn: (row: InspectorFeeRowDto) => void;
  onInquiry: (row: InspectorFeeRowDto) => void;
}) {
  const showCheckbox = mode === "disburse";
  const showDisburse = mode === "disburse";
  const showReviewActions = mode === "disburse" || mode === "review";

  return (
    <div
      className={cn(
        queueTableWrapClassName,
        "rounded-[var(--radius-lg)] border border-border bg-surface",
      )}
    >
      <Table>
        <THead>
          <Tr hoverable={false}>
            {showCheckbox ? <Th className="w-10" /> : null}
            <Th>المعاملة</Th>
            <Th className="text-end">الصافي</Th>
            <Th>حالة العمل</Th>
            <Th>حالة الدفع</Th>
            <Th>أمر الصرف</Th>
            {showReviewActions || showDisburse ? <Th className="text-end">إجراء</Th> : null}
          </Tr>
        </THead>
        <TBody>
          {rows.map((row) => (
            <Tr key={row.workflowTaskId} hoverable={false}>
              {showCheckbox ? (
                <Td>
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={selected.has(row.workflowTaskId)}
                    onChange={(e) => onToggle(row.workflowTaskId, e.target.checked)}
                    aria-label={`تحديد ${row.propertyLabel}`}
                  />
                </Td>
              ) : null}
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
              <Td className="font-sans text-[11px] text-text-2">
                {row.disbursementBatchId ? (
                  row.disbursementBatchId.slice(0, 8)
                ) : (
                  <span className="text-text-3">لم يُنشأ بعد</span>
                )}
              </Td>
              {showReviewActions || showDisburse ? (
                <Td>
                  <div className="flex flex-wrap justify-end gap-1">
                    {showDisburse ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        disabled={busyId === row.workflowTaskId}
                        onClick={() => onDisburse(row)}
                      >
                        صرف
                      </Button>
                    ) : null}
                    {showReviewActions ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busyId === row.workflowTaskId}
                          onClick={() => onReturn(row)}
                        >
                          إرجاع
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={busyId === row.workflowTaskId}
                          onClick={() => onInquiry(row)}
                        >
                          استفسار
                        </Button>
                      </>
                    ) : null}
                  </div>
                </Td>
              ) : null}
            </Tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
