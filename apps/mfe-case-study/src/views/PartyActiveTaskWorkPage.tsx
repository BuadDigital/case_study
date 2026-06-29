"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, PageGutter, PageShell, PanelSkeleton } from "@platform/design-system";
import { partyTaskPageDef } from "@platform/app-shared/prototype/party-task-pages";
import type { PageId } from "@platform/types";
import type { PartyAppraisalExtensions } from "../lib/party-appraisal-extensions";
import type { PartyEngineeringSurveyExtensions } from "../lib/party-engineering-survey-extensions";
import type { PartyActiveTaskWorkHostRef } from "../lib/party-active-task-work-host";
import { refreshPartyTaskWorkQueries } from "../lib/party-task-work-refresh";
import { partyTaskPath } from "../lib/my-task-routes";
import { useWorkflowTasksQuery } from "../query/case-study-queries";
import { PartyActiveTaskWork } from "./PartyActiveTaskWork";

export function PartyActiveTaskWorkPage({
  pageId,
  taskId,
  appraisalExtensions,
  engineeringSurveyExtensions,
  engineeringSurveyEntry = false,
}: {
  pageId: PageId;
  taskId: string;
  appraisalExtensions?: PartyAppraisalExtensions;
  engineeringSurveyExtensions?: PartyEngineeringSurveyExtensions;
  engineeringSurveyEntry?: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const hostRef = useRef<PartyActiveTaskWorkHostRef>({});
  hostRef.current.onClose = () => router.push(partyTaskPath(pageId));
  hostRef.current.onRefresh = () => {
    refreshPartyTaskWorkQueries(queryClient, pageId);
  };

  const def = partyTaskPageDef(pageId);
  const { data: tasks, isFetched } = useWorkflowTasksQuery();
  const task = tasks?.find((t) => t.id === taskId);

  if (!def) {
    return (
      <p className="p-4 text-xs text-text-3">صفحة المهمة غير معرّفة.</p>
    );
  }

  if (!isFetched) {
    return <PanelSkeleton className="p-4" />;
  }

  if (!task) {
    return (
      <PageShell>
        <PageGutter className="py-8 text-center">
          <p className="m-0 text-[13px] text-text-3">
            لم تُعثر على المهمة أو لم تعد في قائمتك.
          </p>
          <Button
            type="button"
            size="sm"
            variant="primary"
            className="mt-3"
            onClick={() => router.push(partyTaskPath(pageId))}
          >
            العودة للقائمة
          </Button>
        </PageGutter>
      </PageShell>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PartyActiveTaskWork
        def={def}
        task={task}
        hostRef={hostRef}
        layout="page"
        appraisalExtensions={appraisalExtensions}
        engineeringSurveyExtensions={engineeringSurveyExtensions}
        engineeringSurveyEntry={engineeringSurveyEntry}
      />
    </div>
  );
}
