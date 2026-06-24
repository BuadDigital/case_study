"use client";

import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PartyActiveTaskWork } from "./PartyActiveTaskWork";
import type { PartyActiveTaskWorkHostRef } from "../lib/party-active-task-work-host";
import { refreshPartyTaskWorkQueries } from "../lib/party-task-work-refresh";
import type { PartyAppraisalExtensions } from "../lib/party-appraisal-extensions";
import type { PartyEngineeringSurveyExtensions } from "../lib/party-engineering-survey-extensions";
import type { PartyTaskPageDef } from "@platform/app-shared/prototype/party-task-pages";
import type { WorkflowTask } from "../lib/prototype/tasks-storage";

/** غلاف رفيع عند حدود القائمة — أسماء *Action لتتوافق مع Next.js. */
export function PartyActiveTaskWorkPanel({
  def,
  task,
  layout = "panel",
  onRefreshAction,
  onCloseAction,
  appraisalExtensions,
  engineeringSurveyExtensions,
}: {
  def: PartyTaskPageDef;
  task: WorkflowTask;
  layout?: "page" | "panel";
  onRefreshAction: () => void;
  onCloseAction?: () => void;
  appraisalExtensions?: PartyAppraisalExtensions;
  engineeringSurveyExtensions?: PartyEngineeringSurveyExtensions;
}) {
  const queryClient = useQueryClient();
  const hostRef = useRef<PartyActiveTaskWorkHostRef>({});
  hostRef.current.onRefresh = () => {
    refreshPartyTaskWorkQueries(queryClient, def.pageId);
    onRefreshAction();
  };
  hostRef.current.onClose = onCloseAction;

  return (
    <PartyActiveTaskWork
      def={def}
      task={task}
      hostRef={hostRef}
      layout={layout}
      appraisalExtensions={appraisalExtensions}
      engineeringSurveyExtensions={engineeringSurveyExtensions}
    />
  );
}
