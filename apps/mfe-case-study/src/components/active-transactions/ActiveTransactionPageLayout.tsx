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
  reserveRail = false,
  railGridClassName,
  aboveSituation,
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
  queuePanel: ReactNode;
  sidePanel?: ReactNode;
}) {
  const split = hasRail && Boolean(sidePanel);
  const railActive = panelOpen || reserveRail;
  /** Queue + form split evenly when the side panel is open. */
  const openGrid =
    railGridClassName ?? "lg:grid-cols-2";

  return (
    <PageShell variant="canvas" className="h-fit min-w-0 max-w-full">
      {aboveSituation}
      <ActiveTransactionsSituationBar pageId={pageId} />

      {split ? (
        <div
          className={cn(
            "grid min-w-0 max-w-full gap-3 grid-cols-1 items-start",
            railActive && cn("lg:items-start", openGrid),
          )}
        >
          {queuePanel}
          {railActive ? (
            <div
              className={cn(
                "flex min-h-0 min-w-0 flex-col overflow-hidden",
                "lg:sticky lg:top-3",
                /* Leave room for situation KPI band + page padding above the rail. */
                "max-h-[calc(100dvh-var(--topbar-h)-11rem)]",
                "lg:h-[calc(100dvh-var(--topbar-h)-11rem)]",
                /* Empty-state rail is desktop-only; mobile still opens below via panelOpen. */
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
