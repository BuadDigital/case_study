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

/**
 * D17 — the «أسلوب الدخل» work screen: closed until the settings are saved with the income
 * approach on (Q-2), then the direct-capitalisation section and its alerts (26–28).
 */
export function IncomeApproachScreen({
  settingsSaved,
  incomeEnabled,
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
  incomeEnabled: boolean;
  valuationRequestId: string | null;
  gates: ValuationIssuanceGatesDto | null;
  recon: ValuationReconciliationDto | null;
  saving: boolean;
  locked: boolean;
  onSavingChange: (saving: boolean) => void;
  onIncomeSaved: (dto: ValuationIncomeApproachDto) => void;
  onReconSaved: (dto: ValuationReconciliationDto) => void;
}) {
  if (!settingsSaved || !incomeEnabled) {
    return (
      <Card>
        <CardPad>
          <p className="text-[13px] text-text-2">
            {!settingsSaved ? "ابدأ التقييم أولاً." : "أسلوب الدخل غير مفعّل في إعدادات التقييم."}
          </p>
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
