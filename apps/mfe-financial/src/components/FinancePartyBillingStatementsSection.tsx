"use client";

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
} from "@platform/ui-kit";
import { resolvePartyName } from "@platform/app-shared/fees/party-fee-meta";

import {
  partyBillingWorkflowLabel,
  partyBillingWorkflowTone,
  statementDisplayTotal,
} from "../lib/finance-cost-parties";
import {
  finGroupHead,
  finMuted,
  finRowActive,
  finSectionTitle,
  finWorkFlush,
  finWorkHead,
  finWorkTitle,
} from "../lib/finance-tw";
import type { PartyBillingMode } from "../lib/party-billing-statements-state";
import { formatSar } from "./FinancePartyBillingParts";
import { FinancePartyBillingStatementDetail } from "./FinancePartyBillingStatementDetail";
import type { PartyBillingStatementsWorkflow } from "./usePartyBillingStatementsWorkflow";

/**
 * Statement list, plus either the full detail panel (focused modes) or the
 * side summary that the “all” overview shows next to the table.
 */
export function FinancePartyBillingStatementsSection({
  mode,
  focusStatementId,
  workflow,
}: {
  mode: PartyBillingMode;
  focusStatementId: string | null;
  workflow: PartyBillingStatementsWorkflow;
}) {
  const {
    statementsQuery,
    statements,
    selectedStatement,
    selectedStatementId,
    selectStatement,
    staffUsers,
  } = workflow;

  return (
    <section>
      {mode === "all" ? (
        <div className={cn(finGroupHead, "mt-2")}>
          <h3 className={finSectionTitle}>مسيرات وأوامر الصرف</h3>
        </div>
      ) : null}
      {statementsQuery.isPending ? (
        <div className={opsLetterCard}>
          <EmptyState panel line="جاري التحميل…" />
        </div>
      ) : statements.length === 0 && !selectedStatement ? (
        <div className={opsLetterCard}>
          <EmptyState
            panel
            line={
              mode === "paid"
                ? "لا مستندات مدفوعة بعد."
                : "لا مسيرات أو أوامر صرف قيد الإجراء."
            }
          />
        </div>
      ) : selectedStatement && mode !== "all" ? (
      <FinancePartyBillingStatementDetail
        selectedStatement={selectedStatement}
        workflow={workflow}
      />
      ) : (
        <div
          className={
            mode === "all"
              ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
              : undefined
          }
        >
          <TableFrame>
            <Table>
              <THead>
                <Tr hoverable={false}>
                  <Th>المرجع</Th>
                  <Th className="text-center">التاريخ</Th>
                  <Th className="text-center">المعاملات</Th>
                  <Th className="text-center">الإجمالي</Th>
                  <Th className="text-center">الحالة</Th>
                </Tr>
              </THead>
              <TBody>
                {statements.map((s) => {
                  const active =
                    (focusStatementId ?? selectedStatementId) === s.id;
                  const dateIso =
                    s.closedAtUtc ??
                    s.issuedAtUtc ??
                    s.createdAtUtc;
                  return (
                    <Tr
                      key={s.id}
                      className={cn(
                        "cursor-pointer",
                        active && finRowActive,
                      )}
                      role="button"
                      tabIndex={0}
                      onClick={() => selectStatement(s.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          selectStatement(s.id);
                        }
                      }}
                    >
                      <TdLtr valueClassName="text-[12.5px] font-bold text-gold-d">
                        {s.referenceNumber}
                      </TdLtr>
                      <TdLtr
                        className="text-center"
                        valueClassName="text-[11.5px] text-text-2"
                      >
                        {dateIso
                          ? new Date(dateIso).toLocaleDateString("en-GB")
                          : "—"}
                      </TdLtr>
                      <Td className="text-center">
                        <span className="text-xs text-text-2">
                          {s.lines.length} معاملة
                        </span>
                      </Td>
                      <TdLtr
                        className="text-center"
                        valueClassName="text-[12.5px] font-bold text-heading"
                      >
                        {formatSar(statementDisplayTotal(s))}
                      </TdLtr>
                      <Td className="text-center">
                        <StatusPill
                          label={partyBillingWorkflowLabel(s)}
                          style={finStatusStyle(partyBillingWorkflowTone(s))}
                        />
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </TableFrame>

          {mode === "all" ? (
            <div className={finWorkFlush}>
              {!selectedStatement ? (
                <EmptyState
                  panel
                  className="py-7"
                  line="اختر كشفاً لعرض التفاصيل والإجراءات."
                />
              ) : (
                <div className="flex flex-col gap-3">
                  <div className={finWorkHead}>
                    <div>
                      <div className={finWorkTitle}>
                        {selectedStatement.referenceNumber}
                      </div>
                      <div className={cn(finMuted, "mt-1")}>
                        {resolvePartyName(
                          selectedStatement.assigneeId,
                          staffUsers,
                        )}{" "}
                        — {formatSar(statementDisplayTotal(selectedStatement))}
                      </div>
                    </div>
                    <StatusPill
                      label={partyBillingWorkflowLabel(selectedStatement)}
                      style={finStatusStyle(
                        partyBillingWorkflowTone(selectedStatement),
                      )}
                    />
                  </div>
                  <p className={finMuted}>
                    افتح تبويب «مسيرات وأوامر صرف» داخل حساب المستحق للتفاصيل
                    الكاملة.
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
