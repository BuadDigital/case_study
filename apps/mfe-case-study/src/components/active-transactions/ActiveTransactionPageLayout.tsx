"use client";
import type { ReactNode } from "react";
import {
  PageShell,
  cn,
} from "@platform/design-system";
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
              ? cn("grid-cols-1 lg:items-start", openGrid)
              : "grid-cols-1 items-start content-start",
          )}
        >
          {queuePanel}
          {panelOpen ? (
            <div
              className={cn(
                /* Explicit height (not only max-h) so flex children shrink and the save footer stays visible. */
                "flex min-h-0 min-w-0 flex-col overflow-hidden",
                "lg:sticky lg:top-3",
                /* Leave room for situation KPI band + page padding above the rail. */
                "max-h-[calc(100dvh-var(--topbar-h)-11rem)]",
                "lg:h-[calc(100dvh-var(--topbar-h)-11rem)]",
              )}
            >
              {sidePanel}
            </div>
          ) : (
            sidePanel
          )}
        </div>
      ) : (
        queuePanel
      )}
    </PageShell>
  );
}
