"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatSar } from "./FinancePartyBillingParts";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import { loadInspectorFeesSummary } from "@platform/app-shared/app-data/inspector-fees-api";
import { loadPartyBillingStatements } from "@platform/app-shared/app-data/party-billing-statements-api";
import { resolvePartyName } from "@platform/app-shared/fees/party-fee-meta";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import {
  EmptyState,
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

  const feesQuery = useQuery({
    queryKey: [...appDataKeys.all, "inspector-fees", "finance-excluded"],
    queryFn: () => loadInspectorFeesSummary({ submittedOnly: false }),
  });

  const statementsQuery = useQuery({
    queryKey: [...appDataKeys.all, "party-billing", "statements", "excluded"],
    queryFn: () => loadPartyBillingStatements(),
  });

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
          <TableFrame>
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
                      {formatSar(row.netFeeSar)}
                    </TdLtr>
                    <Td>
                      <span className={finMuted}>
                        {row.exclusionReason?.trim() ||
                          row.lastTransitionReason?.trim() ||
                          (row.excludedFromBatch
                            ? "مستبعد من الصرف"
                            : "صافي صفر")}
                      </span>
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
          <TableFrame>
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
                        <StatusPill label="ملغى" style={finStatusStyle("cancelled")} />
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
                      {formatSar(s.totalNetSar)}
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
