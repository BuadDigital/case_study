"use client";

import { useRouter } from "next/navigation";
import { useMemo, type ReactNode } from "react";
import { Button, Note, PageGutter, PageShell, PanelSkeleton } from "@platform/design-system";
import { CaseStudyForm } from "../components/case-study/CaseStudyForm";
import { PropertyDetailHero } from "../components/po-intake/PropertyDetailHero";
import { PropertyTransactionTimeline } from "../components/po-intake/PropertyTransactionTimeline";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { taskMatchesCaseStudy } from "@platform/app-shared/prototype/active-transactions";
import { activeCaseStudyPath } from "../lib/my-task-routes";
import { findPropertyForTask } from "../lib/prototype/my-task-row";
import { canViewWorkflowTask } from "../lib/prototype/viewer-task-access";
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
  } = useWorkflowTasksQuery();

  const task = useMemo((): WorkflowTask | null => {
    return tasks?.find((t) => t.id === taskId) ?? null;
  }, [tasks, taskId]);

  const canAccess = useMemo(() => {
    if (!task) return false;
    return canViewWorkflowTask({
      role,
      task,
      tasks: tasks ?? [],
      pageId: "active-case-study",
      matchesPage: taskMatchesCaseStudy,
    });
  }, [task, role, tasks]);

  const { data: record, isPending: recordLoading } = usePoRecordQuery(
    task?.poNumber ?? null,
  );

  const property = useMemo(
    () => (task && record ? findPropertyForTask(record, task) : null),
    [task, record],
  );

  const propertyIndex = useMemo(() => {
    if (!record || !property) return -1;
    return record.properties.findIndex((p) => p.id === property.id);
  }, [record, property]);

  const loading =
    (!tasksFetched && tasksPending) || (recordLoading && !record);

  if (!loading && (!task || !canAccess)) {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-bg">
        <PageGutter className="py-6">
          <Note tone="warn">
            لم تُعثر على معاملة دراسة الحالة أو لا تملك صلاحية عرضها.
            <div className="mt-3">
              <Button
                size="sm"
                variant="default"
                type="button"
                onClick={() => router.push(activeCaseStudyPath())}
              >
                رجوع لدراسة حالة العقارات
              </Button>
            </div>
          </Note>
        </PageGutter>
      </div>
    );
  }

  if (loading || !task) {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-bg">
        <PanelSkeleton />
      </div>
    );
  }

  if (!record || !property || propertyIndex < 0) {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-bg">
        <PageGutter className="py-6">
          <Note tone="warn">
            لم تُعثر على بيانات العقار.
            <div className="mt-3">
              <Button
                size="sm"
                variant="default"
                type="button"
                onClick={() => router.push(activeCaseStudyPath())}
              >
                رجوع لدراسة حالة العقارات
              </Button>
            </div>
          </Note>
        </PageGutter>
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
            <div className="min-w-0 flex-1 overflow-y-auto p-5">
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
