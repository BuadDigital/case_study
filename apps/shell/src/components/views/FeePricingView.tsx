"use client";

import { FinancePartyFeePricing } from "@financial/mfe";
import { PageShell } from "@platform/design-system";

export function FeePricingView() {
  return (
    <PageShell
      variant="canvas"
      className="flex min-h-0 flex-1 flex-col bg-bg font-sans text-text"
    >
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3.5 py-4 pb-8 sm:px-7 sm:py-[22px] sm:pb-10">
        <FinancePartyFeePricing />
      </div>
    </PageShell>
  );
}
