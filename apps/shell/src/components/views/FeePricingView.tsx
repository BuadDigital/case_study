"use client";

import { FinancePartyFeePricing } from "@financial/mfe";
import { PageShell } from "@platform/design-system";

export function FeePricingView() {
  return (
    <PageShell variant="canvas" className="min-h-0 flex-1">
      <div className="flex w-full min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-none">
        <div className="min-h-0 flex-1 overflow-y-auto bg-surface-2 px-4 py-3 sm:px-5">
          <FinancePartyFeePricing />
        </div>
      </div>
    </PageShell>
  );
}
