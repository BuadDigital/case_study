"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { Button, PageGutter, PageShell, PanelSkeleton } from "@platform/design-system";
import { partyTaskPageDef } from "@platform/app-shared/prototype/party-task-pages";
import type { PageId } from "@platform/types";
import type { PartyAppraisalExtensions } from "../lib/party-appraisal-extensions";
import type { PartyEngineeringSurveyExtensions } from "../lib/party-engineering-survey-extensions";
import type { PartyActiveTaskWorkHostRef } from "../lib/party-active-task-work-host";
import { partyTaskPath } from "../lib/my-task-routes";
import { useWorkflowTasksQuery } from "../query/case-study-queries";
import { PartyActiveTaskWork } from "./PartyActiveTaskWork";

export function PartyActiveTaskWorkPage({
  pageId,
  taskId,
  appraisalExtensions,
  engineeringSurveyExtensions,
}: {
  pageId: PageId;
  taskId: string;
  appraisalExtensions?: PartyAppraisalExtensions;
  engineeringSurveyExtensions?: PartyEngineeringSurveyExtensions;
}) {
  const router = useRouter();
  const hostRef = useRef<PartyActiveTaskWorkHostRef>({});
  hostRef.current.onClose = () => router.push(partyTaskPath(pageId));

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
    <PartyActiveTaskWork
      def={def}
      task={task}
      hostRef={hostRef}
      layout="page"
      appraisalExtensions={appraisalExtensions}
      engineeringSurveyExtensions={engineeringSurveyExtensions}
    />
  );
}
