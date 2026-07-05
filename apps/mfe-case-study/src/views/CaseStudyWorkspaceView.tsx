"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, type ReactNode } from "react";
import { Button, Note, PageShell, PanelSkeleton } from "@platform/design-system";
import { CaseStudyForm } from "../components/case-study/CaseStudyForm";
import { PropertyDetailHero } from "../components/po-intake/PropertyDetailHero";
import { PropertyTransactionTimeline } from "../components/po-intake/PropertyTransactionTimeline";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { activeCaseStudyPath } from "../lib/my-task-routes";
import { poPropertyPath } from "../lib/po-routes";
import { findPropertyForTask } from "../lib/prototype/my-task-row";
import { canOpenCaseStudyWorkspace } from "../lib/prototype/viewer-task-access";
import type { WorkflowTask } from "../lib/prototype/tasks-storage";
import {
  usePoRecordQuery,
  useWorkflowTasksQuery,
} from "../query/case-study-queries";

export type CaseStudyWorkspacePartiesExtrasProps = {
  task: WorkflowTask;
  property: ReturnType<typeof findPropertyForTask>;
  tasks: WorkflowTask[];
};

function caseStudyWorkspaceFallbackPath(task: WorkflowTask | null): string {
  if (task?.propertyId) {
    return poPropertyPath(task.poNumber.trim(), task.propertyId);
  }
  if (task?.poNumber.trim()) {
    return poPropertyPath(task.poNumber.trim());
  }
  return activeCaseStudyPath();
}

export function CaseStudyWorkspaceView({
  taskId,
  renderPartiesExtras,
}: {
  taskId: string;
  renderPartiesExtras?: (
    props: CaseStudyWorkspacePartiesExtrasProps,
  ) => ReactNode;
}) {
  const router = useRouter();
  const { role } = usePrototype();
  const {
    data: tasks,
    isFetched: tasksFetched,
    isPending: tasksPending,
    isError: tasksError,
    error: tasksQueryError,
    refetch: refetchTasks,
  } = useWorkflowTasksQuery();

  const task = useMemo((): WorkflowTask | null => {
    return tasks?.find((t) => t.id === taskId) ?? null;
  }, [tasks, taskId]);

  const canAccess = useMemo(() => {
    if (!task) return false;
    return canOpenCaseStudyWorkspace(role, task, tasks ?? []);
  }, [task, role, tasks]);

  const {
    data: record,
    isPending: recordLoading,
    isFetched: recordFetched,
    isError: recordError,
    error: recordQueryError,
    refetch: refetchRecord,
  } = usePoRecordQuery(task?.poNumber ?? null);

  const property = useMemo(
    () => (task && record ? findPropertyForTask(record, task) : null),
    [task, record],
  );

  const propertyIndex = useMemo(() => {
    if (!record || !property) return -1;
    return record.properties.findIndex((p) => p.id === property.id);
  }, [record, property]);

  const loading =
    (!tasksFetched && tasksPending) ||
    (Boolean(task?.poNumber) && recordLoading && !record);

  const loadErrorMessage =
    (tasksQueryError instanceof Error ? tasksQueryError.message : null) ??
    (recordQueryError instanceof Error ? recordQueryError.message : null) ??
    "تعذّر تحميل بيانات دراسة الحالة";

  const hasLoadError =
    (tasksFetched && tasksError) ||
    (Boolean(task?.poNumber) && recordFetched && recordError);

  const shouldRedirect =
    !loading &&
    !hasLoadError &&
    tasksFetched &&
    (!task || !canAccess || (recordFetched && (!record || !property)));

  useEffect(() => {
    if (!shouldRedirect) return;
    router.replace(caseStudyWorkspaceFallbackPath(task));
  }, [shouldRedirect, task, router]);

  if (loading) {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-bg">
        <PanelSkeleton />
      </div>
    );
  }

  if (hasLoadError) {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-bg p-4">
        <Note tone="warn">{loadErrorMessage}</Note>
        <div className="mt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void refetchTasks();
              if (task?.poNumber) void refetchRecord();
            }}
          >
            إعادة المحاولة
          </Button>
        </div>
      </div>
    );
  }

  if (shouldRedirect || !task) {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-bg">
        <PanelSkeleton />
      </div>
    );
  }

  if (!record || !property || propertyIndex < 0) {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-bg">
        <PanelSkeleton />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-bg">
      <PageShell>
        <PropertyDetailHero
          record={record}
          property={property}
          propertyIndex={propertyIndex + 1}
        />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-row items-stretch overflow-hidden max-lg:flex-col">
            <div className="min-w-0 flex-1 overflow-y-auto px-4 py-4 sm:p-5">
              <CaseStudyForm
                taskId={taskId}
                task={task}
                property={property}
                poRecord={record}
                requestDateSeed={record.receivedFromEnfathAt}
              />
              {renderPartiesExtras ? (
                <div className="mt-4 border-t border-border pt-4">
                  {renderPartiesExtras({
                    task,
                    property,
                    tasks: tasks ?? [],
                  })}
                </div>
              ) : null}
            </div>
            <PropertyTransactionTimeline record={record} property={property} />
          </div>
        </div>
      </PageShell>
    </div>
  );
}
