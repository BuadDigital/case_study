"use client";

import {
  InlineLoadingSkeleton,
  Spinner,
  cn,
  opsPpHeadCard,
  opsWorkspaceCard,
  useToast,
} from "@platform/ui-kit";
import {
  getOpenValuationRequestByProperty,
  getValuationIssuanceGates,
} from "@platform/api-client";
import { getAuthSession } from "@platform/auth-client";
import { useIdempotentAction } from "@platform/app-shared";
import { resolveAssigneeDisplayName } from "@platform/app-shared/fees/party-fee-meta";
import dynamic from "next/dynamic";
import { Activity, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorkflowTask } from "@platform/app-shared/workflow/task-types";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import { inspectionGateForAppraisal } from "../../lib/evaluator/evaluator-inspection-gate";
import { createEvaluatorDraft, emptyReportChoices } from "../../lib/evaluator/evaluator-window-data";
import type { EvaluatorSubmission } from "../../lib/evaluator/evaluator-window-data";
import {
  isEvaluatorFormLocked,
  type EvaluatorPlanImageMetadata,
  type EvaluatorReportMetadata,
} from "../../lib/evaluator/evaluator-submission-model";
import {
  hydrateEvaluatorSubmission,
  updateEvaluatorDraft,
} from "../../lib/evaluator/evaluator-submission-commands";
import { scheduleScrollToFormField } from "@platform/app-shared/form-ux";
import {
  firstEvaluatorError,
  firstEvaluatorErrorTarget,
  validateEvaluatorSubmission,
  type EvaluatorValidationErrors,
} from "../../lib/evaluator/evaluator-validation";
import { finalizeAppraiserSubmission } from "../../lib/evaluator/finalize-appraiser-submission";
import type { EvaluatorWindowHostRefObject } from "../../lib/evaluator/evaluator-window-host";
import type {
  EvaluatorChecklistAnswers,
  EvaluatorReportChoices,
  EvaluatorReportWorker,
} from "../../lib/evaluator/evaluator-window-data";
import { type EvaluatorPropertySummary } from "./EvaluatorPropertyTab";
import { EvaluatorValuationReportTab } from "./EvaluatorValuationReportTab";
import {
  appraiserInspectionDone,
  appraiserNeedsSurvey,
  appraiserSurveyDone,
} from "../../lib/evaluator/evaluator-readiness";
import { computePropertyTotal } from "../../lib/evaluator/value-estimation";
import { EngInfo, ValTabBar } from "./EvaluatorHtmlPrimitives";
import {
  ValuationWorkShell,
  type ValuationWorkNavAvailability,
  type ValuationWorkScreenId,
} from "./EvaluatorComparableSelectionPanel";

export type EvaluatorWindowTab = ValuationWorkScreenId | "output";

const EMPTY_FIELD_ERRORS: EvaluatorValidationErrors = {};

const WORK_SCREENS: ValuationWorkScreenId[] = [
  "basic",
  "market",
  "cost",
  "final",
  "review",
];

const VAL_TAB_DEFS: { id: EvaluatorWindowTab; label: string }[] = [
  { id: "basic", label: "البيانات الأساسية" },
  { id: "market", label: "طريقة المقارنة" },
  { id: "cost", label: "طريقة المقاول" },
  { id: "final", label: "رأي القيمة النهائي" },
  { id: "review", label: "المراجعة النهائية" },
  { id: "output", label: "تقرير التقييم" },
];

function isWorkScreen(id: EvaluatorWindowTab): id is ValuationWorkScreenId {
  return id !== "output";
}

const EvaluatorValuationReportOutputTab = dynamic(
  () =>
    import("./EvaluatorValuationReportOutputTab").then(
      (m) => m.EvaluatorValuationReportOutputTab,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    ),
  },
);

const preloadValuationReportOutputTab = () =>
  void import("./EvaluatorValuationReportOutputTab");

