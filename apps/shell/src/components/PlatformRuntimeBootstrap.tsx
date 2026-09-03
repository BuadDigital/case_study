"use client";

import { useEffect } from "react";
import { ensureEvaluatorRuntimeBridgeRegistered } from "@evaluator/mfe/extensions/register-evaluator-runtime-bridge";
import { ensurePartyOfficeBillingStatementsRegistered } from "@case-study/mfe/extensions/register-billing-statements-slot";
import { ensureEngineeringSurveyBridgeRegistered } from "@engineering-office/mfe/extensions/register-engineering-survey-bridge";
import { ensureKeyEnvelopeFeesPanelRegistered } from "@keys/mfe/extensions/register-key-envelope-fees-slot";
import { ensureFailuresCaseStudyBridgeRegistered } from "@case-study/mfe/extensions/register-failures-bridge";
import { hydrateDomainStore } from "@platform/app-shared/storage/browser-domain-store";

// Sync registration before any case-study queue/detail code runs.
ensureEvaluatorRuntimeBridgeRegistered();
// Supplies the billing-statements panel to the settings profile screen.
ensurePartyOfficeBillingStatementsRegistered();
// Supplies engineering-survey submission/document helpers to case-study.
ensureEngineeringSurveyBridgeRegistered();
// Supplies the key-envelope fees panel to case-study fee screens.
ensureKeyEnvelopeFeesPanelRegistered();
// Supplies PO records + suspend action to the failures screen.
ensureFailuresCaseStudyBridgeRegistered();

/** Hydrates domain IndexedDB once per app session. */
export function PlatformRuntimeBootstrap() {
  useEffect(() => {
    void hydrateDomainStore();
  }, []);
  return null;
}
