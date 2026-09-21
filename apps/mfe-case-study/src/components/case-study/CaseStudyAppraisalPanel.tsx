"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Label,
  cn,
  formControlClassName,
  useToast,
} from "@platform/ui-kit";
import { SpecialistValuationReportInputs } from "../po-intake/SpecialistValuationReportInputs";
import { CaseStudyDeedNatureMatchReview } from "./CaseStudyDeedNatureMatchReview";
import { PropertyDetailInspectionTab } from "../po-intake/PropertyDetailInspectionTab";
import { EmptyState } from "../po-intake/PropertyDetailFields";
import { findPropertyForTask } from "../../lib/app-data/my-task-row";
import type { WorkflowTask } from "../../lib/app-data/tasks";
import { childTasksForCaseStudyParent } from "../../lib/app-data/case-study-party-answers";
import {
  CASE_STUDY_SPECIALIST_FEATURE_KEYS,
  isInspectorWorkspaceAccepted,
  submittedInspectorAssetIsLand,
  SPECIALIST_ACCEPT_INSPECTOR_INPUTS_LABEL,
  SPECIALIST_ACCEPT_INSPECTOR_INPUTS_SUCCESS,
  type InspectorWorkspaceStatus,
} from "../../lib/app-data/inspector-workspace-data";
import { partyTaskPageDef } from "@platform/app-shared/app-data/party-task-pages";
import { reopenInspectorWorkspace } from "../../lib/app-data/inspector-workspace-commands";
import { loadInspectorWorkspaceSnapshot } from "../../lib/app-data/inspector-workspace-reads";
import {
  buildPropertyDetailPartyCards,
  type PropertyDetailPartyCard,
} from "../../lib/app-data/property-detail-parties";
import { listPropertyDetailPhotos } from "../../lib/app-data/property-detail-documents";
import { usePropertyDetailDocuments } from "../../query/property-detail-documents-query";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import { resolveAssigneeDisplayName } from "@platform/app-shared/fees/party-fee-meta";
import { FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT } from "../../lib/app-data/inspector-workspace-model";
import { migrateDistribution } from "../../lib/app-data/tasks";
import {
  loadSpecialistFinishingLevel,
  saveSpecialistFinishingLevel,
  specialistFinishingLevelForInspection,
} from "../../lib/app-data/valuation-report-specialist-finishing";

export function relatedTaskId(
  tasks: WorkflowTask[],
  propertyId: string,
  kind: WorkflowTask["kind"],
): string | null {
  return (
    tasks.find((t) => t.propertyId === propertyId && t.kind === kind)?.id ??
    null
  );
}

