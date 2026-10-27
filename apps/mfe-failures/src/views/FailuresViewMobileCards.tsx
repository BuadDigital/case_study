"use client";

/** Failures queue — the mobile cards; the open card carries `FailuresViewExpandedActions`. */

import { formatPoDisplay } from "@platform/ui-kit";
import { isActiveFailureStatus } from "@platform/app-shared/failures/failures-types";
import {
  ActiveQueueMobileCards,
  type ActiveQueueMobileCardItem,
} from "@platform/app-shared/components/ActiveQueueMobileCards";
import {
  failureActorLabel,
  failureListStatusColor,
  failureListStatusLabel,
  failureRecordTitle,
} from "../lib/failures-labels";
import {
  failureCardTone,
  failureSpecialistName,
  failureRowTitle,
  failuresEmptyLine,
} from "../lib/failures-view-state";
import { FailuresViewExpandedActions } from "./FailuresViewExpandedActions";
import type { FailuresViewWorkflow } from "./useFailuresViewWorkflow";

export function FailuresViewMobileCards({ wf }: { wf: FailuresViewWorkflow }) {
  // After hydration mount only one tree (table or cards) — both used to build together.
  if (wf.isDesktopViewport === true) return null;
  const { rows, expandedId, highlightId } = wf;
  const items: ActiveQueueMobileCardItem[] = rows.map((f) => {
    const active = isActiveFailureStatus(f.status);
    const statusColor = failureListStatusColor(f.status, f.severity);
    const expanded = expandedId === f.id;
    const specialist = failureSpecialistName(f);
    return {
      id: f.id,
      anchorId: `failure-${f.id}`,
      title: failureRowTitle(f),
      // Card line: transaction number (when the deed has one), work order, the failure's reason,
      // then the company's specialist — or, before one is assigned, who raised it. The severity
      // word that used to sit here is part of the status pill now.
      meta: [
        ...(f.transactionNumber
          ? [{ text: f.transactionNumber, kind: "po" as const }]
          : []),
        { text: formatPoDisplay(f.poNumber), kind: "po" as const },
        { text: failureRecordTitle(f), kind: "type" as const },
        specialist
          ? { text: specialist, kind: "place" as const }
          : {
              text: failureActorLabel(f.raisedByRole),
              kind: "plain" as const,
            },
      ],
      statusLabel: failureListStatusLabel(f.status, f.severity),
      statusStyle: { base: statusColor, fg: statusColor },
      tone: failureCardTone(f),
      moreItems: [],
      muted: !active,
      expanded,
      expandedPanel: expanded ? (
        <FailuresViewExpandedActions failure={f} wf={wf} />
      ) : null,
      shellClassName: highlightId === f.id ? "ring-2 ring-gold/40" : undefined,
      onOpen: () => wf.toggleExpanded(f.id),
    };
  });

  return (
    <div className="lg:hidden max-lg:px-0">
      <ActiveQueueMobileCards
        items={items}
        pending={!wf.isFetched}
        emptyMessage={failuresEmptyLine(wf.role, wf.tab)}
      />
    </div>
  );
}
