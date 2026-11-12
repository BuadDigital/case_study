"use client";

import { useEffect, useMemo, useState } from "react";
import { useToast } from "@platform/ui-kit";
import { useAppAccess } from "@platform/app-shared/contexts/AppAccessContext";
import { canAcceptPartyWork } from "../../lib/app-data/po-roles";
import { SpecialistValuationReportInputs } from "../po-intake/SpecialistValuationReportInputs";
import { ReturnInspectionDialog } from "../po-intake/ReturnInspectionDialog";
import { returnInspectionSuccessMessage } from "../../lib/app-data/return-inspection-state";
import { CaseStudyDeedNatureMatchReview } from "./CaseStudyDeedNatureMatchReview";
import { InspectedTypeCorrection } from "./InspectedTypeCorrection";
import { reviewLockOf } from "../../lib/app-data/work-page-model";
import { getReportDraftState } from "@platform/app-shared/workflow/report-draft-state";
import { PropertyDetailInspectionTab } from "../po-intake/PropertyDetailInspectionTab";
import { EmptyState } from "../po-intake/PropertyDetailFields";
import { findPropertyForTask } from "../../lib/app-data/my-task-row";
import type { WorkflowTask } from "../../lib/app-data/tasks";
import { childTasksForCaseStudyParent } from "../../lib/app-data/case-study-party-answers";
import {
  CASE_STUDY_SPECIALIST_FEATURE_KEYS,
  isInspectorWorkspaceAccepted,
  submittedInspectorAssetIsLand,
  SPECIALIST_ACCEPT_INSPECTOR_INPUTS_SUCCESS,
  type InspectorWorkspaceStatus,
} from "@platform/app-shared/app-data/inspector-workspace-data";
import { loadInspectorWorkspaceSnapshot } from "../../lib/app-data/inspector-workspace-reads";
import {
  buildPropertyDetailPartyCards,
  type PropertyDetailPartyCard,
} from "../../lib/app-data/property-detail-parties";
import { listPropertyDetailPhotos } from "../../lib/app-data/property-detail-documents";
import { usePropertyDetailDocuments } from "../../query/property-detail-documents-query";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import { resolveAssigneeDisplayName } from "@platform/app-shared/fees/party-fee-meta";
import { migrateDistribution } from "../../lib/app-data/tasks";
import {
  loadSpecialistFinishingLevel,
  saveSpecialistFinishingLevel,
  specialistFinishingLevelForInspection,
} from "@platform/app-shared/app-data/valuation-report-specialist-finishing";
import { FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT } from "@platform/app-shared/events/app-events";
import { InspectorPhotoClassification } from "../coordination/InspectorPhotoClassification";

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

/**
 * Which page's share of the inspection review is shown (Omar 2026-11-08):
 * - "follow" — the coordinator's page: the inspector's package to read, correct, return or accept;
 *   no deed match, no components, no report inputs. The engineering office is no longer added from
 *   here (Omar 2026-11-11): «مهمة جديدة» in «المهام», type «رفع مساحي».
 * - "study" — the work page: the deed ↔ nature match, «مكونات العقار» and the report inputs, the
 *   accepted package read-only (the study may still return it to the inspector).
 * - none — every part, as the property details page and the study workspace always showed.
 *   It is two pages (Omar 2026-11-12: «صفحة للقراءة فقط، وصفحة إذا جات مدخلات المعاين»): while
 *   the inspector's package is submitted and waits for its confirmation, the review as it always
 *   was — correct, choose the deed-match outcome and the finishing level, confirm or return;
 *   at every other time (not submitted yet, returned to the inspector, confirmed) the same
 *   content read-only, the deed-match outcome and the finishing level included. The confirmed
 *   page keeps «إلغاء الاعتماد وإعادة للتصحيح», the way back to the review.
 */
export type AppraisalReviewStage = "follow" | "study";

