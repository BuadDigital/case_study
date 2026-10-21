"use client";

import { fmtSar } from "@platform/app-shared/format/number";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { resolvePartyName } from "@platform/app-shared/fees/party-fee-meta";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import { queryLoadFailed } from "@platform/app-shared/query/query-load-state";
import {
  EmptyState,
  MobileRecordCard,
  MobileRecordList,
  QueryErrorState,
  StatusPill,
  TBody,
  THead,
  Table,
  TableFrame,
  Td,
  TdLtr,
  Th,
  Tr,
  cn,
  finStatusStyle,
  opsLetterCard,
  opsTfNote,
} from "@platform/ui-kit";
import { finGroupHead, finGroupTitle, finMuted } from "../lib/finance-tw";
import {
  financeExcludedFeesOptions,
  financeExcludedStatementsOptions,
} from "../query/costs-account-queries";

/** Why a line left the payout cycle (table cell and phone card). */
function excludedReason(row: {
  exclusionReason?: string | null;
  lastTransitionReason?: string | null;
  excludedFromBatch: boolean;
}) {
  return (
    row.exclusionReason?.trim() ||
    row.lastTransitionReason?.trim() ||
    (row.excludedFromBatch ? "مستبعد من الصرف" : "صافي صفر")
  );
}

const cancelledPill = (
  <StatusPill label="ملغى" style={finStatusStyle("cancelled")} />
);

/**
 * Excluded: written-off/excluded lines before entitlement + cancelled payrolls (log).
 * Display-reference only.
 */
