// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Income  New file — the «أسلوب الدخل» work screen (D17): closed until the settings are saved with
//            the income approach on, then the direct-capitalisation section and its alerts (26–28).
// Round 2 (1b19bedc)
//  • R2-3  New incomeSaved prop: a tab opened from an unsaved settings toggle shows «احفظ إعدادات
//          التقييم أولاً …» until the settings are saved (incomeScreenClosedReason).
// ──────────────────────────────────────────────────────────────────────────────────────────────

"use client";

import { Suspense } from "react";
import type {
  ValuationIncomeApproachDto,
  ValuationIssuanceGatesDto,
  ValuationReconciliationDto,
} from "@platform/api-client";
import { InlineLoadingSkeleton } from "@platform/ui-kit";

import { Card, CardPad } from "./atoms";
import { MethodologyAlertsPanel } from "./MethodologyAlertsPanel";
import { IncomeApproachSection } from "./lazy-work-screens";
import { incomeScreenClosedReason } from "./lib/income-approach-state";

/**
 * D17 — the «أسلوب الدخل» work screen: closed until the settings are saved with the income
 * approach on (Q-2), then the direct-capitalisation section and its alerts (26–28).
 */
export function IncomeApproachScreen({
  settingsSaved,
  incomeEnabled,
  incomeSaved,
  valuationRequestId,
  gates,
  recon,
  saving,
  locked,
  onSavingChange,
  onIncomeSaved,
  onReconSaved,
}: {
  settingsSaved: boolean;
  /** The tab's state (settings draft included). */
  incomeEnabled: boolean;
  /** The SAVED settings have the income approach on — the only state the server accepts. */
  incomeSaved: boolean;
  valuationRequestId: string | null;
  gates: ValuationIssuanceGatesDto | null;
  recon: ValuationReconciliationDto | null;
  saving: boolean;
  locked: boolean;
  onSavingChange: (saving: boolean) => void;
  onIncomeSaved: (dto: ValuationIncomeApproachDto) => void;
  onReconSaved: (dto: ValuationReconciliationDto) => void;
}) {
  const closedReason = incomeScreenClosedReason({ settingsSaved, incomeEnabled, incomeSaved });
  if (closedReason) {
    return (
      <Card>
        <CardPad>
          <p className="text-[13px] text-text-2">{closedReason}</p>
        </CardPad>
      </Card>
    );
  }
  return (
    <Suspense fallback={<InlineLoadingSkeleton />}>
      <IncomeApproachSection
        valuationRequestId={valuationRequestId}
        saving={saving}
        locked={locked}
        onSavingChange={onSavingChange}
        onIncomeSaved={onIncomeSaved}
      />
      {gates ? (
        <div className="mt-5">
          <MethodologyAlertsPanel
            group="income"
            gates={gates}
            recon={recon}
            valuationRequestId={valuationRequestId}
            saving={saving}
            onSavingChange={onSavingChange}
            onReconSaved={onReconSaved}
          />
        </div>
      ) : null}
    </Suspense>
  );
}
