"use client";
import type { ReactNode } from "react";
import { PageShell, cn } from "@platform/ui-kit";
import type { PageId } from "@platform/types";
import { ActiveTransactionsSituationBar } from "./ActiveTransactionsSituationBar";

export function ActiveTransactionPageLayout({
  pageId,
  hasRail = false,
  panelOpen = false,
  reserveRail = false,
  railGridClassName,
  aboveSituation,
  hideSituation = false,
  queuePanel,
  sidePanel,
}: {
  pageId: PageId;
  hasRail?: boolean;
  panelOpen?: boolean;
  reserveRail?: boolean;
  railGridClassName?: string;
  /** Office banner etc. — rendered above KPI situation cards (eng2). */
  aboveSituation?: ReactNode;
  /** When true, skip situation KPI band (e.g. eng fees HTML embeds its own). */
  hideSituation?: boolean;
  queuePanel: ReactNode;
  sidePanel?: ReactNode;
}) {
  const split = hasRail && Boolean(sidePanel);
  const railActive = panelOpen || reserveRail;
  /** Queue + form split evenly when the side panel is open. */
  const openGrid = railGridClassName ?? "lg:grid-cols-2";
  const splitPane =
    "flex min-h-0 min-w-0 flex-col overflow-hidden lg:h-[calc(100dvh-var(--topbar-h)-11rem)]";

  return (
    <PageShell variant="canvas" className="h-fit min-w-0 max-w-full">
      {aboveSituation}
      {hideSituation ? null : (
        <ActiveTransactionsSituationBar pageId={pageId} />
      )}

      {split ? (
        <div
          className={cn(
            "grid min-w-0 max-w-full gap-3 grid-cols-1 items-start",
            railActive && cn("lg:items-stretch", openGrid),
          )}
        >
          {railActive ? (
            <div className={splitPane}>{queuePanel}</div>
          ) : (
            queuePanel
          )}
          {railActive ? (
            <div
              className={cn(
                splitPane,
                "lg:sticky lg:top-0",
                !panelOpen && reserveRail && "max-lg:hidden",
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