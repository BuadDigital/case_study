"use client";

import { FinancePartyFeePricing } from "@financial/mfe";
import { PageShell } from "@platform/design-system";

export function FeePricingView() {
  return (
    <PageShell variant="canvas" className="min-h-0 flex-1">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <FinancePartyFeePricing />
      </div>
    </PageShell>
  );
}
