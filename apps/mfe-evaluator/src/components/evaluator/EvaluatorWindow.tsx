// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Split The assigned-appraiser name lookup moved unchanged into useAssignedAppraiserName.
//  • P19  A refresh keeps the tab: the window opens on initialEvaluatorTab (remembered per task) and
//         useEvaluatorTabMemory restores an approach tab once the settings load; lastWorkScreen starts from
//         the restored tab.
//  • P19  useUnsavedEditsGuard warns before a refresh / close loses an unblurred field, a pending autosave or
//         an unsaved section.
// Grey areas (2026-11-10)
//  • syncFinalOpinion always writes the current discount («0» when none) and skips a write that
//         changes nothing (finalOpinionDraftPatch).
//  • The legacy land + building sum is no longer written as the price on load when the property has a
//         valuation request — the reconciliation's final value is the price (legacyLandBuildingPrice).
// ──────────────────────────────────────────────────────────────────────────────────────────────

"use client";

import {
  AppModal,
  Button,
  WorkSectionsSkeleton,
  cn,
  useToast,
} from "@platform/ui-kit";
import { useLatestRef } from "@platform/app-shared/hooks/use-latest-ref";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import {
  ValuationWorkShell,
  type ValuationWorkNavAvailability,
  type ValuationWorkScreenId,
} from "./valuation-work/ValuationWorkShell";
import {
  type EvaluatorWindowTab,
  isWorkScreen,
  visibleEvaluatorTabs,
} from "./evaluator-window-tabs";
import { EvaluatorSectionsFrame, type EvaluatorSectionFocus } from "./EvaluatorSectionsFrame";
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
import {
  getOpenValuationRequestByProperty,
  linkedPropertyDeeds,
  transactionDeedLabelOf,
} from "@platform/api-client";
import { apiConfig } from "@platform/app-shared/auth/api-config";
import {
  finalOpinionDraftPatch,
  legacyLandBuildingPrice,
} from "../../lib/evaluator/evaluator-final-opinion-sync";
import { useTransactionByPropertyQuery } from "../../query/transaction-query";
import { transactionLandArea } from "../../lib/evaluator/transaction-land-area";
import { EvaluatorLinkedDeedsCard } from "./EvaluatorLinkedDeedsCard";

export type { EvaluatorWindowTab } from "./evaluator-window-tabs";
import {
  FIELD_INSPECTION_SUBMISSION_CHANGED_EVENT,
  WORK_ORDER_PROPERTY_CHANGED_EVENT,
} from "@platform/app-shared/events/app-events";

const EMPTY_FIELD_ERRORS: EvaluatorValidationErrors = {};