export function CaseStudyAppraisalPanel({
  property,
  poNumber,
  tasks,
  caseStudyTask,
  documentsEnabled,
}: {
  property: NonNullable<ReturnType<typeof findPropertyForTask>>;
  poNumber: string;
  tasks: WorkflowTask[];
  caseStudyTask: WorkflowTask;
  /** True once a tab that shows transaction photos has been visited (fanout gate). */
  documentsEnabled: boolean;
}) {
  const { showToast } = useToast();
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnNote, setReturnNote] = useState("");
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returning, setReturning] = useState(false);
  const [inspectionPackageStatus, setInspectionPackageStatus] =
    useState<InspectorWorkspaceStatus | null>(null);
  const [inspectionAssetSubject, setInspectionAssetSubject] = useState("");
  const [inspectionSnapshotLoaded, setInspectionSnapshotLoaded] = useState(false);
  const [inspectionAccepted, setInspectionAccepted] = useState(false);
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
      setInspectionAssetSubject("");
      setInspectionSnapshotLoaded(false);
      setInspectionAccepted(false);
      return;
    }
    let cancelled = false;
    const load = () => {
      void loadInspectorWorkspaceSnapshot(inspectionTask.id).then((draft) => {
        if (cancelled) return;
        setInspectionPackageStatus(draft?.status ?? null);
        setInspectionAssetSubject(draft?.featureValues.assetSubject ?? "");
        setInspectionSnapshotLoaded(true);
        setInspectionAccepted(isInspectorWorkspaceAccepted(draft));
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

  const inspectionUsesLand = submittedInspectorAssetIsLand({
    status: inspectionPackageStatus ?? "draft",
    assetSubject: inspectionAssetSubject,
    initialAssetSubject:
      property.propertyType?.trim() || property.classification?.trim() || "",
  });

  useEffect(() => {
    if (!inspectionSnapshotLoaded) return;
    const stored = loadSpecialistFinishingLevel(property.id);
    const applicable = specialistFinishingLevelForInspection(stored, {
      status: inspectionPackageStatus ?? "draft",
      assetSubject: inspectionAssetSubject,
      initialAssetSubject:
        property.propertyType?.trim() || property.classification?.trim() || "",
    });
    if (!stored || applicable) return;
    saveSpecialistFinishingLevel(property.id, "");
  }, [
    inspectionAssetSubject,
    inspectionPackageStatus,
    inspectionSnapshotLoaded,
    property.classification,
    property.id,
    property.propertyType,
  ]);

  const surveyTaskId = relatedTaskId(tasks, property.id, "engineering-survey");
  const engineeringAssigned = migrateDistribution(
    caseStudyTask.distribution,
  ).engineeringOffice;
  const appraisalTaskId = relatedTaskId(
    tasks,
    property.id,
    "property-appraisal",
  );
  const inspectionTaskId = inspectionTask?.id ?? null;
  /**
   * Transaction photos feed only the inspection input section below — the
   * attachment fan-out waits for that section to be reachable (same gate as
   * `usePoPropertyDetailTabsWorkflow`: a media tab visited, and something to show).
   */
  const propertyDocumentSections = usePropertyDetailDocuments({
    property,
    showDecree: true,
    poNumber,
    surveyTaskId,
    appraisalTaskId,
    inspectionTaskId,
    enabled: documentsEnabled && Boolean(inspectionTask && inspectionCard),
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
      <CaseStudyDeedNatureMatchReview
        caseStudyTaskId={caseStudyTask.id}
        property={property}
        poNumber={poNumber}
        surveyTaskId={surveyTaskId}
        inspectionTaskId={inspectionTaskId}
        engineeringAssigned={engineeringAssigned}
        readOnly={caseStudyTask.status === "completed" || inspectionAccepted}
      />
      <section className="mb-6">
        <div className="mb-3 flex flex-wrap items-center gap-2.5">
          <span className="h-[17px] w-[3px] rounded-full bg-gold" aria-hidden />
          <h3 className="m-0 text-[14px] font-extrabold text-heading"> معاينة العقار — مراجعة الاخصائي </h3>
          <span className="min-w-[1rem] flex-1 border-t border-border" aria-hidden />
          {inspectionAccepted ? (
            <span className="rounded-lg border border-[color-mix(in_srgb,var(--success)_35%,var(--border))] bg-[var(--success-bg)] px-3 py-1.5 text-[11.5px] font-semibold text-[var(--success)]">
              مؤكَّدة — القسم مقفل
            </span>
          ) : null}
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
          أنت مشرف على ما كتبه المعاين: راجع وعدّل إن لزم. «
          {SPECIALIST_ACCEPT_INSPECTOR_INPUTS_LABEL}» يقفل القسم ويفتح الحزمة
          للمقيّم. «إعادة للتصحيح» ترجع المهمة للمعاين للتعديل من جديد.
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

        {inspectionPackageStatus === "submitted" &&
        inspectionAssetSubject.trim() &&
        inspectionAssetSubject.trim() !== property.propertyType?.trim() ? (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            النوع المبدئي: {property.propertyType || "—"} · النوع المعتمد
            ميدانياً: {inspectionAssetSubject.trim()}
          </div>
        ) : null}

        {inspectionTask && inspectionCard ? (
          <PropertyDetailInspectionTab
            key={`${inspectionTask.id}:${inspectionReloadKey}`}
            property={property}
            inspectionTask={inspectionTask}
            surveyTask={
              surveyTaskId
                ? (tasks.find((t) => t.id === surveyTaskId) ?? null)
                : null
            }
            inspectionCard={inspectionCard}
            editMode
            lockEditMode
            includeRetiredFeatureKeys={CASE_STUDY_SPECIALIST_FEATURE_KEYS}
            serviceProofFromTransactionPhotos
            transactionPhotos={transactionPhotos}
            caseStudyDef={partyTaskPageDef("active-inspection") ?? undefined}
            submitSuccessToast={SPECIALIST_ACCEPT_INSPECTOR_INPUTS_SUCCESS}
            submitFooterAfter={!inspectionUsesLand ? (
              <SpecialistValuationReportInputs
                propertyId={property.id}
                poNumber={poNumber}
              />
            ) : (
              <></>
            )}
            onSubmitted={() => {
              setInspectionAccepted(true);
              setInspectionReloadKey((n) => n + 1);
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
