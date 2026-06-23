"use client";

import type { ReactNode } from "react";
import { PageShell, cn } from "@platform/design-system";
import type { PageId } from "@platform/types";
import { ActiveTransactionsSituationBar } from "./ActiveTransactionsSituationBar";

/**
 * PO-style canvas for active-transaction queues: KPI row + operational panel(s).
 */
export function ActiveTransactionPageLayout({
  pageId,
  hasRail = false,
  panelOpen = false,
  queuePanel,
  sidePanel,
}: {
  pageId: PageId;
  hasRail?: boolean;
  panelOpen?: boolean;
  queuePanel: ReactNode;
  sidePanel?: ReactNode;
}) {
  const split = hasRail && Boolean(sidePanel);

  return (
    <PageShell variant="canvas" className="min-h-0 flex-1">
      <ActiveTransactionsSituationBar pageId={pageId} />

      {split ? (
        <div
          className={cn(
            "grid min-h-0 flex-1 gap-3",
            panelOpen
              ? "grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] lg:items-stretch"
              : "grid-cols-1 items-start content-start",
          )}
        >
          {queuePanel}
          {panelOpen ? sidePanel : null}
        </div>
      ) : (
        queuePanel
      )}
    </PageShell>
  );
}
