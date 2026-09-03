"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Button,
  Label,
  Note,
  PageShell,
  PanelSkeleton,
  Tab,
  TabBar,
  cn,
  formControlClassName,
  opsContentPanel,
  useToast,
} from "@platform/ui-kit";
import { CaseStudyForm } from "../components/case-study/CaseStudyForm";
import { SpecialistValuationReportInputs } from "../components/po-intake/SpecialistValuationReportInputs";
import { PropertyDetailInspectionTab } from "../components/po-intake/PropertyDetailInspectionTab";
import { EmptyState } from "../components/po-intake/PropertyDetailFields";
import { PropertyDetailHero } from "../components/po-intake/PropertyDetailHero";
import { PropertyTransactionTimeline } from "../components/po-intake/PropertyTransactionTimeline";
import { ReturnedForCorrectionNote } from "../components/ui/ReturnedForCorrectionNote";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { activeCaseStudyPath } from "../lib/my-task-routes";
import { poPropertiesPath, poPropertyPath } from "@platform/app-shared/domain/po-routes";
import { findPropertyForTask } from "../lib/app-data/my-task-row";
import { canOpenCaseStudyWorkspace } from "../lib/app-data/viewer-task-access";
import type { WorkflowTask } from "../lib/app-data/tasks-storage";
import { childTasksForCaseStudyParent } from "../lib/app-data/case-study-party-answers";
import { CASE_STUDY_SPECIALIST_FEATURE_KEYS } from "../lib/app-data/inspector-workspace-data";
import { reopenInspectorWorkspace } from "../lib/app-data/inspector-workspace-commands";
import { loadInspectorWorkspaceSnapshot } from "../lib/app-data/inspector-workspace-reads";
import {
  buildPropertyDetailPartyCards,
  type PropertyDetailPartyCard,
} from "../lib/app-data/property-detail-parties";
import { listPropertyDetailPhotos } from "../lib/app-data/property-detail-documents";
import {
  usePoRecordQuery,
  useWorkflowTasksQuery,
} from "../query/case-study-queries";
import { usePropertyDetailDocuments } from "../query/property-detail-documents-query";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import { resolveAssigneeDisplayName } from "@platform/app-shared/fees/party-fee-meta";
import { FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT } from "../lib/app-data/inspector-workspace-model";

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
  caseStudyTask,
}: {
  property: NonNullable<ReturnType<typeof findPropertyForTask>>;
  poNumber: string;
  tasks: WorkflowTask[];
  caseStudyTask: WorkflowTask;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnNote, setReturnNote] = useState("");
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);
  const [inspectionPackageStatus, setInspectionPackageStatus] = useState<
    string | null
  >(null);
  const [inspectionReturnNote, setInspectionReturnNote] = useState<string | null>(
    null,
  );
  const [inspectionReloadKey, setInspectionReloadKey] = useState(0);

  const inspectionTask = useMemo(() => {
    const fromParent = childTasksForCaseStudyParent(caseStudyTask.id, tasks).find(
      (t) => t.kind === "field-inspection",
    );
    if (fromParent) return fromParent;
    return (
      tasks.find(
        (t) =>
          t.kind === "field-inspection" &&
          t.poNumber.trim() === poNumber.trim() &&
          t.propertyId === property.id,
      ) ?? null
    );
  }, [caseStudyTask.id, tasks, poNumber, property.id]);

  const inspectionCard = useMemo((): PropertyDetailPartyCard | null => {
    const fromParties = buildPropertyDetailPartyCards({
      task: caseStudyTask,
      allTasks: tasks,
      staffUsers,
    }).find((c) => c.roleKey === "inspection");
    if (fromParties?.enabled) return fromParties;
    if (!inspectionTask) return null;
    return {
      roleKey: "inspection",
      role: "المعاين",
      name:
        resolveAssigneeDisplayName({
          assigneeName: inspectionTask.assigneeName,
          assigneeId: inspectionTask.assigneeId,
          staffUsers,
          fallback: "المعاين",
        }) || "المعاين",
      unassigned: false,
      state: "progress",
      enabled: true,
    };
  }, [caseStudyTask, tasks, staffUsers, inspectionTask]);

  useEffect(() => {
    if (!inspectionTask) {
      setInspectionPackageStatus(null);
      setInspectionReturnNote(null);
      return;
    }
    let cancelled = false;
    const load = () => {
      void loadInspectorWorkspaceSnapshot(inspectionTask.id).then((draft) => {
        if (cancelled) return;
        setInspectionPackageStatus(draft?.status ?? null);
        setInspectionReturnNote(draft?.returnNote?.trim() || null);
      });
    };
    load();
    const onChange = () => load();
    window.addEventListener(FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(
        FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
        onChange,
      );
    };
  }, [inspectionTask, inspectionReloadKey]);

  const surveyTaskId = relatedTaskId(tasks, property.id, "engineering-survey");
  const appraisalTaskId = relatedTaskId(
    tasks,
    property.id,
    "property-appraisal",
  );
  const inspectionTaskId = inspectionTask?.id ?? null;
  const propertyDocumentSections = usePropertyDetailDocuments({
    property,
    showDecree: true,
    poNumber,
    surveyTaskId,
    appraisalTaskId,
    inspectionTaskId,
  });
  const transactionPhotos = useMemo(
    () => listPropertyDetailPhotos(propertyDocumentSections),
    [propertyDocumentSections],
  );

  const canReturnToInspector =
    Boolean(inspectionTask) &&
    (inspectionPackageStatus === "submitted" ||
      inspectionTask?.status === "completed");

  async function handleReturnToInspector() {
    if (!inspectionTask || returning) return;
    const trimmed = returnNote.trim();
    if (!trimmed) {
      setReturnError("يجب إدخال سبب الإرجاع للتصحيح");
      return;
    }
    setReturning(true);
    setReturnError(null);
    const reopened = await reopenInspectorWorkspace(inspectionTask.id, trimmed);
    setReturning(false);
    if (!reopened.ok) {
      setReturnError(reopened.error);
      return;
    }
    setReturnOpen(false);
    setReturnNote("");
    setInspectionReloadKey((n) => n + 1);
    showToast("أُعيدت المعاينة للمعاين للتصحيح", "success");
  }

  return (
    <div className="pt-5">
      <section className="mb-6">
        <div className="mb-3 flex flex-wrap items-center gap-2.5">
          <span className="h-[17px] w-[3px] rounded-full bg-gold" aria-hidden />
          <h3 className="m-0 text-[14px] font-extrabold text-heading">
            معاينة العقار — إدخال البيانات
          </h3>
          <span className="min-w-[1rem] flex-1 border-t border-border" aria-hidden />
          {canReturnToInspector && !returnOpen ? (
            <button
              type="button"
              className="rounded-lg border border-border-md bg-surface px-3.5 py-1.5 text-[11.5px] font-bold text-text-2 max-lg:min-h-11 max-lg:rounded-[12px] max-lg:text-[13px]"
              disabled={returning}
              onClick={() => {
                setReturnOpen(true);
                setReturnError(null);
              }}
            >
              إعادة للتصحيح
            </button>
          ) : null}
        </div>
        <p className="mb-3 text-[11.5px] leading-relaxed text-text-3">
          راجع بيانات المعاين وعدّلها إن لزم. «حفظ وإرسال» يعتمد الحزمة ويفتح
          التقييم للمقيم. «إعادة للتصحيح» ترجع المهمة للمعاين.
        </p>

        {returnOpen ? (
          <div className="mb-3.5 rounded-lg border border-border bg-surface px-3.5 py-3">
            <Label htmlFor="cs-inspection-return-note" className="text-xs">
              سبب الإرجاع للمعاين <span className="text-danger-text">*</span>
            </Label>
            <textarea
              id="cs-inspection-return-note"
              className={cn(formControlClassName, "mt-1 min-h-[72px] text-xs")}
              value={returnNote}
              onChange={(e) => setReturnNote(e.target.value)}
              placeholder="صف ما يجب تصحيحه في تقرير المعاين…"
            />
            {returnError ? (
              <p className="mt-1 mb-0 text-xs text-danger-text">{returnError}</p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="primary"
                loading={returning}
                showActionToast={false}
                onClick={() => void handleReturnToInspector()}
              >
                تأكيد الإرجاع للمعاين
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={returning}
                onClick={() => {
                  setReturnOpen(false);
                  setReturnError(null);
                  setReturnNote("");
                }}
              >
                إلغاء
              </Button>
            </div>
          </div>
        ) : null}

        {inspectionPackageStatus === "reopened" && inspectionReturnNote ? (
          <ReturnedForCorrectionNote
            note={inspectionReturnNote}
            className="mb-3"
          />
        ) : null}

        {inspectionTask && inspectionCard ? (
          <PropertyDetailInspectionTab
            key={`${inspectionTask.id}:${inspectionReloadKey}`}
            property={property}
            inspectionTask={inspectionTask}
            inspectionCard={inspectionCard}
            editMode
            lockEditMode
            includeRetiredFeatureKeys={CASE_STUDY_SPECIALIST_FEATURE_KEYS}
            serviceProofFromTransactionPhotos
            transactionPhotos={transactionPhotos}
            submitSuccessToast="تم حفظ وإرسال المعاينة — يمكن للمقيم بدء التقييم"
            submitFooterAfter={
              <SpecialistValuationReportInputs
                propertyId={property.id}
                poNumber={poNumber}
              />
            }
            onSubmitted={() => {
              setInspectionReloadKey((n) => n + 1);
              // Match party-task handoff: let the success toast paint, then leave.
              window.setTimeout(() => {
                router.push(poPropertyPath(poNumber, property.id));
              }, 900);
            }}
          />
        ) : (
          <EmptyState
            title="لا توجد مهمة معاينة بعد"
            sub="يُفعَّل إدخال بيانات المعاينة بعد تعيين المعاين من توزيع المعاملات."
          />
        )}
      </section>
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
  const { role } = useAppAccess();
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
                caseStudyTask={task}
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
