"use client";

/**
 * Everything the case study form loads and derives: draft hydration for both
 * the specialist and party variants, the info-roles visibility/edit matrix, the
 * party contributions and the memoised projections the screen renders from.
 * Writes live in `useCaseStudyFormCommands`; this hook owns the state they
 * mutate.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWindowEvents } from "@platform/app-shared/hooks/useWindowEvents";
import { useToast } from "@platform/ui-kit";
import { caseStudyAnswerKey, type CaseStudyQuestionSection } from "../../lib/app-data/case-study-form-data";
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
  useCaseStudyInfoRolesQuery,
  useStaffUsersQuery,
} from "@settings/mfe/query/settings-queries";
import {
  emptyCaseStudyFormDraft,
  PARTY_CASE_STUDY_FORM_CHANGED_EVENT,
  type CaseStudyFormDraft,
} from "../../lib/app-data/case-study-form-model";
import {
  loadCaseStudyFormDraft,
  loadCaseStudyFormDraftOrThrow,
  loadPartyCaseStudyFormDraft,
  loadPartyCaseStudyFormDraftOrThrow,
} from "../../lib/app-data/case-study-form-reads";
import { buildCaseStudyReportModel } from "../../lib/app-data/case-study-report-model";
import type { PoIntakeRecord, PoPropertyIntake } from "../../lib/app-data/po-intake-data";
import type { WorkflowTask } from "../../lib/app-data/tasks-storage";
import { useWorkflowTasksQuery } from "../../query/case-study-queries";
import { useCaseStudyQuestionCatalogQuery } from "../../query/case-study-question-catalog-queries";
import { DEFAULT_CASE_STUDY_QUESTION_CATALOG } from "@platform/app-shared/domain/case-study/question-catalog";
import { EVALUATOR_SUBMISSION_CHANGED_EVENT } from "../../lib/case-study-evaluator-events";
import {
  buildSeed,
  caseStudyAnswerSummary,
  FORM_STEP_SECTIONS,
  hydrateCaseStudyFormDraft,
} from "./case-study-form-state";

/** Stable fallback — avoid calling emptyCaseStudyInfoRolesConfig() per render (infinite effect loop). */
const DEFAULT_INFO_ROLES_CONFIG = emptyCaseStudyInfoRolesConfig();

export type CaseStudyFormDataArgs = {
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

export function useCaseStudyFormData({
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
}: CaseStudyFormDataArgs) {
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

  const { data: infoRolesData, isFetched: infoRolesReady } =
    useCaseStudyInfoRolesQuery();
  const { data: questionCatalog = DEFAULT_CASE_STUDY_QUESTION_CATALOG } =
    useCaseStudyQuestionCatalogQuery();
  const sectionQuestions = questionCatalog.sectionQuestions;
  const infoRoles = infoRolesData ?? DEFAULT_INFO_ROLES_CONFIG;
  const infoRolesMatrix = infoRoles.matrix;

  const [draft, setDraft] = useState<CaseStudyFormDraft>(() =>
    emptyCaseStudyFormDraft(storageTaskId, seed),
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
  const { data: workflowTasks } = useWorkflowTasksQuery();
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users;
  const [partyAnswersByKey, setPartyAnswersByKey] = useState<
    Record<string, PartyQuestionContribution[]>
  >({});

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
          [PARTY_CASE_STUDY_FORM_CHANGED_EVENT]: refreshPartyRevision,
          [EVALUATOR_SUBMISSION_CHANGED_EVENT]: refreshPartyRevision,
        },
  );

  const canEditKey = useCallback(
    (key: string) => {
      if (forceReadOnly) return false;
      if (!isParty && draft.status === "submitted") return false;
      if (isParty && (draft.status === "submitted" || parentFormSubmitted)) {
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
          loadCaseStudyFormDraftOrThrow(referenceTaskId),
          isParty
            ? loadPartyCaseStudyFormDraftOrThrow(storageTaskId)
            : loadCaseStudyFormDraftOrThrow(storageTaskId),
        ]);
        if (cancelled) return;
        const hydratedDraft = hydrateCaseStudyFormDraft({
          stored,
          parentDraft,
          seed,
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
            : "تعذّر تحميل نموذج دراسة الحالة",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per task
  }, [storageTaskId, referenceTaskId, isParty, reloadKey]);

  useEffect(() => {
    if (!isParty || !hydrated) return;
    void loadCaseStudyFormDraft(referenceTaskId).then((parent) => {
      const locked = parent?.status === "submitted";
      setParentFormSubmitted(locked);
      if (!locked) return;
      setDraft((current) =>
        current.status === "submitted" ? current : { ...current, status: "submitted" },
      );
    }).catch(() => {
      showToast("تعذّر تحميل نموذج دراسة الحالة الرئيسي", "error");
    });
  }, [isParty, hydrated, referenceTaskId, partyRevision]);

  useEffect(() => {
    if (!isParty || !partyChildTaskId) return;

    const onExternalUpdate = (event: Event) => {
      const taskId = (event as CustomEvent<{ taskId?: string }>).detail?.taskId;
      if (taskId !== partyChildTaskId) return;

      void loadPartyCaseStudyFormDraft(partyChildTaskId).then((stored) => {
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
      PARTY_CASE_STUDY_FORM_CHANGED_EVENT,
      onExternalUpdate,
    );
    return () => {
      window.removeEventListener(
        PARTY_CASE_STUDY_FORM_CHANGED_EVENT,
        onExternalUpdate,
      );
    };
  }, [isParty, partyChildTaskId]);

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

export type CaseStudyFormData = ReturnType<typeof useCaseStudyFormData>;