export function CaseStudyAppraisalPanel({
  property,
  poNumber,
  tasks,
  caseStudyTask,
  documentsEnabled,
  stage,
}: {
  property: NonNullable<ReturnType<typeof findPropertyForTask>>;
  poNumber: string;
  tasks: WorkflowTask[];
  caseStudyTask: WorkflowTask;
  documentsEnabled: boolean;
  stage?: AppraisalReviewStage;
}) {
  const { showToast } = useToast();
  // Only the study (and management) accepts party work: the review mode saves the inspector's draft
  // as it loads, so coordination and review read it instead (fixed 2026-11-05 — they met a refusal
  // once the workspace and the work page opened to every sub-role).
  const { access } = useAppAccess();
  const mayAccept = canAcceptPartyWork(access);
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = useMemo(() => staffResult?.users ?? [], [staffResult]);
  const [returnOpen, setReturnOpen] = useState(false);
  const [inspectionPackageStatus, setInspectionPackageStatus] =
    useState<InspectorWorkspaceStatus | null>(null);
  const [inspectionAssetSubject, setInspectionAssetSubject] = useState("");
  const [inspectionUsage, setInspectionUsage] = useState("");
  const [inspectionSnapshotLoaded, setInspectionSnapshotLoaded] =
    useState(false);
  const [inspectionSnapshotTaskId, setInspectionSnapshotTaskId] = useState<
    string | null
  >(null);
  const [inspectionAccepted, setInspectionAccepted] = useState(false);
  const [inspectionReloadKey, setInspectionReloadKey] = useState(0);

  const inspectionTask = useMemo(() => {
    const fromParent = childTasksForCaseStudyParent(
      caseStudyTask.id,
      tasks,
    ).find((t) => t.kind === "field-inspection");
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
    if (!inspectionTask) return;
    let cancelled = false;
    let requestVersion = 0;
    const load = () => {
      const version = ++requestVersion;
      void loadInspectorWorkspaceSnapshot(inspectionTask.id)
        .then((draft) => {
          if (cancelled || version !== requestVersion) return;
          setInspectionSnapshotTaskId(inspectionTask.id);
          setInspectionPackageStatus(draft?.status ?? null);
          setInspectionAssetSubject(draft?.featureValues.assetSubject ?? "");
          setInspectionUsage(draft?.featureValues.propertyUsage ?? "");
          setInspectionSnapshotLoaded(true);
          setInspectionAccepted(isInspectorWorkspaceAccepted(draft));
        })
        .catch((error: unknown) => {
          if (cancelled || version !== requestVersion) return;
          setInspectionSnapshotTaskId(inspectionTask.id);
          setInspectionPackageStatus(null);
          setInspectionAssetSubject("");
          setInspectionUsage("");
          setInspectionSnapshotLoaded(false);
          setInspectionAccepted(false);
          showToast(
            error instanceof Error
              ? error.message
              : "تعذّر تحميل بيانات المعاينة",
            "error",
          );
        });
    };
    load();
    const onChange = () => load();
    window.addEventListener(
      FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
      onChange,
    );
    return () => {
      cancelled = true;
      window.removeEventListener(
        FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
        onChange,
      );
    };
  }, [inspectionTask, inspectionReloadKey, showToast]);

  const inspectionSnapshotIsCurrent =
    Boolean(inspectionTask) && inspectionSnapshotTaskId === inspectionTask?.id;
  const currentInspectionPackageStatus = inspectionSnapshotIsCurrent
    ? inspectionPackageStatus
    : null;
  const currentInspectionAssetSubject = inspectionSnapshotIsCurrent
    ? inspectionAssetSubject
    : "";
  const currentInspectionSnapshotLoaded =
    inspectionSnapshotIsCurrent && inspectionSnapshotLoaded;
  const currentInspectionAccepted =
    inspectionSnapshotIsCurrent && inspectionAccepted;
  const inspectionAssetContext = useMemo(
    () => ({
      status: currentInspectionPackageStatus ?? "draft",
      assetSubject: currentInspectionAssetSubject,
      initialAssetSubject:
        property.propertyType?.trim() || property.classification?.trim() || "",
    }),
    [
      currentInspectionAssetSubject,
      currentInspectionPackageStatus,
      property.classification,
      property.propertyType,
    ],
  );
  const inspectionUsesLand = submittedInspectorAssetIsLand(
    inspectionAssetContext,
  );

  useEffect(() => {
    if (!currentInspectionSnapshotLoaded) return;
    const stored = loadSpecialistFinishingLevel(property.id);
    const applicable = specialistFinishingLevelForInspection(
      stored,
      inspectionAssetContext,
    );
    if (!stored || applicable) return;
    saveSpecialistFinishingLevel(property.id, "");
  }, [currentInspectionSnapshotLoaded, inspectionAssetContext, property.id]);

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

  /** Also after the inspection is accepted: the return withdraws the acceptance. */
  const canReturnToInspector =
    mayAccept &&
    Boolean(inspectionTask) &&
    (currentInspectionPackageStatus === "submitted" ||
      inspectionTask?.status === "completed");

  const studyClosed =
    caseStudyTask.status === "completed" || Boolean(caseStudyTask.studyReportIssued);
  // The study workspace (no stage) is read-only unless the inspector's inputs have arrived and
  // wait for the review — see `AppraisalReviewStage`. The coordinator's page and the work page
  // keep their own rules.
  const awaitingReview =
    currentInspectionPackageStatus === "submitted" && !currentInspectionAccepted;
  const readOnlyPage = !stage && !awaitingReview;
  const reviewEditable = mayAccept && stage !== "study" && !readOnlyPage;

  return (
    <div className="pt-5">
      {stage !== "follow" ? (
        <CaseStudyDeedNatureMatchReview
          caseStudyTaskId={caseStudyTask.id}
          property={property}
          poNumber={poNumber}
          surveyTaskId={surveyTaskId}
          inspectionTaskId={inspectionTaskId}
          engineeringAssigned={engineeringAssigned}
          readOnly={
            !mayAccept ||
            caseStudyTask.status === "completed" ||
            (readOnlyPage && !currentInspectionAccepted)
          }
          readOnlyOnceDecided={readOnlyPage && currentInspectionAccepted}
        />
      ) : null}
      <section className="mb-6">
        {/* Omar 2026-11-10: the «معاينة العقار — مراجعة الاخصائي» title and its explanation are gone —
            only the state badge and «إعادة للتصحيح» stay, at the row's end. */}
        {currentInspectionAccepted || canReturnToInspector ? (
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2.5">
          {currentInspectionAccepted ? (
            <span className="rounded-lg border border-[color-mix(in_srgb,var(--heading)_35%,var(--border))] bg-success-bg px-3 py-1.5 text-[11.5px] font-semibold text-heading">
              مؤكَّدة — القسم مقفل
            </span>
          ) : null}
          {canReturnToInspector ? (
            <button
              type="button"
              className="rounded-lg border border-border-md bg-surface px-3.5 py-1.5 text-[11.5px] font-bold text-text-2 max-lg:min-h-11 max-lg:rounded-[12px] max-lg:text-[13px]"
              onClick={() => setReturnOpen(true)}
            >
              {currentInspectionAccepted
                ? "إلغاء الاعتماد وإعادة للتصحيح"
                : "إعادة للتصحيح"}
            </button>
          ) : null}
        </div>
        ) : null}

        {inspectionTask ? (
          <ReturnInspectionDialog
            open={returnOpen}
            inspectionTaskId={inspectionTask.id}
            deedLabel={property.deedNumber}
            onClose={() => setReturnOpen(false)}
            onReturned={(result) => {
              setInspectionReloadKey((n) => n + 1);
              showToast(returnInspectionSuccessMessage(result), "success");
            }}
          />
        ) : null}

        {/* Omar 2026-11-12: the type and the usage the inspection states, with their correction for
            case staff — on every page of the review, also after the acceptance (the study), until
            review approves the study. */}
        {inspectionTask && currentInspectionPackageStatus === "submitted" ? (
          <InspectedTypeCorrection
            inspectionTaskId={inspectionTask.id}
            currentType={currentInspectionAssetSubject}
            currentUsage={inspectionSnapshotIsCurrent ? inspectionUsage : ""}
            bourseType={property.propertyType ?? ""}
            // The lock of every other property field: review approved the study, or the report
            // is approved / deposited (the server also refuses a transaction delivered to Enfaz).
            canCorrect={
              mayAccept &&
              reviewLockOf(caseStudyTask, getReportDraftState(property.id)) === null
            }
            onCorrected={() => setInspectionReloadKey((n) => n + 1)}
          />
        ) : null}

        {/* Omar 2026-11-08: the inspector's photos are classed in his section (the Enfaz photo files are
            built from them) — on the coordinator's page and on the work page alike. */}
        {stage === "follow" && inspectionTask ? (
          <InspectorPhotoClassification
            poNumber={poNumber}
            propertyId={property.id}
            photos={transactionPhotos}
            stored={property.photoMarks}
            studyTaskId={caseStudyTask.id}
            inspectionTaskId={inspectionTask.id}
          />
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
            editMode={reviewEditable}
            lockEditMode={reviewEditable}
            specialistComponents={
              stage === "follow"
                ? "hidden"
                : stage === "study"
                  ? { locked: !mayAccept || studyClosed }
                  : // The read-only page locks «مكونات العقار» too — also before the package arrives,
                    // when the review's own lock (set by the confirmation) is not on yet.
                    readOnlyPage
                    ? { locked: true }
                    : "with-review"
            }
            includeRetiredFeatureKeys={CASE_STUDY_SPECIALIST_FEATURE_KEYS}
            serviceProofFromTransactionPhotos
            // «مطابقة الصك على الطبيعة» above already lists the four sides (not on the follow-up page).
            boundariesShownAbove={stage !== "follow"}
            transactionPhotos={transactionPhotos}
            submitSuccessToast={SPECIALIST_ACCEPT_INSPECTOR_INPUTS_SUCCESS}
            submitFooterAfter={
              !inspectionUsesLand && stage !== "follow" ? (
                <SpecialistValuationReportInputs
                  propertyId={property.id}
                  poNumber={poNumber}
                  readOnly={readOnlyPage}
                />
              ) : (
                <></>
              )
            }
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
