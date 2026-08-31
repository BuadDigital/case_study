"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Button,
  Note,
  PageShell,
  PanelSkeleton,
  Tab,
  TabBar,
  opsContentPanel,
} from "@platform/ui-kit";
import { CaseStudyForm } from "../components/case-study/CaseStudyForm";
import { CaseStudyPropertyComparablesTab } from "../components/case-study/CaseStudyPropertyComparablesTab";
import { SpecialistValuationReportInputs } from "../components/po-intake/SpecialistValuationReportInputs";
import { PropertyDetailHero } from "../components/po-intake/PropertyDetailHero";
import { PropertyTransactionTimeline } from "../components/po-intake/PropertyTransactionTimeline";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import { activeCaseStudyPath } from "../lib/my-task-routes";
import { poPropertiesPath, poPropertyPath } from "@platform/app-shared/domain/po-routes";
import { findPropertyForTask } from "../lib/prototype/my-task-row";
import { canOpenCaseStudyWorkspace } from "../lib/prototype/viewer-task-access";
import type { WorkflowTask } from "../lib/prototype/tasks-storage";
import {
  usePoRecordQuery,
  useWorkflowTasksQuery,
} from "../query/case-study-queries";
import { usePropertyDetailDocuments } from "../query/property-detail-documents-query";

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
    return poPropertiesPath(task.poNumber.trim());
  }
  return activeCaseStudyPath();
}

function relatedTaskId(
  tasks: WorkflowTask[],
  propertyId: string,
  kind: WorkflowTask["kind"],
): string | null {
  return (
    tasks.find((t) => t.propertyId === propertyId && t.kind === kind)?.id ??
    null
  );
}

function CaseStudyAppraisalPanel({
  property,
  poNumber,
  tasks,
}: {
  property: NonNullable<ReturnType<typeof findPropertyForTask>>;
  poNumber: string;
  tasks: WorkflowTask[];
}) {
  const surveyTaskId = relatedTaskId(tasks, property.id, "engineering-survey");
  const appraisalTaskId = relatedTaskId(
    tasks,
    property.id,
    "property-appraisal",
  );
  const inspectionTaskId = relatedTaskId(
    tasks,
    property.id,
    "field-inspection",
  );
  const propertyDocumentSections = usePropertyDetailDocuments({
    property,
    showDecree: true,
    poNumber,
    surveyTaskId,
    appraisalTaskId,
    inspectionTaskId,
  });
  const propertyDocuments = useMemo(
    () => propertyDocumentSections.flatMap((s) => s.documents),
    [propertyDocumentSections],
  );

  return (
    <div className="pt-5">
      <SpecialistValuationReportInputs
        propertyId={property.id}
        documents={propertyDocuments}
      />
      <CaseStudyPropertyComparablesTab
        property={property}
        poNumber={poNumber}
      />
    </div>
  );
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
  const [workspaceTab, setWorkspaceTab] = useState<"study" | "appraisal">(
    "study",
  );
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
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#f5f3ee]">
        <PanelSkeleton />
      </div>
    );
  }

  if (hasLoadError) {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#f5f3ee] p-4">
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
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#f5f3ee]">
        <PanelSkeleton />
      </div>
    );
  }

  if (!record || !property || propertyIndex < 0) {
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#f5f3ee]">
        <PanelSkeleton />
      </div>
    );
  }

  return (
    <div
      id="view-case-study-workspace"
      className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#f5f3ee] [zoom:0.85]"
    >
      <PageShell
        variant="canvas"
        className="gap-0 overflow-y-auto bg-[#f5f3ee] px-[30px] py-[26px] max-sm:px-4 max-sm:py-4"
      >
        <PropertyDetailHero
          record={record}
          property={property}
          propertyIndex={propertyIndex + 1}
          hideOpenCaseStudy
        />

        <div className="grid min-h-0 flex-1 grid-cols-1 items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_250px]">
          <div className={opsContentPanel}>
            <TabBar
              className="mx-[-20px] mb-0 border-b border-border bg-transparent px-3.5"
              aria-label="أقسام دراسة الحالة"
            >
              <Tab
                active={workspaceTab === "study"}
                onClick={() => setWorkspaceTab("study")}
              >
                نموذج الدراسة
              </Tab>
              <Tab
                active={workspaceTab === "appraisal"}
                onClick={() => setWorkspaceTab("appraisal")}
              >
                تقييم العقار
              </Tab>
            </TabBar>
            {workspaceTab === "study" ? (
              <CaseStudyForm
                taskId={taskId}
                task={task}
                property={property}
                poRecord={record}
                requestDateSeed={record.receivedFromEnfathAt}
              />
            ) : (
              <CaseStudyAppraisalPanel
                property={property}
                poNumber={record.poNumber}
                tasks={tasks ?? []}
              />
            )}
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
      </PageShell>
    </div>
  );
}
