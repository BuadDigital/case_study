"use client";

import { FinancePartyBillingDuesSection } from "./FinancePartyBillingDuesSection";
import { FinancePartyBillingStatementsSection } from "./FinancePartyBillingStatementsSection";
import { usePartyBillingStatementsWorkflow } from "./usePartyBillingStatementsWorkflow";
import type { PartyBillingMode } from "../lib/party-billing-statements-state";

export type { PartyBillingMode } from "../lib/party-billing-statements-state";

/**
 * Party billing screen — outstanding dues on top, statements and their
 * disbursement workflow below. Which of the two sections appears depends on
 * the mode; all queries, drafts and writes live in
 * `usePartyBillingStatementsWorkflow`.
 */
export function FinancePartyBillingStatements({
  mode = "all",
  assigneeId = null,
  focusStatementId = null,
  onFocusStatement,
  onCreatedStatement,
}: {
  mode?: PartyBillingMode;
  /** Scope dues/payrolls to one payee (payee account). */
  assigneeId?: string | null;
  focusStatementId?: string | null;
  onFocusStatement?: (id: string | null, partyId?: string | null) => void;
  onCreatedStatement?: () => void;
} = {}) {
  const workflow = usePartyBillingStatementsWorkflow({
    mode,
    assigneeId,
    focusStatementId,
    onFocusStatement,
    onCreatedStatement,
  });

  return (
    <div className="flex flex-col gap-5">
      {workflow.showDues ? (
        <FinancePartyBillingDuesSection workflow={workflow} />
      ) : null}

      {workflow.showStatements ? (
        <FinancePartyBillingStatementsSection
          mode={mode}
          focusStatementId={focusStatementId}
          workflow={workflow}
        />
      ) : null}
    </div>
  );
}
