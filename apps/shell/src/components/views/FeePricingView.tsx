"use client";

import { FinancePartyFeePricing } from "@financial/mfe";
import { PageShell } from "@platform/design-system";

export function FeePricingView() {
  // Single scroll surface is `#content` in AppShell — do not nest overflow-y here
  // or trackpad/mouse wheel fights both scrollers and the page feels like it shakes.
  return (
    <PageShell
      variant="canvas"
      className="h-fit min-w-0 max-w-full bg-bg font-sans text-text"
    >
      <div className="px-3.5 py-4 pb-8 sm:px-7 sm:py-[22px] sm:pb-10">
        <FinancePartyFeePricing />
      </div>
    </PageShell>
  );
}
