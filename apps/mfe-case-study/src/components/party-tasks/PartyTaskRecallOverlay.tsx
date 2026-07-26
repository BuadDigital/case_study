"use client";

import type { ReactNode } from "react";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";
import { usePartyTaskRecallRequest } from "../../hooks/use-party-task-recall-request";
import { supportsPartyTaskRecall } from "../../lib/prototype/party-task-recall";
import { PartyTaskRecallFab } from "./PartyTaskRecallFab";

export function PartyTaskRecallOverlay({
  task,
  deedNumber,
  show,
  isSubmitted,
  notSubmittedMessage,
  onAddObstruction,
  onAddNote,
  children,
}: {
  task: WorkflowTask;
  deedNumber?: string;
  show: boolean;
  isSubmitted?: boolean;
  notSubmittedMessage?: string;
  onAddObstruction?: () => void;
  onAddNote?: () => void;
  children: ReactNode;
}) {
  const requestRecall = usePartyTaskRecallRequest({
    taskId: task.id,
    poNumber: task.poNumber,
    propertyId: task.propertyId ?? "",
    isSubmitted: isSubmitted ?? show,
    notSubmittedMessage,
  });

  const canRecall = supportsPartyTaskRecall(task.kind);
  const hasAnyAction = canRecall || !!onAddObstruction || !!onAddNote;

  return (
    <>
      {children}
      {show && hasAnyAction ? (
        <PartyTaskRecallFab
          deedNumber={deedNumber}
          onRequestRecall={canRecall ? requestRecall : undefined}
          onAddObstruction={onAddObstruction}
          onAddNote={onAddNote}
        />
      ) : null}
    </>
  );
}
