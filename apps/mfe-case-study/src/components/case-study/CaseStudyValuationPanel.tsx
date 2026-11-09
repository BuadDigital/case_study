"use client";

import { Suspense, useMemo } from "react";
import { InlineLoadingSkeleton, useWorkDensity } from "@platform/ui-kit";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { canReviewTransaction } from "../../lib/app-data/po-roles";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import { resolveAssigneeDisplayName } from "@platform/app-shared/fees/party-fee-meta";
import { PropertyDetailAppraisalTab } from "./lazy-workspace-panels";
import { childTasksForCaseStudyParent } from "../../lib/app-data/case-study-party-answers";
import {
  buildPropertyDetailPartyCards,
  type PropertyDetailPartyCard,
} from "../../lib/app-data/property-detail-parties";
import type { findPropertyForTask } from "../../lib/app-data/my-task-row";
import type { WorkflowTask } from "../../lib/app-data/tasks";
import { usePropertyDetailPartySubmissionsQuery } from "../../query/property-detail-party-submissions-queries";

/**
 * Step 3 — specialist reviews the appraiser's valuation report package.
 * Moved 2026-11-05 out of `CaseStudyWorkspaceView` so the work page shows the same block.
 * Accept stamps the package (valuation path ends); reopen stays available so
 * the case is not permanently locked (future edit flow comes later).
 */
export function CaseStudyValuationPanel({
  property,
  tasks,
  caseStudyTask,
}: {
  property: NonNullable<ReturnType<typeof findPropertyForTask>>;
  tasks: WorkflowTask[];
  caseStudyTask: WorkflowTask;
}) {
  const { data: staffResult } = useStaffUsersQuery();
  const { access } = useAppAccess();
  // The work page's layout (`work` density) (Omar 2026-11-09): the study reads the report's state; review works it.
  const studyCompact = useWorkDensity() && !canReviewTransaction(access);
  const staffUsers = useMemo(() => staffResult?.users ?? [], [staffResult]);

  const appraisalTask = useMemo(() => {
    const fromParent = childTasksForCaseStudyParent(
      caseStudyTask.id,
      tasks,
    ).find((t) => t.kind === "property-appraisal");
    if (fromParent) return fromParent;
    return (
      tasks.find(
        (t) =>
          t.kind === "property-appraisal" &&
          t.poNumber.trim() === caseStudyTask.poNumber.trim() &&
          t.propertyId === property.id,
      ) ?? null
    );
  }, [caseStudyTask.id, caseStudyTask.poNumber, tasks, property.id]);

  const appraisalCard = useMemo((): PropertyDetailPartyCard | null => {
    const fromParties = buildPropertyDetailPartyCards({
      task: caseStudyTask,
      allTasks: tasks,
      staffUsers,
    }).find((c) => c.roleKey === "appraisal");
    if (fromParties?.enabled) return fromParties;
    if (!appraisalTask) return null;
    return {
      roleKey: "appraisal",
      role: "المقيّم العقاري",
      name:
        resolveAssigneeDisplayName({
          assigneeName: appraisalTask.assigneeName,
          assigneeId: appraisalTask.assigneeId,
          staffUsers,
          fallback: "المقيّم",
        }) || "المقيّم",
      unassigned: false,
      state: "progress",
      enabled: true,
    };
  }, [caseStudyTask, tasks, staffUsers, appraisalTask]);

  const partySubmissionsQuery = usePropertyDetailPartySubmissionsQuery({
    parentTask: caseStudyTask,
    allTasks: tasks,
    enabled: true,
  });

  return (
    <div className="pt-5">
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <span className="h-[17px] w-[3px] rounded-full bg-gold" aria-hidden />
        <h3 className="m-0 text-[14px] font-extrabold text-heading">
          {studyCompact ? "تقرير التقييم" : "تقرير التقييم — مراجعة الأخصائي"}
        </h3>
        <span className="min-w-[1rem] flex-1 border-t border-border" aria-hidden />
      </div>
      <p className="mb-3 text-[11.5px] leading-relaxed text-text-3">
        {studyCompact
          ? "يعمل على التقرير المقيّم والمراجع — هنا حالته، ومعاينته للقراءة."
          : "يصل التقرير هنا بعد إرسال المقيّم. اعتمد التقرير لإتمام مسار التقييم، أو أعده للتصحيح. الاعتماد لا يقفل المعاملة نهائيًا — يمكن إعادة فتحها لاحقًا."}
      </p>
      <Suspense fallback={<InlineLoadingSkeleton className="my-2" />}>
        <PropertyDetailAppraisalTab
          property={property}
          appraisalTask={appraisalTask}
          tasks={tasks}
          appraisalCard={appraisalCard}
          submission={partySubmissionsQuery.data?.appraisal ?? null}
          onReviewChanged={() => {
            void partySubmissionsQuery.refetch();
          }}
        />
      </Suspense>
    </div>
  );
}
