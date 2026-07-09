"use client";

import type { ReactNode } from "react";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";
import { usePartyTaskRecallRequest } from "../../hooks/use-party-task-recall-request";
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

  return (
    <>
      {children}
      {show ? (
        <PartyTaskRecallFab
          deedNumber={deedNumber}
          onRequestRecall={requestRecall}
          onAddObstruction={onAddObstruction}
          onAddNote={onAddNote}
        />
      ) : null}
    </>
  );
}