export function EvaluatorWindow({
  task,
  tasks,
  hostRef,
  propertySummary,
  initialTab = "basic",
  deedLabel,
  embeddedInPropertyChrome = false,
}: {
  task: WorkflowTask;
  tasks: WorkflowTask[];
  hostRef: EvaluatorWindowHostRefObject;
  propertySummary?: EvaluatorPropertySummary;
  initialTab?: EvaluatorWindowTab;
  deedLabel?: string;
  onBack?: () => void;
  embeddedInPropertyChrome?: boolean;
}) {
  const gate = useMemo(
    () => inspectionGateForAppraisal(task, tasks),
    [task, tasks],
  );
  const { showToast } = useToast();
  const { data: staffResult } = useStaffUsersQuery();
  const assignedAppraiserName = useMemo(() => {
    const session = getAuthSession();
    const selfFallback =
      session?.user?.id &&
      task.assigneeId?.trim() &&
      session.user.id === task.assigneeId.trim()
        ? session.user.displayName
        : undefined;
    return resolveAssigneeDisplayName({
      assigneeName: task.assigneeName,
      assigneeId: task.assigneeId,
      staffUsers: staffResult?.users ?? [],
      fallback: selfFallback,
    });
  }, [
    task.assigneeName,
    task.assigneeId,
    staffResult?.users,
  ]);

  const [draft, setDraft] = useState<EvaluatorSubmission>(() =>
    createEvaluatorDraft({
      taskId: task.id,
      propertyId: task.propertyId ?? "",
      poNumber: task.poNumber,
      assignmentType: task.assignmentType,
    }),
  );
  const [draftLoading, setDraftLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] =
    useState<EvaluatorValidationErrors>(EMPTY_FIELD_ERRORS);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<EvaluatorWindowTab>(initialTab);
  const [navAvail, setNavAvail] = useState<ValuationWorkNavAvailability>({
    market: false,
    cost: false,
  });
  const visitedTabsRef = useRef<Set<EvaluatorWindowTab>>(new Set());
  visitedTabsRef.current.add(activeTab);
  const lastWorkScreenRef = useRef<ValuationWorkScreenId>(
    isWorkScreen(initialTab) ? initialTab : "basic",
  );
  if (isWorkScreen(activeTab)) lastWorkScreenRef.current = activeTab;
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editVersionRef = useRef(0);

  const locked = isEvaluatorFormLocked(draft.status);
  const formDisabled = locked || !gate.ready;

  const { execute: executeAppraiserSubmit, loading: appraiserSubmitting } =
    useIdempotentAction(
      useCallback(
        async (idempotencyKey: string) =>
          finalizeAppraiserSubmission(task.id, idempotencyKey),
        [task.id],
      ),
    );

  const submitBusy = submitting || appraiserSubmitting;

  const visibleTabs = useMemo(
    () =>
      VAL_TAB_DEFS.filter((t) => {
        if (t.id === "market") return navAvail.market;
        if (t.id === "cost") return navAvail.cost;
        return true;
      }),
    [navAvail.cost, navAvail.market],
  );

  useEffect(() => {
    if (visibleTabs.some((t) => t.id === activeTab)) return;
    setActiveTab(visibleTabs[0]?.id ?? "basic");
  }, [activeTab, visibleTabs]);

  const persistDraft = useCallback(
    (
      patch: Partial<{
        evaluatorPrice: string;
        evaluatorNotes: string;
        appraisalDate: string;
        valuationMethod: string;
        valueBasis: string;
        demandLevel: string;
        landValue: string;
        buildingValue: string;
        forcedSaleDiscountPct: string;
        searchScopeNotes: string;
        planImageFileName: string | null;
        appraiserAddress: string;
        appraiserPhone: string;
        checklist: EvaluatorChecklistAnswers;
        assetDataConfirmed: boolean;
        assetDataVarianceNotes: string;
        independenceDeclared: boolean;
        reportWorkers: EvaluatorReportWorker[];
        depositCode: string;
        depositCertificateFileName: string | null;
        reportChoices: EvaluatorReportChoices;
      }>,
      reportMetadata?: EvaluatorReportMetadata,
      planImageMetadata?: EvaluatorPlanImageMetadata,
    ) => {
      if (locked) return;
      const versionAtSave = editVersionRef.current;
      void updateEvaluatorDraft(task.id, patch, reportMetadata, planImageMetadata)
        .then((updated) => {
          if (updated && editVersionRef.current === versionAtSave) {
            setDraft(updated);
          }
        })
        .catch((err: unknown) => {
          showToast(
            err instanceof Error
              ? err.message
              : "تعذّر حفظ مسودة التقييم — حاول مرة أخرى",
            "error",
          );
        });
    },
    [locked, task.id, showToast],
  );

  const scheduleAutosave = useCallback(
    (patch: Parameters<typeof persistDraft>[0]) => {
      editVersionRef.current += 1;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => persistDraft(patch), 400);
    },
    [persistDraft],
  );

  useEffect(() => {
    let cancelled = false;
    void hydrateEvaluatorSubmission({
      taskId: task.id,
      propertyId: task.propertyId ?? "",
      poNumber: task.poNumber,
      assignmentType: task.assignmentType,
    }).then((loaded) => {
      if (!cancelled) {
        const summed = computePropertyTotal(
          loaded.landValue,
          loaded.buildingValue,
        );
        const currentTotal = Number.parseFloat(
          (loaded.evaluatorPrice || "0").replace(/,/g, ""),
        );
        const reconciled =
          summed > 0 &&
          (!Number.isFinite(currentTotal) || currentTotal === 0)
            ? {
                ...loaded,
                evaluatorPrice: String(summed),
              }
            : loaded;
        setDraft(reconciled);
        if (reconciled !== loaded) {
          void updateEvaluatorDraft(task.id, {
            evaluatorPrice: reconciled.evaluatorPrice,
          }).catch(() => {
            /* best-effort; UI already shows the sum */
          });
        }
        setDraftLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [task.id, task.propertyId, task.poNumber]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const submit = useCallback(async (): Promise<boolean> => {
    if (locked) return false;
    if (!gate.ready) {
      setFormError(gate.reason);
      showToast(gate.reason, "error");
      return false;
    }

    const choices = draft.reportChoices;
    const methodOn = (key?: string) =>
      Boolean(key?.trim()) && key !== "__unused__";
    const approachesOn =
      methodOn(choices?.marketMethodKey) || methodOn(choices?.costMethodKey);
    const errors = validateEvaluatorSubmission({
      taskId: task.id,
      evaluatorPrice: draft.evaluatorPrice,
      landValue: draft.landValue,
      buildingValue: draft.buildingValue,
      forcedSaleDiscountPct: draft.forcedSaleDiscountPct,
      valueBasisKey: draft.reportChoices?.valueBasisKey,
      assetDataConfirmed: draft.assetDataConfirmed,
      assetDataVarianceNotes: draft.assetDataVarianceNotes,
      independenceDeclared: draft.independenceDeclared,
      reportWorkers: draft.reportWorkers,
      skipManualLandBuilding: approachesOn,
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      const message =
        firstEvaluatorError(errors) ?? "تحقق من الحقول المطلوبة";
      setFormError(message);
      showToast(message, "error");
      setActiveTab("review");
      scheduleScrollToFormField(firstEvaluatorErrorTarget(errors), 120);
      return false;
    }

    const session = getAuthSession();
    if (session?.token && task.propertyId) {
      try {
        const open = await getOpenValuationRequestByProperty(
          { token: session.token },
          task.propertyId,
        );
        if (open.ok && open.data?.id) {
          const gatesRes = await getValuationIssuanceGates(
            { token: session.token },
            open.data.id,
          );
          if (gatesRes.ok && !gatesRes.data.allowsIssuance) {
            const reason =
              gatesRes.data.blockingReasonsAr[0] ??
              "شروط الإصدار غير مستوفاة";
            const message = `الاعتماد ممنوع — ${reason}`;
            setFormError(message);
            showToast(message, "error");
            setActiveTab("review");
            return false;
          }
        }
      } catch {
        // Gate check failed (network) — the server will still reject an incomplete issue later.
      }
    }

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }

    setSubmitting(true);
    hostRef.current?.onSavingChange?.(true);
    setFormError(null);
    try {
      try {
        const updated = await updateEvaluatorDraft(task.id, {
          landValue: draft.landValue,
          buildingValue: draft.buildingValue,
          forcedSaleDiscountPct: draft.forcedSaleDiscountPct,
          evaluatorPrice: draft.evaluatorPrice,
          assetDataConfirmed: draft.assetDataConfirmed,
          assetDataVarianceNotes: draft.assetDataVarianceNotes,
          independenceDeclared: draft.independenceDeclared,
          reportWorkers: draft.reportWorkers,
          valuationMethod: draft.valuationMethod,
          valueBasis: draft.valueBasis,
          demandLevel: draft.demandLevel,
          depositCode: draft.depositCode,
          depositCertificateFileName: draft.depositCertificateFileName,
        });
        if (updated) setDraft(updated);
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : "تعذّر حفظ مسودة التقييم — حاول مرة أخرى";
        setFormError(message);
        showToast(message, "error");
        return false;
      }

      const outcome = await executeAppraiserSubmit();
      if (outcome.status === "skipped") return false;

      const result = outcome.value;
      if (result.ok) {
        setDraft(result.submission);
        showToast(
          "تم اعتماد التقييم وإرساله لأخصائي دراسة الحالة.",
          "success",
        );
        hostRef.current?.onSubmitted?.();
        return true;
      }
      setFormError(result.message);
      showToast(result.message, "error");
      return false;
    } finally {
      setSubmitting(false);
      hostRef.current?.onSavingChange?.(false);
    }
  }, [
    locked,
    gate,
    task.id,
    task.propertyId,
    draft.evaluatorPrice,
    draft.landValue,
    draft.buildingValue,
    draft.forcedSaleDiscountPct,
    draft.assetDataConfirmed,
    draft.assetDataVarianceNotes,
    draft.independenceDeclared,
    draft.reportWorkers,
    draft.valuationMethod,
    draft.valueBasis,
    draft.demandLevel,
    draft.depositCode,
    draft.depositCertificateFileName,
    draft.reportChoices,
    hostRef,
    showToast,
    executeAppraiserSubmit,
  ]);

  useEffect(() => {
    if (!hostRef.current) return;
    hostRef.current.submit = submit;
    hostRef.current.focusEvaluatorNotes = () => {
      const field = document.getElementById("evaluator_notes") as
        | HTMLTextAreaElement
        | null;
      if (!field) return;
      field.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => field.focus(), 120);
    };
  }, [hostRef, submit]);

  const onTabChange = useCallback((id: string) => {
    setActiveTab(id as EvaluatorWindowTab);
  }, []);

  const onDraftPatch = useCallback(
    (values: Parameters<typeof persistDraft>[0]) => {
      setDraft((prev) => ({ ...prev, ...values }));
      scheduleAutosave(values);
    },
    [scheduleAutosave],
  );

  const onReportChoicesChange = useCallback(
    (
      reportChoices: EvaluatorReportChoices,
      extras?: { valueBasis?: string; valuationMethod?: string },
    ) => {
      const patch = {
        reportChoices,
        ...(extras?.valueBasis ? { valueBasis: extras.valueBasis } : {}),
        ...(extras?.valuationMethod
          ? { valuationMethod: extras.valuationMethod }
          : {}),
      };
      setDraft((prev) => ({ ...prev, ...patch }));
      scheduleAutosave(patch);
    },
    [scheduleAutosave],
  );

  const syncFinalOpinion = useCallback(
    (value: number) => {
      if (!Number.isFinite(value) || value <= 0) return;
      onDraftPatch({ evaluatorPrice: String(Math.round(value)) });
    },
    [onDraftPatch],
  );

  const onReportChoicesPatch = useCallback(
    (patch: Partial<EvaluatorReportChoices>) => {
      const current = draft.reportChoices ?? emptyReportChoices();
      onReportChoicesChange({ ...current, ...patch });
    },
    [draft.reportChoices, onReportChoicesChange],
  );

  const onNavAvailabilityChange = useCallback(
    (nav: ValuationWorkNavAvailability) => {
      setNavAvail(nav);
    },
    [],
  );

  const onWorkScreenChange = useCallback((screen: ValuationWorkScreenId) => {
    setActiveTab(screen);
  }, []);

  if (draftLoading) {
    return (
      <div className="flex flex-col gap-3.5">
        <InlineLoadingSkeleton className="my-2" />
      </div>
    );
  }

  const inspected = appraiserInspectionDone(task, tasks);
  const needsSurvey = appraiserNeedsSurvey(task, tasks);
  const surveyed = appraiserSurveyDone(task, tasks);
  const summary: EvaluatorPropertySummary = {
    deedNumber: propertySummary?.deedNumber ?? "—",
    poNumber: propertySummary?.poNumber ?? task.poNumber,
    classification: propertySummary?.classification ?? "—",
    cityDistrict: propertySummary?.cityDistrict ?? "—",
    assignedAt:
      propertySummary?.assignedAt ??
      (task.createdAt
        ? new Date(task.createdAt).toLocaleDateString("en-CA").replace(/-/g, "/")
        : "—"),
    inspectionDone: inspected,
    property: propertySummary?.property ?? null,
    showDecree: propertySummary?.showDecree ?? false,
    surveyTaskId: propertySummary?.surveyTaskId ?? null,
    inspectionTaskId: propertySummary?.inspectionTaskId ?? null,
    appraisalTaskId: propertySummary?.appraisalTaskId ?? task.id,
  };

  const property = summary.property;
  const workVisited = WORK_SCREENS.some((id) =>
    visitedTabsRef.current.has(id),
  );
  const workScreen = isWorkScreen(activeTab)
    ? activeTab
    : lastWorkScreenRef.current;

  return (
    <div className="flex min-w-0 flex-col overflow-x-hidden">
      {embeddedInPropertyChrome ? null : (
        <div className={opsPpHeadCard}>
          <h1 className="m-0 flex flex-wrap items-center gap-2.5 text-[18px] font-extrabold text-heading">
            <span>نافذة المقيم العقاري</span>
            <span className="text-[14px] font-bold text-gold-d" dir="ltr">
              صك {deedLabel ?? summary.deedNumber}
            </span>
          </h1>
        </div>
      )}

      <div
        className={cn(
          opsWorkspaceCard,
          "overflow-hidden pt-0",
          embeddedInPropertyChrome &&
            "overflow-x-hidden border-0 bg-transparent p-0 shadow-none",
        )}
      >
        <div
          onMouseEnter={preloadValuationReportOutputTab}
          onFocus={preloadValuationReportOutputTab}
        >
          <ValTabBar
            tabs={visibleTabs}
            active={activeTab}
            onChange={onTabChange}
          />
        </div>

        <div className="pt-5">
          {needsSurvey && !surveyed && !locked && gate.ready ? (
            <EngInfo variant="amber">
              ℹ يمكنك التقييم الآن (بيانات معاينة العقار معتمدة) — الرفع المساحي
              وصف إضافي: قد يلزم تعديل التقييم بعد صدوره.
            </EngInfo>
          ) : null}

          {locked ? (
            <EngInfo variant="amber">
              تم الإرسال لأخصائي دراسة الحالة — لا يمكن التعديل إلا بإعادة فتح من
              الأخصائي.
            </EngInfo>
          ) : null}

          {formError ? (
            <EngInfo variant="red">
              <strong>!</strong> {formError}
            </EngInfo>
          ) : null}

          <div className={cn(formDisabled ? "opacity-75" : undefined)}>
            {workVisited || isWorkScreen(activeTab) ? (
              <Activity
                mode={activeTab !== "output" ? "visible" : "hidden"}
              >
                <div className="mb-5">
                  <EvaluatorValuationReportTab
                    draft={draft}
                    disabled={formDisabled}
                    property={summary.property}
                    inspectionTaskId={summary.inspectionTaskId}
                    surveyTaskId={summary.surveyTaskId}
                    appraisalTaskId={task.id}
                    assignmentType={task.assignmentType}
                    fieldErrors={fieldErrors}
                    onChange={onReportChoicesChange}
                    onDraftPatch={onDraftPatch}
                    showPropertyMedia={workScreen === "basic"}
                  />
                </div>
                {property?.id ? (
                  <ValuationWorkShell
                    propertyId={property.id}
                    poNumber={draft.poNumber}
                    assignmentType={task.assignmentType ?? undefined}
                    districtHint={property.district}
                    property={{
                      area: property.area,
                      district: property.district,
                      city: property.city,
                      deedNumber: property.deedNumber,
                      propertyType: property.propertyType,
                      classification: property.classification,
                    }}
                    intakeProperty={property}
                    onFinalOpinionChange={syncFinalOpinion}
                    draft={draft}
                    disabled={formDisabled}
                    fieldErrors={fieldErrors}
                    onDraftPatch={onDraftPatch}
                    onReportChoicesPatch={onReportChoicesPatch}
                    onSubmit={() => void submit()}
                    submitting={submitBusy}
                    showSubmit={!formDisabled}
                    screen={workScreen}
                    onScreenChange={onWorkScreenChange}
                    embeddedInTopTabs
                    onNavAvailabilityChange={onNavAvailabilityChange}
                  />
                ) : (
                  <p className="text-[13px] text-text-3">
                    لا يتوفر عقار مرتبط لهذه المهمة.
                  </p>
                )}
              </Activity>
            ) : null}

            {visitedTabsRef.current.has("output") ? (
              <Activity mode={activeTab === "output" ? "visible" : "hidden"}>
                <EvaluatorValuationReportOutputTab
                  draft={draft}
                  property={summary.property}
                  inspectionTaskId={summary.inspectionTaskId}
                  surveyTaskId={summary.surveyTaskId}
                  assignedAppraiserName={assignedAppraiserName}
                />
              </Activity>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
