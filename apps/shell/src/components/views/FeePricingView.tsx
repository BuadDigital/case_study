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
      <FinancePartyFeePricing />
    </PageShell>
  );
}
