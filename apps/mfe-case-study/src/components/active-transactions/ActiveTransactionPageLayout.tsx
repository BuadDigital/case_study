"use client";

import type { ReactNode } from "react";
import { PageShell, cn } from "@platform/design-system";
import type { PageId } from "@platform/types";
import { ActiveTransactionsSituationBar } from "./ActiveTransactionsSituationBar";

export function ActiveTransactionPageLayout({
  pageId,
  hasRail = false,
  panelOpen = false,
  railGridClassName,
  aboveSituation,
  queuePanel,
  sidePanel,
}: {
  pageId: PageId;
  hasRail?: boolean;
  panelOpen?: boolean;
  railGridClassName?: string;
  /** Office banner etc. — rendered above KPI situation cards (eng2). */
  aboveSituation?: ReactNode;
  queuePanel: ReactNode;
  sidePanel?: ReactNode;
}) {
  const split = hasRail && Boolean(sidePanel);
  const openGrid =
    railGridClassName ??
    "lg:grid-cols-[minmax(0,1.05fr)_minmax(300px,1fr)]";

  return (
    <PageShell variant="canvas">
      {aboveSituation}
      <ActiveTransactionsSituationBar pageId={pageId} />

      {split ? (
        <div
          className={cn(
            "grid gap-3",
            panelOpen
              ? cn("grid-cols-1 lg:items-stretch", openGrid)
              : "grid-cols-1 items-start content-start",
          )}
        >
          {queuePanel}
          {sidePanel}
        </div>
      ) : (
        queuePanel
      )}
    </PageShell>
  );
}
