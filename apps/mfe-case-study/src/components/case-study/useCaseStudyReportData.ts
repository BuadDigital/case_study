"use client";

/**
 * Everything the case study form loads and derives: draft hydration for both
 * the specialist and party variants, the info-roles visibility/edit matrix, the
 * party contributions and the memoised projections the screen renders from.
 * Writes live in `useCaseStudyReportCommands`; this hook owns the state they
 * mutate.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWindowEvents } from "@platform/app-shared/hooks/useWindowEvents";
import { useToast } from "@platform/ui-kit";
import { caseStudyAnswerKey, type CaseStudyQuestionSection } from "../../lib/app-data/case-study-report-data";
import {
  canPartyAnswerQuestion,
  canSpecialistApproveQuestion,
  CASE_STUDY_INFO_ROLES_CHANGED_EVENT,
  emptyCaseStudyInfoRolesConfig,
  isCaseStudyQuestionVisibleToSpecialist,
  isPartyQuestionVisible,
} from "@settings/mfe/lib/app-data/case-study-info-roles-model";
import type { CaseStudyInfoPartyId } from "@settings/mfe/lib/app-data/case-study-info-roles-data";
import {
  collectPartyAnswersByQuestion,
  type PartyQuestionContribution,
} from "../../lib/app-data/case-study-party-answers";
import {
  applyInspectorAnswersToSpecialist,
  type SpecialistAnswersMap,
} from "../../lib/app-data/apply-inspector-answers-to-specialist";
import {
  useCaseStudyInfoRolesQuery,
  useStaffUsersQuery,
} from "@settings/mfe/query/settings-queries";
import {
  emptyCaseStudyReportDraft,
  PARTY_CASE_STUDY_REPORT_CHANGED_EVENT,
  type CaseStudyReportDraft,
} from "../../lib/app-data/case-study-report-model";
import {
  loadCaseStudyReportDraft,
  loadCaseStudyReportDraftOrThrow,
  loadPartyCaseStudyReportDraft,
  loadPartyCaseStudyReportDraftOrThrow,
} from "../../lib/app-data/case-study-report-reads";
import { saveCaseStudyReportDraft } from "../../lib/app-data/case-study-report-commands";
import { buildCaseStudyReportModel } from "../../lib/app-data/case-study-report-document-model";
import type { PoIntakeRecord, PoPropertyIntake } from "../../lib/app-data/po-intake-data";
import type { WorkflowTask } from "../../lib/app-data/tasks";
import { useWorkflowTasksQuery } from "../../query/case-study-queries";
import { useCaseStudyQuestionCatalogQuery } from "../../query/case-study-question-catalog-queries";
import { DEFAULT_CASE_STUDY_QUESTION_CATALOG } from "@platform/app-shared/domain/case-study/question-catalog";
import { EVALUATOR_SUBMISSION_CHANGED_EVENT } from "../../lib/case-study-evaluator-events";
import {
  buildSeed,
  caseStudyAnswerSummary,
  FORM_STEP_SECTIONS,
  hydrateCaseStudyReportDraft,
} from "./case-study-report-state";

/** Stable fallback — avoid calling emptyCaseStudyInfoRolesConfig() per render (infinite effect loop). */
const DEFAULT_INFO_ROLES_CONFIG = emptyCaseStudyInfoRolesConfig();

export type CaseStudyReportDataArgs = {
  taskId: string;
  task: WorkflowTask;
  property: PoPropertyIntake | null;
  poRecord?: Pick<
    PoIntakeRecord,
    "assignmentSpecialist" | "receivedFromEnfathAt" | "promulgationDate"
  > | null;
  requestDateSeed?: string;
  variant: "specialist" | "party";
  partyId?: CaseStudyInfoPartyId;
  partyChildTaskId?: string;
  parentFormTaskId?: string;
  partyAdvisory: boolean;
  forceReadOnly: boolean;
};

