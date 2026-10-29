// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Split The assigned-appraiser name lookup moved unchanged into useAssignedAppraiserName.
//  • P19  A refresh keeps the tab: the window opens on initialEvaluatorTab (remembered per task) and
//         useEvaluatorTabMemory restores an approach tab once the settings load; lastWorkScreen starts from
//         the restored tab.
//  • P19  useUnsavedEditsGuard warns before a refresh / close loses an unblurred field, a pending autosave or
//         an unsaved section.
// ──────────────────────────────────────────────────────────────────────────────────────────────

"use client";

import {
  Button,
  InlineLoadingSkeleton,
  cn,
  opsWorkspaceCard,
  useSwapAnimation,
  useToast,
} from "@platform/ui-kit";
import { parseLocaleNumber } from "@platform/app-shared/format/number";
import { Activity, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { WorkflowTask } from "@platform/app-shared/workflow/task-types";
import { STUDY_REPORT_NOT_ISSUED_MESSAGE } from "../../lib/evaluator/evaluator-inspection-gate";
import { createEvaluatorDraft, emptyReportChoices } from "../../lib/evaluator/evaluator-window-data";
import type { EvaluatorSubmission } from "../../lib/evaluator/evaluator-window-data";
import {
  isEvaluatorFormLocked,
  type EvaluatorPlanImageMetadata,
  type EvaluatorReportMetadata,
} from "../../lib/evaluator/evaluator-submission-model";
import {
  hydrateEvaluatorSubmission,
  mergeEvaluatorDraftPatches,
  updateEvaluatorDraft,
} from "../../lib/evaluator/evaluator-submission-commands";
import {
  type EvaluatorRetrospectiveDraft,
  type EvaluatorSpecialistDraft,
  type EvaluatorValidationErrors,
} from "../../lib/evaluator/evaluator-validation";
import { useEvaluatorSubmit } from "./useEvaluatorSubmit";
import { useAssignedAppraiserName } from "./useAssignedAppraiserName";
import { useEvaluatorTabMemory } from "./useEvaluatorTabMemory";
import { useUnsavedEditsGuard } from "./useUnsavedEditsGuard";
import { initialEvaluatorTab } from "../../lib/evaluator/evaluator-tab-memory";
import type { EvaluatorWindowHostRefObject } from "../../lib/evaluator/evaluator-window-host";
import { getCachedPartySubmission } from "@platform/app-shared/app-data/party-submission-api";
import type {
  EvaluatorChecklistAnswers,
  EvaluatorReportChoices,
  EvaluatorReportWorker,
} from "../../lib/evaluator/evaluator-window-data";
import { type EvaluatorPropertySummary } from "./EvaluatorPropertyTab";
import { EvaluatorBasicDocumentsCard } from "./EvaluatorBasicDocumentsCard";
import { EvaluatorValuationReportTab } from "./EvaluatorValuationReportTab";
import {
  appraiserInspectionDone,
  appraiserNeedsSurvey,
  appraiserSurveyDone,
} from "../../lib/evaluator/evaluator-readiness";
import { computePropertyTotal } from "../../lib/evaluator/value-estimation";
import { ValTabBar } from "./EvaluatorHtmlPrimitives";
import {
  ValuationWorkShell,
  type ValuationWorkNavAvailability,
  type ValuationWorkScreenId,
} from "./EvaluatorComparableSelectionPanel";
import {
  type EvaluatorWindowTab,
  WORK_SCREENS,
  isWorkScreen,
  visibleEvaluatorTabs,
} from "./evaluator-window-tabs";
import { EvaluatorWindowBanners, EvaluatorWindowSubmitBar, EvaluatorWindowTitle } from "./EvaluatorWindowBanners";
import { InspectorChangedBanner } from "./InspectorChangedBanner";
import {
  EvaluatorValuationReportOutputTabLazy as EvaluatorValuationReportOutputTab,
  prefetchValuationReportOutputTab,
  preloadValuationReportOutputTab,
} from "./EvaluatorWindowOutputTab";
import {
  refreshEvaluatorReportOutputOnOpen,
  scheduleInvalidateEvaluatorReportOutput,
} from "../../lib/evaluator/evaluator-report-output-cache";
import { WORK_ORDER_PROPERTY_CHANGED_EVENT } from "@platform/app-shared/app-data/work-orders-api-config";
import { linkedPropertyDeeds, transactionDeedLabelOf } from "@platform/api-client";
import { useTransactionByPropertyQuery } from "../../query/transaction-query";
import { EvaluatorLinkedDeedsCard } from "./EvaluatorLinkedDeedsCard";
import { FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT } from "./useInspectorChangedBanner";

export type { EvaluatorWindowTab } from "./evaluator-window-tabs";

const EMPTY_FIELD_ERRORS: EvaluatorValidationErrors = {};

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
  const { showToast } = useToast();
  const assignedAppraiserName = useAssignedAppraiserName(task);

  const [draft, setDraft] = useState<EvaluatorSubmission>(() =>
    createEvaluatorDraft({
      taskId: task.id,
      propertyId: task.propertyId ?? "",
      poNumber: task.poNumber,
      assignmentType: task.assignmentType,
    }),
  );
  const [draftLoading, setDraftLoading] = useState(true);
  const [draftLoadError, setDraftLoadError] = useState<string | null>(null);
  const [draftLoadAttempt, setDraftLoadAttempt] = useState(0);
  // The party submission carries the flag too — fresher than the queue's task row.
  const [studyReportIssuedFromServer, setStudyReportIssuedFromServer] = useState<
    boolean | null
  >(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] =
    useState<EvaluatorValidationErrors>(EMPTY_FIELD_ERRORS);
  // A refresh keeps the tab (problem 19) — remembered per task for this browser tab.
  const [activeTab, setActiveTab] = useState<EvaluatorWindowTab>(() => initialEvaluatorTab(task.id, initialTab));
  const queryClient = useQueryClient();
  const [navAvail, setNavAvail] = useState<ValuationWorkNavAvailability>({
    market: false,
    cost: false,
  });
  // Tabs opened so far and the last work screen — recorded during render (state, not refs).
  const [visitedTabs, setVisitedTabs] = useState(() => new Set<EvaluatorWindowTab>([activeTab]));
  if (!visitedTabs.has(activeTab)) setVisitedTabs(new Set(visitedTabs).add(activeTab));
  const [lastWorkScreen, setLastWorkScreen] = useState<ValuationWorkScreenId>(
    isWorkScreen(activeTab) ? activeTab : "basic",
  );
  if (isWorkScreen(activeTab) && lastWorkScreen !== activeTab) setLastWorkScreen(activeTab);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editVersionRef = useRef(0);
  const retrospectiveRef = useRef<EvaluatorRetrospectiveDraft | null>(null);
  const specialistRef = useRef<EvaluatorSpecialistDraft | null>(null);
  const onRetrospectiveDraftChange = useCallback(
    (draft: EvaluatorRetrospectiveDraft) => {
      retrospectiveRef.current = draft;
    },
    [],
  );
  const onSpecialistDraftChange = useCallback(
    (draft: EvaluatorSpecialistDraft) => {
      specialistRef.current = draft;
    },
    [],
  );

  const locked = isEvaluatorFormLocked(draft.status);
  // No start gate: the appraiser drafts from the start; only the submit waits.
  const formDisabled = locked;
  // Only the SUBMIT waits for the specialist's study report; the form stays editable.
  const studyReportPending =
    task.studyReportIssued !== true && studyReportIssuedFromServer !== true;

  useEvaluatorTabMemory({ taskId: task.id, activeTab, setActiveTab, navAvail });

  const visibleTabs = useMemo(
    () => visibleEvaluatorTabs(navAvail),
    [navAvail],
  );

  // A tab can disappear when an approach is turned off — fall back during render
  // so the window never paints an empty screen for one frame.
  if (visibleTabs.length && !visibleTabs.some((t) => t.id === activeTab)) {
    setActiveTab(visibleTabs[0]?.id ?? "basic");
  }

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
          if (err instanceof Error) console.warn("[evaluator] autosave failed:", err);
          showToast("تعذّر حفظ مسودة التقييم — حاول مرة أخرى", "error");
        });
    },
    [locked, task.id, showToast],
  );

  const pendingAutosaveRef = useRef<Parameters<typeof persistDraft>[0] | null>(
    null,
  );

  const scheduleAutosave = useCallback(
    (patch: Parameters<typeof persistDraft>[0]) => {
      editVersionRef.current += 1;
      // Fold, don't replace: notes typed then a report choice within the debounce
      // would otherwise send only the choice, and its response would wipe the notes.
      pendingAutosaveRef.current = mergeEvaluatorDraftPatches(
        pendingAutosaveRef.current,
        patch,
      );
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null;
        const pending = pendingAutosaveRef.current;
        pendingAutosaveRef.current = null;
        if (pending) persistDraft(pending);
      }, 400);
    },
    [persistDraft],
  );

  /** Sends a debounced patch now — queued ahead of whatever write comes next. */
  const flushPendingAutosave = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const pending = pendingAutosaveRef.current;
    pendingAutosaveRef.current = null;
    if (pending) persistDraft(pending);
  }, [persistDraft]);

  useEffect(() => {
    let cancelled = false;
    void hydrateEvaluatorSubmission({
      taskId: task.id,
      propertyId: task.propertyId ?? "",
      poNumber: task.poNumber,
      assignmentType: task.assignmentType,
    }).then((loaded) => {
      if (!cancelled) {
        const cachedFlag = getCachedPartySubmission(task.id)?.studyReportIssued;
        setStudyReportIssuedFromServer(
          typeof cachedFlag === "boolean" ? cachedFlag : null,
        );
        const summed = computePropertyTotal(
          loaded.landValue,
          loaded.buildingValue,
        );
        const currentTotal = parseLocaleNumber(loaded.evaluatorPrice || "0");
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
    })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Without this the skeleton never clears; the form stays locked to edits
        // it could not save (no cached draft), so say so instead of failing silently.
        setDraftLoading(false);
        setDraftLoadError(
          err instanceof Error && err.message
            ? err.message
            : "تعذّر تحميل مسودة التقييم — تحقق من الاتصال وحاول مجدداً.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [task.id, task.propertyId, task.poNumber, task.assignmentType, draftLoadAttempt]);

  useEffect(() => flushPendingAutosave, [flushPendingAutosave]);

  // Fetch the report code while the appraiser works on the other tabs, so opening
  // «تقرير التقييم» waits only for its data — the hover preload fired too late to help.
  useEffect(() => {
    const id = window.setTimeout(preloadValuationReportOutputTab, 1500);
    return () => window.clearTimeout(id);
  }, []);

  const { submit, submitBusy, studyReportBlocked } = useEvaluatorSubmit({
    task,
    hostRef,
    locked,
    draft,
    setDraft,
    flushPendingAutosave,
    retrospectiveRef,
    specialistRef,
    setFormError,
    setFieldErrors,
    setActiveTab,
    showToast,
  });

  // The transaction above this deed — its live deeds feed the window title
  // and the linked-deeds card, since a linked property is valued as one.
  const { data: transaction } = useTransactionByPropertyQuery(
    propertySummary?.property?.id ?? task.propertyId,
  );

  /** What the report tab reads — the same inputs it is rendered with below. */
  const reportOutputInput = useMemo(
    () => ({
      property: propertySummary?.property ?? null,
      poNumber: draft.poNumber,
      inspectionTaskId: propertySummary?.inspectionTaskId ?? null,
      surveyTaskId: propertySummary?.surveyTaskId ?? null,
    }),
    [
      propertySummary?.property,
      propertySummary?.inspectionTaskId,
      propertySummary?.surveyTaskId,
      draft.poNumber,
    ],
  );

  const onTabChange = useCallback((id: string) => {
    const next = id as EvaluatorWindowTab;
    setActiveTab(next);
    // Pull a fresh report bundle when opening «تقرير التقييم» (same idea as ESG:
    // never leave the appraiser staring at a cached fill after they just saved) —
    // unless the hover prefetch just fetched it.
    if (next === "output") {
      refreshEvaluatorReportOutputOnOpen(queryClient, {
        propertyId: reportOutputInput.property?.id,
        poNumber: reportOutputInput.poNumber,
        inspectionTaskId: reportOutputInput.inspectionTaskId,
        surveyTaskId: reportOutputInput.surveyTaskId,
      });
    }
  }, [queryClient, reportOutputInput]);

  const onTabIntent = useCallback(
    (id: string) => {
      if (id === "output") {
        prefetchValuationReportOutputTab(queryClient, reportOutputInput);
      }
    },
    [queryClient, reportOutputInput],
  );

  const panelRef = useRef<HTMLDivElement>(null);
  useSwapAnimation(panelRef, activeTab);
  // Warn before a refresh loses typed text: an unblurred field, a pending autosave, an unsaved section.
  useUnsavedEditsGuard(panelRef, () => pendingAutosaveRef.current !== null);

  // Property / inspection edits outside this window should refresh the report fill.
  useEffect(() => {
    const refresh = () =>
      scheduleInvalidateEvaluatorReportOutput(queryClient);
    window.addEventListener(WORK_ORDER_PROPERTY_CHANGED_EVENT, refresh);
    window.addEventListener(FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(WORK_ORDER_PROPERTY_CHANGED_EVENT, refresh);
      window.removeEventListener(
        FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
        refresh,
      );
    };
  }, [queryClient]);

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
    (
      value: number,
      extras?: {
        liquidationDiscountPct: number;
        liquidationDiscountApplied: boolean;
      },
    ) => {
      if (!Number.isFinite(value) || value <= 0) return;
      onDraftPatch({
        evaluatorPrice: String(Math.round(value)),
        ...(extras?.liquidationDiscountApplied
          ? {
              forcedSaleDiscountPct: String(extras.liquidationDiscountPct ?? 0),
            }
          : {}),
      });
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

  if (draftLoadError) {
    return (
      <div className="flex flex-col items-start gap-2.5 py-4" role="alert">
        <p className="text-[13px] text-danger-text">{draftLoadError}</p>
        <Button
          size="sm"
          onClick={() => {
            setDraftLoadError(null);
            setDraftLoading(true);
            setDraftLoadAttempt((n) => n + 1);
          }}
        >
          إعادة المحاولة
        </Button>
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
  // Phase 5: a linked property is valued as one — the title and the basic screen name every deed.
  const linkedDeeds = linkedPropertyDeeds(transaction);
  const titleDeedLabel =
    linkedDeeds.length > 1
      ? linkedDeeds.map(transactionDeedLabelOf).join(" ، ")
      : deedLabel;
  const workVisited = WORK_SCREENS.some((id) => visitedTabs.has(id));
  const workScreen = isWorkScreen(activeTab) ? activeTab : lastWorkScreen;

  return (
    <div className="flex min-w-0 flex-col overflow-x-hidden">
      <EvaluatorWindowTitle
        embedded={embeddedInPropertyChrome}
        deedLabel={titleDeedLabel}
        deedNumber={summary.deedNumber}
      />

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
            onTabIntent={onTabIntent}
          />
        </div>

        <div className="pt-5">
          <EvaluatorWindowBanners
            needsSurvey={needsSurvey}
            surveyed={surveyed}
            locked={locked}
            studyReportPending={studyReportPending || studyReportBlocked}
            finalIssued={task.status === "completed"}
            formError={formError}
          />
          <InspectorChangedBanner
            taskId={task.id}
            draft={draft}
            locked={locked}
            setDraft={setDraft}
            onError={(message) => showToast(message, "error")}
          />

          {/* The swap fade lives on its own wrapper: animating the locked form's
              element would end by snapping from full opacity back to 75%. */}
          <div ref={panelRef}>
            <div className={cn(formDisabled ? "opacity-75" : undefined)}>
              {workVisited || isWorkScreen(activeTab) ? (
                <Activity
                  mode={activeTab !== "output" ? "visible" : "hidden"}
                >
                  <div className="flex flex-col">
                    {workScreen === "basic" && property ? (
                      <div className="order-1">
                        <EvaluatorLinkedDeedsCard
                          deeds={linkedDeeds}
                          linkKindLabel={transaction?.linkKindLabelAr}
                          transactionNumber={transaction?.displayNumber}
                        />
                        <EvaluatorBasicDocumentsCard
                          property={property}
                          poNumber={draft.poNumber}
                          surveyTaskId={summary.surveyTaskId ?? null}
                          inspectionTaskId={summary.inspectionTaskId ?? null}
                          appraisalTaskId={task.id}
                        />
                      </div>
                    ) : null}
                    <div
                      className={cn(
                        "mb-5",
                        // «البيانات الأساسية»: documents + type, then approaches, then maps + property info.
                        workScreen === "basic" ? "order-3 mt-3.5" : "order-1",
                      )}
                    >
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
                    <div className="order-2">
                      {property?.id ? (
                        <ValuationWorkShell
                          propertyId={property.id}
                          inspectionTaskId={propertySummary?.inspectionTaskId ?? null}
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
                          showSubmit={false}
                          screen={workScreen}
                          onScreenChange={onWorkScreenChange}
                          embeddedInTopTabs
                          onNavAvailabilityChange={onNavAvailabilityChange}
                          onRetrospectiveDraftChange={onRetrospectiveDraftChange}
                          onSpecialistDraftChange={onSpecialistDraftChange}
                        />
                      ) : (
                        <p className="text-[13px] text-text-3">
                          لا يتوفر عقار مرتبط لهذه المهمة.
                        </p>
                      )}
                    </div>
                  </div>
                </Activity>
              ) : null}

              {visitedTabs.has("output") ? (
                <Activity mode={activeTab === "output" ? "visible" : "hidden"}>
                  <EvaluatorValuationReportOutputTab
                    draft={draft}
                    property={summary.property}
                    inspectionTaskId={summary.inspectionTaskId}
                    surveyTaskId={summary.surveyTaskId}
                    assignedAppraiserName={assignedAppraiserName}
                    assignedAppraiserId={task.assigneeId}
                    onReportChoicesPatch={onReportChoicesPatch}
                    onNavigateTab={onTabChange}
                  />
                </Activity>
              ) : null}

              <EvaluatorWindowSubmitBar
                visible={!formDisabled && activeTab === "review"}
                submitBusy={submitBusy}
                submitBlockedReason={
                  studyReportPending ? STUDY_REPORT_NOT_ISSUED_MESSAGE : null
                }
                onSubmit={() => void submit()}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
