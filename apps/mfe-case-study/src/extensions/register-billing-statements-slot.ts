"use client";

/**
 * Registers the case-study billing-statements panel into `@platform/app-shared`
 * so `@settings/mfe` never imports `@case-study/mfe` directly.
 * Call once from the shell at boot.
 */

import { registerPartyOfficeBillingStatementsPanel } from "@platform/app-shared/party-appraisal/billing-statements-slot";
import { PartyOfficeBillingStatementsPanel } from "../components/fees/PartyOfficeBillingStatementsPanel";

let registered = false;

export function ensurePartyOfficeBillingStatementsRegistered(): void {
  if (registered) return;
  registered = true;
  registerPartyOfficeBillingStatementsPanel(PartyOfficeBillingStatementsPanel);
}