export function useCaseStudyReportData({
  taskId,
  task,
  property,
  poRecord,
  requestDateSeed,
  variant,
  partyId,
  partyChildTaskId,
  parentFormTaskId,
  partyAdvisory,
  forceReadOnly,
}: CaseStudyReportDataArgs) {
  const isParty = variant === "party" && partyId && partyChildTaskId;
  const viewerPartyId: CaseStudyInfoPartyId = isParty ? partyId! : "specA";
  const storageTaskId = isParty ? partyChildTaskId : taskId;
  const referenceTaskId = isParty
    ? (parentFormTaskId ?? task.id)
    : taskId;

  const seed = useMemo(
    () => buildSeed(task, property, requestDateSeed),
    [task, property, requestDateSeed],
  );
  const seedRef = useRef(seed);
  seedRef.current = seed;
  const seedKey = [
    seed.requestNumber ?? "",
    seed.requestDate ?? "",
    seed.deedNumber ?? "",
    seed.propertyId ?? "",
    seed.poNumber ?? "",
  ].join("\0");

  const { data: infoRolesData, isFetched: infoRolesReady } =
    useCaseStudyInfoRolesQuery();
  const { data: questionCatalog = DEFAULT_CASE_STUDY_QUESTION_CATALOG } =
    useCaseStudyQuestionCatalogQuery();
  const sectionQuestions = questionCatalog.sectionQuestions;
  const infoRoles = infoRolesData ?? DEFAULT_INFO_ROLES_CONFIG;
  const infoRolesMatrix = infoRoles.matrix;

  const [draft, setDraft] = useState<CaseStudyReportDraft>(() =>
    emptyCaseStudyReportDraft(storageTaskId, seed),
  );
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [parentFormSubmitted, setParentFormSubmitted] = useState(false);
  const { showToast, showProgressToast, dismissToast } = useToast();
  const [partyRevision, setPartyRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [missingAnswerKeys, setMissingAnswerKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [formFieldErrors, setFormFieldErrors] = useState<{
    deedRemarks?: boolean;
    deedNature?: boolean;
    deedNatureNotes?: boolean;
  }>({});
  const { data: workflowTasks } = useWorkflowTasksQuery();
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users;
  const [partyAnswersByKey, setPartyAnswersByKey] = useState<
    Record<string, PartyQuestionContribution[]>
  >({});
  /** Last mirrored inspector values — used to follow updates without clobbering overrides. */
  const previousInspectorRef = useRef<SpecialistAnswersMap>({});
  const mirroringRef = useRef(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    if (isParty || !hydrated || !infoRolesReady) return;

    let cancelled = false;
    void collectPartyAnswersByQuestion(
      taskId,
      infoRolesMatrix,
      workflowTasks ?? [],
      staffUsers ?? [],
    ).then((result) => {
      if (!cancelled) setPartyAnswersByKey(result);
    });
    return () => {
      cancelled = true;
    };
  }, [
    isParty,
    taskId,
    infoRolesMatrix,
    partyRevision,
    hydrated,
    infoRolesReady,
    workflowTasks,
    staffUsers,
  ]);

  // Specialist form stays responsive to inspector chips: empty cells (and cells
  // still mirroring the last inspector value) follow the field party.
  useEffect(() => {
    if (isParty || !hydrated || forceReadOnly) return;
    if (Object.keys(partyAnswersByKey).length === 0) return;
    if (mirroringRef.current) return;

    const current = draftRef.current;
    if (current.status === "issued") return;

    const applied = applyInspectorAnswersToSpecialist(
      current.answers,
      partyAnswersByKey,
      previousInspectorRef.current,
    );
    previousInspectorRef.current = applied.inspectorSnapshot;
    if (applied.changedKeys.length === 0) return;

    const approved = { ...current.specialistReviewApproved };
    for (const key of applied.changedKeys) {
      approved[key] = true;
    }
    const next: CaseStudyReportDraft = {
      ...current,
      answers: applied.answers,
      specialistReviewApproved: approved,
    };

    let cancelled = false;
    mirroringRef.current = true;
    setDraft(next);
    void saveCaseStudyReportDraft(next)
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) showToast(result.error, "error");
      })
      .catch(() => {
        if (cancelled) return;
        showToast("تعذّر مزامنة إجابات المعاين — حاول مرة أخرى", "error");
      })
      .finally(() => {
        mirroringRef.current = false;
      });

    return () => {
      cancelled = true;
    };
  }, [
    isParty,
    hydrated,
    forceReadOnly,
    partyAnswersByKey,
    setDraft,
    showToast,
  ]);

  const isQuestionVisible = useCallback(
    (key: string) => {
      if (!isParty) {
        return isCaseStudyQuestionVisibleToSpecialist(infoRolesMatrix, key);
      }
      return isPartyQuestionVisible(infoRolesMatrix, key, viewerPartyId);
    },
    [isParty, viewerPartyId, infoRolesMatrix],
  );

  const partyContribCount = useMemo(() => {
    if (isParty) return 0;
    return Object.values(partyAnswersByKey).reduce(
      (total, items) => total + items.length,
      0,
    );
  }, [isParty, partyAnswersByKey]);

  // Form parties do not subscribe to other parties' changes — listeners are specialist-only.
  const refreshPartyRevision = () => setPartyRevision((n) => n + 1);
  useWindowEvents(
    isParty
      ? {}
      : {
          focus: refreshPartyRevision,
          [CASE_STUDY_INFO_ROLES_CHANGED_EVENT]: refreshPartyRevision,
          [PARTY_CASE_STUDY_REPORT_CHANGED_EVENT]: refreshPartyRevision,
          [EVALUATOR_SUBMISSION_CHANGED_EVENT]: refreshPartyRevision,
        },
  );

  const canEditKey = useCallback(
    (key: string) => {
      if (forceReadOnly) return false;
      if (!isParty && draft.status === "issued") return false;
      if (isParty && (draft.status === "issued" || parentFormSubmitted)) {
        return false;
      }
      if (!isParty) {
        return canSpecialistApproveQuestion(infoRolesMatrix, key);
      }
      return canPartyAnswerQuestion(infoRolesMatrix, key, viewerPartyId);
    },
    [
      forceReadOnly,
      isParty,
      viewerPartyId,
      infoRolesMatrix,
      draft.status,
      parentFormSubmitted,
    ],
  );

  const hasPartyVisibleNonDeedSections = useMemo(() => {
    if (!isParty) return false;
    return FORM_STEP_SECTIONS.filter((section) => section !== "deed").some(
      (section) =>
        sectionQuestions[section].some((_, i) =>
          isQuestionVisible(caseStudyAnswerKey(section, i)),
        ),
    );
  }, [isParty, isQuestionVisible, sectionQuestions]);

  const sectionHasVisibleQuestions = useCallback(
    (section: CaseStudyQuestionSection) =>
      !(isParty && hasPartyVisibleNonDeedSections && section === "deed") &&
      sectionQuestions[section].some((_, i) =>
        isQuestionVisible(caseStudyAnswerKey(section, i)),
      ),
    [isParty, hasPartyVisibleNonDeedSections, isQuestionVisible, sectionQuestions],
  );

  const visibleStepIndices = useMemo(() => {
    return FORM_STEP_SECTIONS.map((section, i) =>
      sectionHasVisibleQuestions(section) ? i : -1,
    ).filter((i) => i >= 0);
  }, [sectionHasVisibleQuestions]);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    (async () => {
      try {
        const [parentDraft, stored] = await Promise.all([
          loadCaseStudyReportDraftOrThrow(referenceTaskId),
          isParty
            ? loadPartyCaseStudyReportDraftOrThrow(storageTaskId)
            : loadCaseStudyReportDraftOrThrow(storageTaskId),
        ]);
        if (cancelled) return;
        const hydratedDraft = hydrateCaseStudyReportDraft({
          stored,
          parentDraft,
          seed: seedRef.current,
          storageTaskId,
          isParty: Boolean(isParty),
        });
        setParentFormSubmitted(hydratedDraft.parentSubmitted);
        setDraft(hydratedDraft.draft);
        setHydrated(true);
      } catch (error) {
        if (cancelled) return;
        setLoadError(
          error instanceof Error
            ? error.message
            : "تعذّر تحميل تقرير دراسة الحالة",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storageTaskId, referenceTaskId, isParty, reloadKey, seedKey]);

  useEffect(() => {
    if (!isParty || !hydrated) return;
    let cancelled = false;
    void loadCaseStudyReportDraft(referenceTaskId).then((parent) => {
      if (cancelled) return;
      const locked = parent?.status === "issued";
      setParentFormSubmitted(locked);
      if (!locked) return;
      setDraft((current) =>
        current.status === "issued" ? current : { ...current, status: "issued" },
      );
    }).catch(() => {
      if (cancelled) return;
      showToast("تعذّر تحميل تقرير دراسة الحالة الرئيسي", "error");
    });
    return () => {
      cancelled = true;
    };
  }, [isParty, hydrated, referenceTaskId, partyRevision, showToast]);

  useEffect(() => {
    if (!isParty || !partyChildTaskId) return;

    const onExternalUpdate = (event: Event) => {
      const taskId = (event as CustomEvent<{ taskId?: string }>).detail?.taskId;
      if (taskId !== partyChildTaskId) return;

      void loadPartyCaseStudyReportDraft(partyChildTaskId).then((stored) => {
        if (!stored) return;
        setDraft((current) => ({
          ...current,
          answers: { ...current.answers, ...stored.answers },
        }));
      }).catch(() => {
        showToast("تعذّر تحميل إجابات الطرف — حاول مرة أخرى", "error");
      });
    };

    window.addEventListener(
      PARTY_CASE_STUDY_REPORT_CHANGED_EVENT,
      onExternalUpdate,
    );
    return () => {
      window.removeEventListener(
        PARTY_CASE_STUDY_REPORT_CHANGED_EVENT,
        onExternalUpdate,
      );
    };
  }, [isParty, partyChildTaskId, showToast]);

  const summary = useMemo(
    () =>
      caseStudyAnswerSummary(draft.answers, sectionQuestions, isQuestionVisible),
    [draft.answers, isQuestionVisible, sectionQuestions],
  );

  const reportModel = useMemo(
    () => buildCaseStudyReportModel(draft, property, task, poRecord, questionCatalog),
    [draft, property, task, poRecord, questionCatalog],
  );

  return {
    // Identity and catalogs.
    isParty,
    viewerPartyId,
    partyChildTaskId,
    infoRolesReady,
    sectionQuestions,
    // Draft state.
    draft,
    setDraft,
    hydrated,
    setHydrated,
    loadError,
    setLoadError,
    setReloadKey,
    parentFormSubmitted,
    saving,
    setSaving,
    missingAnswerKeys,
    setMissingAnswerKeys,
    formFieldErrors,
    setFormFieldErrors,
    property,
    // Party contributions.
    partyAnswersByKey,
    partyContribCount,
    setPartyRevision,
    // Visibility and edit matrix.
    isQuestionVisible,
    canEditKey,
    sectionHasVisibleQuestions,
    visibleStepIndices,
    // Derived projections.
    summary,
    reportModel,
    // Toasts.
    showToast,
    showProgressToast,
    dismissToast,
  };
}

export type CaseStudyReportData = ReturnType<typeof useCaseStudyReportData>;