export function FinanceExcludedCosts({
  assigneeId = null,
}: {
  assigneeId?: string | null;
} = {}) {
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];

  const feesQuery = useQuery(financeExcludedFeesOptions());
  const statementsQuery = useQuery(financeExcludedStatementsOptions());

  const excludedLines = useMemo(
    () =>
      (feesQuery.data?.rows ?? []).filter((r) => {
        if (assigneeId?.trim()) {
          if ((r.assigneeId?.trim() || "—") !== assigneeId.trim()) return false;
        }
        return (
          r.excludedFromBatch ||
          (r.netFeeSar === 0 && r.workStatus === "done")
        );
      }),
    [feesQuery.data?.rows, assigneeId],
  );

  const cancelledStatements = useMemo(
    () =>
      (statementsQuery.data ?? []).filter((s) => {
        if (s.status !== "cancelled") return false;
        if (assigneeId?.trim()) return s.assigneeId === assigneeId.trim();
        return true;
      }),
    [statementsQuery.data, assigneeId],
  );

  const pending = feesQuery.isPending || statementsQuery.isPending;

  if (pending) {
    return (
      <div className={opsLetterCard}>
        <EmptyState panel line="جاري التحميل…" />
      </div>
    );
  }

  const failed = [feesQuery, statementsQuery].filter(queryLoadFailed);
  if (failed.length) {
    return (
      <div className={opsLetterCard}>
        <QueryErrorState
          panel
          line="تعذّر تحميل المستبعدة"
          error={failed[0]!.error}
          onRetry={() => {
            for (const q of failed) void q.refetch();
          }}
          retrying={failed.some((q) => q.isFetching)}
        />
      </div>
    );
  }

  if (excludedLines.length === 0 && cancelledStatements.length === 0) {
    return (
      <div className={opsLetterCard}>
        <EmptyState
          panel
          line="لا مستبعدة حالياً."
          hint="تظهر هنا البنود المستبعدة قبل الاستحقاق والمسيرات الملغاة كسجل."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className={cn(opsTfNote, "mb-3.5")}>
        بنود خرجت من دورة الصرف ولن تُدفع — ملغاة أو مخسومة بالكامل، سُوّيت بين
        المشرف والمكتب الهندسي قبل الاستحقاق. لا تصل المالية إلا الأتعاب المتفق
        عليها، فهذا التبويب للمطابقة والسجل فقط.
      </p>

      {excludedLines.length > 0 ? (
        <section>
          <div className={finGroupHead}>
            <h3 className={finGroupTitle}>
              بنود مستبعدة{" "}
              <span className={`${finMuted} font-normal`}>
                ({excludedLines.length})
              </span>
            </h3>
          </div>
          {/* Phones: one card per line instead of the 5-column table. */}
          <MobileRecordList className="lg:hidden">
            {excludedLines.map((row) => (
              <MobileRecordCard
                key={row.workflowTaskId}
                tone="muted"
                title={resolvePartyName(row.assigneeId, staffUsers)}
                subtitle={row.propertyLabel || "—"}
                fields={[
                  { label: "أمر العمل", ltr: true, value: row.poNumber },
                  { label: "الصافي", ltr: true, value: fmtSar(row.netFeeSar, { trim: true }) },
                  { label: "السبب", value: excludedReason(row), wide: true },
                ]}
              />
            ))}
          </MobileRecordList>
          <TableFrame className="max-lg:hidden">
            <Table>
              <THead>
                <Tr hoverable={false}>
                  <Th>المستحق</Th>
                  <Th>المرجع</Th>
                  <Th>أمر العمل</Th>
                  <Th className="text-center">الصافي</Th>
                  <Th>السبب</Th>
                </Tr>
              </THead>
              <TBody>
                {excludedLines.map((row) => (
                  <Tr key={row.workflowTaskId} hoverable={false}>
                    <Td>
                      <span className="font-semibold text-heading">
                        {resolvePartyName(row.assigneeId, staffUsers)}
                      </span>
                    </Td>
                    <Td>
                      <span className={finMuted} title={row.propertyLabel}>
                        {row.propertyLabel || "—"}
                      </span>
                    </Td>
                    <TdLtr valueClassName="text-[13.5px] font-bold text-gold-d">
                      {row.poNumber}
                    </TdLtr>
                    <TdLtr
                      className="text-center"
                      valueClassName="text-[14px] font-extrabold text-heading"
                    >
                      {fmtSar(row.netFeeSar, { trim: true })}
                    </TdLtr>
                    <Td>
                      <span className={finMuted}>{excludedReason(row)}</span>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableFrame>
        </section>
      ) : null}

      {cancelledStatements.length > 0 ? (
        <section>
          <div className={finGroupHead}>
            <h3 className={finGroupTitle}>
              مسيرات / أوامر ملغاة{" "}
              <span className={`${finMuted} font-normal`}>
                ({cancelledStatements.length})
              </span>
            </h3>
          </div>
          <MobileRecordList className="lg:hidden">
            {cancelledStatements.map((s) => (
              <MobileRecordCard
                key={s.id}
                tone="muted"
                title={
                  <bdi dir="ltr" className="text-gold-d">
                    {s.referenceNumber}
                  </bdi>
                }
                subtitle={resolvePartyName(s.assigneeId, staffUsers)}
                status={cancelledPill}
                fields={[
                  { label: "المبلغ", ltr: true, value: fmtSar(s.totalNetSar, { trim: true }) },
                  { label: "سبب الإلغاء", value: (s.cancelReason ?? "").trim() || "—", wide: true },
                ]}
              />
            ))}
          </MobileRecordList>
          <TableFrame className="max-lg:hidden">
            <Table>
              <THead>
                <Tr hoverable={false}>
                  <Th>المرجع</Th>
                  <Th>المستحق</Th>
                  <Th className="text-center">المبلغ</Th>
                  <Th>سبب الإلغاء</Th>
                </Tr>
              </THead>
              <TBody>
                {cancelledStatements.map((s) => (
                  <Tr key={s.id} hoverable={false}>
                    <Td>
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        <span
                          dir="ltr"
                          className="text-[13.5px] font-bold text-gold-d"
                        >
                          {s.referenceNumber}
                        </span>
                        {cancelledPill}
                      </span>
                    </Td>
                    <Td>
                      <span className="font-semibold text-heading">
                        {resolvePartyName(s.assigneeId, staffUsers)}
                      </span>
                    </Td>
                    <TdLtr
                      className="text-center"
                      valueClassName="text-[14px] font-extrabold text-heading"
                    >
                      {fmtSar(s.totalNetSar, { trim: true })}
                    </TdLtr>
                    <Td>
                      <span className={finMuted}>
                        {(s.cancelReason ?? "").trim() || "—"}
                      </span>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableFrame>
        </section>
      ) : null}
    </div>
  );
}
