/**
 * Runtime slot so `@settings/mfe` never imports `@case-study/mfe`.
 * Shell registers the impl at app boot; settings renders through here.
 *
 * Mirrors the bridge pattern in `./evaluator-runtime-bridge`.
 */

import type { ComponentType } from "react";

export type PartyOfficeBillingStatementsPanelProps = {
  assigneeId?: string;
  issuedOrLaterOnly?: boolean;
};

let panel: ComponentType<PartyOfficeBillingStatementsPanelProps> | null = null;

export function registerPartyOfficeBillingStatementsPanel(
  next: ComponentType<PartyOfficeBillingStatementsPanelProps>,
): void {
  panel = next;
}

/** Null until the shell registers (SSR / tests / settings loaded standalone). */
export function tryGetPartyOfficeBillingStatementsPanel(): ComponentType<PartyOfficeBillingStatementsPanelProps> | null {
  return panel;
}