export function EvaluatorWindow({
  task,
  tasks,
  hostRef,
  propertySummary,
  initialTab = "basic",
  deedLabel,
  embeddedInPropertyChrome = false,
  studySummary,
  pageActions,
  railAside,
}: {
  task: WorkflowTask;
  tasks: WorkflowTask[];
  hostRef: EvaluatorWindowHostRefObject;
  propertySummary?: EvaluatorPropertySummary;
  initialTab?: EvaluatorWindowTab;
  deedLabel?: string;
  onBack?: () => void;
  embeddedInPropertyChrome?: boolean;
  /** The study's share of the summary section — built by the case-study app, shown under the property's cards. */
  studySummary?: ReactNode;
  /** The hosting app's page buttons, shown beside «تقرير التقييم». */
  pageActions?: ReactNode;
  /** The hosting app's cards under the sections rail (the parties' status). */
  railAside?: ReactNode;
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
  // A refresh keeps the screen (problem 19) — remembered per task for this browser tab. Since the
  // sections layout (2026-11-10) it is the valuation screen the appraiser last opened or was sent to;
  // the report is a window, so a remembered «output» falls back to the first screen.
  const [activeTab, setActiveTab] = useState<EvaluatorWindowTab>(() => {
    const initial = initialEvaluatorTab(task.id, initialTab);
    return initial === "output" ? "basic" : initial;
  });
  // The screen to open and scroll to — every «go to» request. Nothing on load (Omar 2026-11-11:
  // the page opens with every section folded, for every role); it used to open the remembered
  // screen, which a refresh or a second visit in the same browser tab brought back unfolded.
  const [focus, setFocus] = useState<EvaluatorSectionFocus | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const queryClient = useQueryClient();
  const [navAvail, setNavAvail] = useState<ValuationWorkNavAvailability>({
    market: false,
    cost: false,
  });
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

  /**
   * Sends the appraiser to a screen: a valuation screen's section opens and scrolls into view (and
   * the report window closes); «output» opens the report window.
   * How it works: only state setters, so the tab memory may call it while rendering; a new focus
   * object asks again even for the screen already remembered (its section may be collapsed).
   */
  const goToTab = useCallback((tab: EvaluatorWindowTab) => {
    if (!isWorkScreen(tab)) {
      setReportOpen(true);
      return;
    }
    setActiveTab(tab);
    setFocus({ screen: tab });
    setReportOpen(false);
  }, []);

  // A remembered approach screen is restored as the remembered one only — its section is not
  // opened (the page stays folded at entry), so the plain setter, not `goToTab`.
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
        setDraft(loaded);
        setDraftLoading(false);
        // Legacy packages priced by hand (land + building, no price yet): the sum stands in for
        // the price ONLY when the property has no valuation request — with one, the
        // reconciliation's final value is the price (syncFinalOpinion). The lookup runs only when
        // there is a sum to write.
        if (legacyLandBuildingPrice(loaded, false) != null) {
          void fillLegacyPrice(loaded);
        }
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
    /**
     * Writes the legacy land + building sum as the price after confirming the property has no
     * open valuation request. A failed lookup counts as «has one» (nothing is written).
     */
    async function fillLegacyPrice(loaded: Parameters<typeof legacyLandBuildingPrice>[0]) {
      const config = apiConfig();
      const propertyId = (task.propertyId ?? "").trim();
      const open = config && propertyId
        ? await getOpenValuationRequestByProperty(config, propertyId)
        : null;
      const hasRequest = open?.ok ? open.data != null : null;
      const price = legacyLandBuildingPrice(loaded, hasRequest);
      if (cancelled || price == null) return;
      setDraft((prev) => ({ ...prev, evaluatorPrice: price }));
      void updateEvaluatorDraft(task.id, { evaluatorPrice: price }).catch(() => {
        /* best-effort; UI already shows the sum */
      });
    }
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
    setActiveTab: goToTab,
    showToast,
  });

  // The transaction above this deed — its live deeds feed the window title
  // and the linked-deeds card, since a linked property is valued as one.
  // While it loads, the valuation screens wait: their first load seeds the land area from it
  // (a merged transaction's land is the sum of its deeds — A→Z #38).
  const { data: transaction, isLoading: transactionLoading } = useTransactionByPropertyQuery(
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

  /**
   * Opens «تقرير التقييم» in its window with a fresh report bundle (same idea as ESG: never leave
   * the appraiser staring at a cached fill after he just saved) — unless the hover prefetch just
   * fetched it.
   */
  const openReport = useCallback(() => {
    refreshEvaluatorReportOutputOnOpen(queryClient, {
      propertyId: reportOutputInput.property?.id,
      poNumber: reportOutputInput.poNumber,
      inspectionTaskId: reportOutputInput.inspectionTaskId,
      surveyTaskId: reportOutputInput.surveyTaskId,
    });
    setReportOpen(true);
  }, [queryClient, reportOutputInput]);

  // «أعمالي»'s «اعتماد مسودة التقرير» row opens this page with `?report=1`: open the report window,
  // then drop the flag from the address so a reload does not open it again.
  // How it works: the opening runs in an animation frame (not inside the effect body), and the flag
  // is dropped only when it ran — a frame cancelled by a re-render (or React's dev double run) leaves
  // the flag for the next run. Edge cases: no flag → nothing is scheduled.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("report") !== "1") return;
    const frame = window.requestAnimationFrame(() => {
      const url = new URL(window.location.href);
      url.searchParams.delete("report");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
      openReport();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [openReport]);

  /** Hover / focus on the report button: fetch its code and data before the click. */
  const onReportIntent = useCallback(() => {
    preloadValuationReportOutputTab();
    prefetchValuationReportOutputTab(queryClient, reportOutputInput);
  }, [queryClient, reportOutputInput]);

  /** From the report window's «انتقل إلى …» on a missing field: back to that screen's section. */
  const onReportNavigate = useCallback(
    (id: string) => goToTab(id as EvaluatorWindowTab),
    [goToTab],
  );

  const panelRef = useRef<HTMLDivElement>(null);
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

  /**
   * The reconciliation's final value and discount into the package (price + «خصم التصفية»).
   * Always writes the current discount — «0» when it does not apply — so a basis switch never
   * leaves a stale %; a load that changes nothing writes nothing (finalOpinionDraftPatch).
   */
  const draftRef = useLatestRef(draft);
  const syncFinalOpinion = useCallback(
    (
      value: number,
      extras?: {
        liquidationDiscountPct: number;
        liquidationDiscountApplied: boolean;
      },
    ) => {
      const patch = finalOpinionDraftPatch(value, extras, draftRef.current);
      if (patch) onDraftPatch(patch);
    },
    [draftRef, onDraftPatch],
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

  const onWorkScreenChange = useCallback(
    (screen: ValuationWorkScreenId) => goToTab(screen),
    [goToTab],
  );
  /** A section the appraiser opened by hand — remembered for the next refresh, nothing scrolls. */
  const onSectionPick = useCallback((screen: ValuationWorkScreenId) => setActiveTab(screen), []);

  // While the package (and then the transaction) loads, the sections frame's own placeholder holds
  // the page's shape — the rail and the panels — so nothing jumps when the sections arrive.
  if (draftLoading) {
    return <WorkSectionsSkeleton label="جاري تحميل صفحة التقييم" />;
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
  const workScreen: ValuationWorkScreenId = isWorkScreen(activeTab) ? activeTab : "basic";

  // The summary section: what «البيانات الأساسية» showed of the property (deeds, documents and type,
  // main photo, description, map, the work order's scope) and then the study's share from the
  // case-study app. EvaluatorValuationReportTab also keeps the draft's purpose / basis / premise
  // equal to the work order's, which is why this section stays mounted.
  const summarySection = (
    <>
      {property ? (
        <>
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
        </>
      ) : null}
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
        showPropertyMedia
      />
      {studySummary}
    </>
  );

  return (
    // No scroll container here: the sections rail is sticky against the page's own scroller.
    <div className="flex min-w-0 flex-col">
      <EvaluatorWindowTitle
        embedded={embeddedInPropertyChrome}
        deedLabel={titleDeedLabel}
        deedNumber={summary.deedNumber}
      />

      <div ref={panelRef} className="min-w-0">
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

        {/* The report is a result, read in a window (Omar 2026-11-10) — as on the work page. */}
        <div
          className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface px-4 py-2.5"
          data-testid="evaluator-report-line"
        >
          <span className="flex-1 text-[12.5px] text-text-2">
            {locked
              ? "تقرير التقييم — للمعاينة والطباعة واعتماد المسودة حين يُصدرها المراجع."
              : "تقرير التقييم يُملأ من الأقسام أدناه — افتحه للمعاينة والطباعة."}
          </span>
          {pageActions}
          <Button
            type="button"
            size="sm"
            variant={locked ? "primary" : "outline"}
            onClick={openReport}
            onMouseEnter={onReportIntent}
            onFocus={onReportIntent}
          >
            تقرير التقييم
          </Button>
        </div>

        {property?.id && transactionLoading ? (
          <WorkSectionsSkeleton label="جاري تحميل صفحة التقييم" />
        ) : property?.id ? (
          <ValuationWorkShell
            propertyId={property.id}
            inspectionTaskId={propertySummary?.inspectionTaskId ?? null}
            studyReportPending={studyReportPending}
            poNumber={draft.poNumber}
            assignmentType={task.assignmentType ?? undefined}
            districtHint={property.district}
            property={{
              // A merged transaction is valued as one: its land is every deed's area.
              area: transactionLandArea(property.area, linkedDeeds) ?? undefined,
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
            renderSections={(parts) => (
              <div className={cn(formDisabled ? "opacity-75" : undefined)}>
                <EvaluatorSectionsFrame
                  parts={parts}
                  navAvail={navAvail}
                  locked={locked}
                  focus={focus}
                  onPick={onSectionPick}
                  summary={summarySection}
                  railAside={railAside}
                  footer={
                    <EvaluatorWindowSubmitBar
                      visible={!formDisabled}
                      submitBusy={submitBusy}
                      submitBlockedReason={
                        studyReportPending ? STUDY_REPORT_NOT_ISSUED_MESSAGE : null
                      }
                      onSubmit={() => void submit()}
                    />
                  }
                />
              </div>
            )}
          />
        ) : (
          <p className="text-[13px] text-text-3">
            لا يتوفر عقار مرتبط لهذه المهمة.
          </p>
        )}
      </div>

      <AppModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="تقرير التقييم"
        maxWidthPx={1180}
      >
        {reportOpen ? (
          <EvaluatorValuationReportOutputTab
            draft={draft}
            property={summary.property}
            inspectionTaskId={summary.inspectionTaskId}
            surveyTaskId={summary.surveyTaskId}
            assignedAppraiserName={assignedAppraiserName}
            assignedAppraiserId={task.assigneeId}
            onReportChoicesPatch={onReportChoicesPatch}
            onNavigateTab={onReportNavigate}
          />
        ) : null}
      </AppModal>
    </div>
  );
}
