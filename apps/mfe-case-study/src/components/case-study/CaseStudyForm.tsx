"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  FormGroup,
  InlineLoadingSkeleton,
  Input,
  Label,
  Note,
  Textarea,
  cn,
  progressMessageForActionLabel,
  useToast,
} from "@platform/design-system";
import { RegistrationFormCard } from "@platform/app-shared/registration/RegistrationFormCard";
import { RegField } from "@platform/app-shared/registration/FormFields";
import { CASE_STUDY_FORM_STEPS, caseStudyAnswerKey,type CaseStudyFormAnswer,type CaseStudyQuestionSection} from "../../lib/prototype/case-study-form-data";
import { CaseStudyApprovalSection } from "./CaseStudyApprovalSection";
import { CaseStudyReportActions } from "./CaseStudyReportActions";
import { CaseStudyProgressDonut } from "./CaseStudyProgressDonut";
import { CaseStudyMatrixTable } from "./CaseStudyMatrixTable";
import { CaseStudyInfathSpecialistSection } from "./CaseStudyInfathSpecialistSection";
import { canPartyAnswerQuestion, canSpecialistApproveQuestion, CASE_STUDY_INFO_ROLES_CHANGED_EVENT,
  emptyCaseStudyInfoRolesConfig,
  isCaseStudyQuestionVisibleToSpecialist,
  isPartyQuestionVisible,
  partyById,
  type CaseStudyInfoPartyId,
} from "@settings/mfe";
import {
  collectPartyAnswersByQuestion,
  type PartyQuestionContribution,
} from "../../lib/prototype/case-study-party-answers";
import { useCaseStudyInfoRolesQuery } from "@settings/mfe/query/settings-queries";
import {
  emptyCaseStudyFormDraft,
  loadCaseStudyFormDraft,
  loadCaseStudyFormDraftOrThrow,
  loadPartyCaseStudyFormDraft,
  loadPartyCaseStudyFormDraftOrThrow,
  PARTY_CASE_STUDY_FORM_CHANGED_EVENT,
  saveCaseStudyFormDraft,
  savePartyCaseStudyFormDraft,
  type CaseStudyFormDraft,
  type CaseStudyMeterType,
} from "../../lib/prototype/case-study-form-storage";
import { buildCaseStudyReportModel } from "../../lib/prototype/case-study-report-model";
import type { PoIntakeRecord, PoPropertyIntake } from "../../lib/prototype/po-intake-data";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";
import { useWorkflowTasksQuery } from "../../query/case-study-queries";
import { useCaseStudyQuestionCatalogQuery } from "../../query/case-study-question-catalog-queries";
import { DEFAULT_CASE_STUDY_QUESTION_CATALOG } from "../../lib/prototype/case-study-question-catalog";
import { EVALUATOR_SUBMISSION_CHANGED_EVENT } from "../../lib/case-study-evaluator-events";

/** Stable fallback — avoid calling emptyCaseStudyInfoRolesConfig() per render (infinite effect loop). */
const DEFAULT_INFO_ROLES_CONFIG = emptyCaseStudyInfoRolesConfig();
const STEP_AR_NUMS = ["١", "٢", "٣", "٤", "٥"] as const;
const FORM_STEP_SECTIONS: CaseStudyQuestionSection[] = [
  "deed",
  "survey",
  "comp",
  "occ",
  "extra",
];

/** Clamp step index; only shift when value is from legacy six-tab drafts (تعميد + 5 sections). */
function normalizeFormStep(storedStep: number): number {
  const max = FORM_STEP_SECTIONS.length - 1;
  let step = storedStep;
  if (step > max) {
    step = step - 1;
  }
  return Math.max(0, Math.min(max, step));
}

type Props = {
  taskId: string;
  task: WorkflowTask;
  property: PoPropertyIntake | null;
  poRecord?: Pick<
    PoIntakeRecord,
    "assignmentSpecialist" | "receivedFromEnfathAt" | "promulgationDate"
  > | null;
  requestDateSeed?: string;
  /** أخصائي — نموذج كامل؛ طرف — الأسئلة المسندة في المصفوفة فقط */
  variant?: "specialist" | "party";
  partyId?: CaseStudyInfoPartyId;
  partyChildTaskId?: string;
  parentFormTaskId?: string;
  /** مقيم — إجابات استدلالية للأخصائي وليست نهائية في نموذج الدراسة */
  partyAdvisory?: boolean;
};

function RemarksBlock({
  label,
  value,
  onChange,
  rows = 3,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  disabled?: boolean;
}) {
  return (
    <FormGroup className="mb-4 border-t border-border pt-3">
      <Label className="mb-1.5 text-xs font-medium text-amber-text">{label}</Label>
      <Textarea
        rows={rows}
        placeholder="الملاحظات..."
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </FormGroup>
  );
}

function FormProgressRings({
  summary,
}: {
  summary: { total: number; answered: number; pending: number; pct: number };
}) {
  return (
    <div
      className="flex shrink-0 items-center justify-center gap-2.5"
      aria-label="تقدم النموذج"
    >
      <CaseStudyProgressDonut
        pct={summary.pct}
        color="var(--success, #16a34a)"
        label="اكتمال النموذج"
        sub={`${summary.answered} / ${summary.total}`}
      />
    </div>
  );
}

function CaseStudyMatrixBanner({
  viewerPartyId,
  isParty,
  partyAdvisory,
  partyContribCount,
  onRefreshParty,
}: {
  viewerPartyId: CaseStudyInfoPartyId;
  isParty: boolean;
  partyAdvisory?: boolean;
  partyContribCount: number;
  onRefreshParty: () => void;
}) {
  const party = partyById(viewerPartyId);
  return (
    <Note
      tone="info"
      className={cn(
        "flex flex-wrap items-center justify-between gap-2.5",
        partyAdvisory &&
          "rounded-[10px] border border-blue-200 bg-gradient-to-br from-blue-50 to-slate-50 text-info",
      )}
    >
      {isParty ? (
        <p className="m-0 min-w-[min(100%,240px)] flex-1">
          {partyAdvisory ? (
            <>
              الأسئلة أدناه <strong>استدلالية للأخصائي</strong> — تظهر فقط
              المسندة لـ<strong>{party.name}</strong> في «علاقة المستخدم
              بالمعلومة» ولا تُعتبر إجابة نهائية في نموذج الدراسة.
            </>
          ) : (
            <>
              تظهر هنا فقط الأسئلة المسندة لـ<strong>{party.name}</strong> في
              «علاقة المستخدم بالمعلومة». الأسئلة التي دورك فيها «لا دور» لا
              تُعرض.
            </>
          )}
        </p>
      ) : (
        <>
          <p className="m-0 min-w-[min(100%,240px)] flex-1">
            <strong>مسؤولية الأخصائي:</strong> تظهر الأسئلة المسندة لك في
            المصفوفة فقط. راجع إجابات الأطراف على الأسئلة الظاهرة، ثم حدّد
            إجابتك الرسمية واعتمدها حيث وُجدت مساهمات.
          </p>
          {partyContribCount > 0 ? (
            <Button size="sm" className="me-auto" onClick={onRefreshParty}>
              تحديث إجابات الأطراف ({partyContribCount})
            </Button>
          ) : (
            <span className="text-[11px] text-text-3">
              لا توجد إجابات من الأطراف بعد على الأسئلة الظاهرة.
            </span>
          )}
        </>
      )}
    </Note>
  );
}

function SpecialistClosingCards({
  reportModel,
}: {
  reportModel: ReturnType<typeof buildCaseStudyReportModel>;
}) {
  return (
    <>
      <RegistrationFormCard title="الاعتماد والتوقيع">
        <CaseStudyApprovalSection approval={reportModel.approval} />
      </RegistrationFormCard>
      <RegistrationFormCard title="التقرير النهائي">
        <p className="mb-3 text-xs leading-relaxed text-text-2">
          يُعبّأ التقرير تلقائياً من إجابات النموذج وبيانات النظام (الصك، أمر
          العمل، التاريخ، المعتمد).
        </p>
        <CaseStudyReportActions model={reportModel} />
      </RegistrationFormCard>
    </>
  );
}

function buildSeed(
  task: WorkflowTask,
  property: PoPropertyIntake | null,
  requestDateSeed?: string,
): Partial<CaseStudyFormDraft> {
  const deed = property?.deedNumber?.trim() ?? "";
  return {
    requestNumber: task.poNumber.trim(),
    requestDate: requestDateSeed?.slice(0, 10) || undefined,
    deedNumber: deed,
    propertyId: property?.id,
    poNumber: task.poNumber.trim(),
  };
}

export function CaseStudyForm({
  taskId,
  task,
  property,
  poRecord,
  requestDateSeed,
  variant = "specialist",
  partyId,
  partyChildTaskId,
  parentFormTaskId,
  partyAdvisory = false,
}: Props) {
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
  const { data: workflowTasks } = useWorkflowTasksQuery();
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

  useEffect(() => {
    if (isParty) return;
    const refresh = () => setPartyRevision((n) => n + 1);
    window.addEventListener("focus", refresh);
    window.addEventListener(CASE_STUDY_INFO_ROLES_CHANGED_EVENT, refresh);
    window.addEventListener(PARTY_CASE_STUDY_FORM_CHANGED_EVENT, refresh);
    window.addEventListener(EVALUATOR_SUBMISSION_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener(CASE_STUDY_INFO_ROLES_CHANGED_EVENT, refresh);
      window.removeEventListener(
        PARTY_CASE_STUDY_FORM_CHANGED_EVENT,
        refresh,
      );
      window.removeEventListener(EVALUATOR_SUBMISSION_CHANGED_EVENT, refresh);
    };
  }, [isParty]);

  const canEditKey = useCallback(
    (key: string) => {
      if (!isParty && draft.status === "submitted") return false;
      if (isParty && (draft.status === "submitted" || parentFormSubmitted)) {
        return false;
      }
      if (!isParty) {
        return canSpecialistApproveQuestion(infoRolesMatrix, key);
      }
      return canPartyAnswerQuestion(infoRolesMatrix, key, viewerPartyId);
    },
    [isParty, viewerPartyId, infoRolesMatrix, draft.status, parentFormSubmitted],
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
      const parentDraft = await loadCaseStudyFormDraftOrThrow(referenceTaskId);
      const partyStored = isParty
        ? await loadPartyCaseStudyFormDraftOrThrow(storageTaskId)
        : null;
      const stored = isParty
        ? partyStored
        : await loadCaseStudyFormDraftOrThrow(storageTaskId);
      const base =
        stored ?? emptyCaseStudyFormDraft(storageTaskId, seed);
      const mergedAnswers = isParty
        ? { ...parentDraft?.answers, ...base.answers }
        : base.answers;
      const parentSubmitted = parentDraft?.status === "submitted";
      if (cancelled) return;
      setParentFormSubmitted(parentSubmitted);
      setDraft({
        ...base,
        ...seed,
        answers: mergedAnswers,
        status: parentSubmitted && isParty ? "submitted" : base.status,
        specialistReviewApproved: {
          ...base.specialistReviewApproved,
          ...stored?.specialistReviewApproved,
        },
        requestNumber: seed.requestNumber ?? base.requestNumber,
        deedNumber: seed.deedNumber ?? base.deedNumber,
        requestDate: seed.requestDate ?? base.requestDate,
        currentStep: stored ? normalizeFormStep(stored.currentStep) : 0,
      });
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

  const persistToServer = useCallback(
    async (next: CaseStudyFormDraft) => {
      if (isParty) return savePartyCaseStudyFormDraft(next);
      return saveCaseStudyFormDraft(next);
    },
    [isParty],
  );

  const persist = useCallback(
    (next: CaseStudyFormDraft) => {
      setDraft(next);
      if (!isParty && next.status === "submitted" && draft.status === "submitted") {
        return;
      }
      if (
        isParty &&
        (parentFormSubmitted ||
          draft.status === "submitted" ||
          next.status === "submitted")
      ) {
        return;
      }
      void persistToServer(next).then((result) => {
        if (result && !result.ok) showToast(result.error, "error");
      }).catch(() => {
        showToast("تعذّر حفظ نموذج دراسة الحالة — حاول مرة أخرى", "error");
      });
    },
    [persistToServer, isParty, draft.status, parentFormSubmitted, showToast],
  );

  const setAnswer = useCallback(
    (key: string, value: CaseStudyFormAnswer | null) => {
      if (!canEditKey(key)) return;

      const displayAnswers = { ...draft.answers, [key]: value };
      const marksPartyReview = !isParty && (value === "A" || value === "B");
      const next: CaseStudyFormDraft = {
        ...draft,
        answers: displayAnswers,
        ...(marksPartyReview
          ? {
              specialistReviewApproved: {
                ...draft.specialistReviewApproved,
                [key]: true,
              },
            }
          : {}),
      };
      setDraft(next);

      if (isParty && partyChildTaskId) {
        void loadPartyCaseStudyFormDraft(partyChildTaskId)
          .then((prevParty) => {
            const partyAnswers = {
              ...(prevParty?.answers ?? {}),
              [key]: value,
            };
            return savePartyCaseStudyFormDraft({
              ...next,
              taskId: partyChildTaskId,
              answers: partyAnswers,
            });
          })
          .then((result) => {
            if (result && !result.ok) showToast(result.error, "error");
          })
          .catch((err: unknown) => {
            showToast(
              err instanceof Error
                ? err.message
                : "تعذّر حفظ إجابات الطرف — حاول مرة أخرى",
              "error",
            );
          });
      } else {
        void saveCaseStudyFormDraft(next).then((result) => {
          if (!result.ok) showToast(result.error, "error");
        }).catch(() => {
          showToast("تعذّر حفظ نموذج دراسة الحالة — حاول مرة أخرى", "error");
        });
      }
    },
    [canEditKey, draft, isParty, partyChildTaskId, showToast],
  );

  const summary = useMemo(() => {
    let total = 0;
    let answered = 0;
    for (const section of FORM_STEP_SECTIONS) {
      sectionQuestions[section].forEach((_, i) => {
        const key = caseStudyAnswerKey(section, i);
        if (!isQuestionVisible(key)) return;
        total += 1;
        const v = draft.answers[key];
        if (v === "A" || v === "B") answered += 1;
      });
    }
    const pending = total - answered;
    const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
    return { total, answered, pending, pct };
  }, [draft.answers, isQuestionVisible, sectionQuestions]);

  const reportModel = useMemo(
    () => buildCaseStudyReportModel(draft, property, task, poRecord, questionCatalog),
    [draft, property, task, poRecord, questionCatalog],
  );

  const goStep = (n: number) => {
    const step = Math.max(0, Math.min(CASE_STUDY_FORM_STEPS.length - 1, n));
    persist({ ...draft, currentStep: step });
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goAdjacentStep = (direction: -1 | 1) => {
    const pool =
      visibleStepIndices.length > 0
        ? visibleStepIndices
        : FORM_STEP_SECTIONS.map((_, i) => i);
    const pos = pool.indexOf(draft.currentStep);
    const nextPos = pos + direction;
    if (nextPos >= 0 && nextPos < pool.length) {
      goStep(pool[nextPos]);
    }
  };

  useEffect(() => {
    if (!hydrated || visibleStepIndices.length === 0) return;
    if (!visibleStepIndices.includes(draft.currentStep)) {
      goStep(visibleStepIndices[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snap step once when visible set changes
  }, [hydrated, visibleStepIndices, draft.currentStep]);

  const patch = <K extends keyof CaseStudyFormDraft>(
    key: K,
    value: CaseStudyFormDraft[K],
  ) => {
    if (isParty || draft.status === "submitted") return;
    setDraft((d) => {
      const next = { ...d, [key]: value };
      persist(next);
      return next;
    });
  };

  const withSaveFeedback = async (
    actionLabel: string,
    successMessage: string,
    buildNext: () => CaseStudyFormDraft,
  ): Promise<boolean> => {
    if (saving) return false;

    const progressId = showProgressToast(
      progressMessageForActionLabel(actionLabel),
    );
    setSaving(true);
    try {
      const result = await persistToServer(buildNext());
      if (!result.ok) {
        showToast(result.error, "error");
        return false;
      }
      setDraft(result.draft);
      showToast(successMessage, "success");
      return true;
    } finally {
      dismissToast(progressId);
      setSaving(false);
    }
  };

  const saveDraft = () => {
    if (!isParty && draft.status === "submitted") return;
    void withSaveFeedback(
      "حفظ مسودة",
      "تم حفظ المسودة — يمكنك مواصلة التعبئة لاحقاً",
      () => ({ ...draft, status: "draft" }),
    );
  };

  const submitForm = () => {
    if (!isParty && draft.status === "submitted") return;
    if (isParty && (draft.status === "submitted" || parentFormSubmitted)) return;
    if (isParty) {
      void withSaveFeedback(
        "حفظ إجاباتي",
        "تم حفظ إجاباتك في نموذج الدراسة",
        () => ({ ...draft, status: "draft" }),
      );
      return;
    }
    const { answered, total, pct } = summary;
    if (pct < 100) {
      const ok = window.confirm(
        `تم الإجابة على ${answered} من ${total} سؤالاً (${pct}%). هل تريد الرفع رغم ذلك؟`,
      );
      if (!ok) return;
    }
    void withSaveFeedback(
      "رفع النموذج للنظام",
      "تم رفع نموذج دراسة الحالة للنظام بنجاح",
      () => ({ ...draft, status: "submitted" }),
    );
  };

  if (loadError) {
    return (
      <Note tone="warn">
        {loadError}
        <div className="mt-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setHydrated(false);
              setLoadError(null);
              setReloadKey((key) => key + 1);
            }}
          >
            إعادة المحاولة
          </Button>
        </div>
      </Note>
    );
  }

  if (!hydrated || !infoRolesReady) {
    return <InlineLoadingSkeleton className="my-2" />;
  }

  if (visibleStepIndices.length === 0) {
    const party = partyById(viewerPartyId);
    return (
      <Note tone="warn">
        لا توجد أسئلة مسندة لـ<strong>{party.name}</strong> في «علاقة المستخدم
        بالمعلومة». راجع الإعدادات في الشريط الجانبي.
      </Note>
    );
  }

  const step = draft.currentStep;
  const navSteps = visibleStepIndices;
  const isFirstVisibleStep = navSteps[0] === step;
  const isLastVisibleStep = navSteps[navSteps.length - 1] === step;
  const showStepFooterActions = !partyAdvisory;
  const isPartyVariant = variant === "party";
  const showFormStepChrome = !partyAdvisory && !isPartyVariant;
  const isFormReadOnly = Boolean(
    (!isParty && draft.status === "submitted") ||
      (isParty && (draft.status === "submitted" || parentFormSubmitted)),
  );

  const matrixTableProps = {
    canEditKey,
    visibleKey: isQuestionVisible,
    sectionIndex: navSteps.indexOf(step) + 1,
    sectionTotal: navSteps.length || 1,
    ...(isParty
      ? { showPartyColumn: false }
      : {
          partyByKey: partyAnswersByKey,
          showPartyColumn: true,
          partyContribCount,
          onRefreshParty: () => setPartyRevision((n) => n + 1),
        }),
  };

  const formFooterActions = isFormReadOnly ? (
    <p className="m-0 text-xs text-text-2">النموذج مُرفَع — للعرض فقط</p>
  ) : (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button
        variant="outline"
        showActionToast={false}
        disabled={saving}
        onClick={saveDraft}
      >
        حفظ مسودة
      </Button>
      {isParty ? (
        <Button
          variant="primary"
          showActionToast={false}
          disabled={saving}
          onClick={submitForm}
        >
          حفظ إجاباتي
        </Button>
      ) : (
        <Button
          variant="primary"
          showActionToast={false}
          disabled={saving}
          onClick={submitForm}
        >
          رفع النموذج للنظام
        </Button>
      )}
    </div>
  );

  const renderStepFooter = (nextLabel: string) => (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
      {!isFirstVisibleStep ? (
        <Button variant="outline" onClick={() => goAdjacentStep(-1)}>
          السابق →
        </Button>
      ) : (
        <span />
      )}
      {isLastVisibleStep ? (
        showStepFooterActions ? formFooterActions : null
      ) : (
        <Button variant="primary" onClick={() => goAdjacentStep(1)}>
          {nextLabel}
        </Button>
      )}
    </div>
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        partyAdvisory &&
          "mt-0 gap-4 [&_[data-registration-card]]:overflow-hidden [&_[data-registration-card]]:rounded-xl [&_[data-registration-card]]:border [&_[data-registration-card]]:border-border [&_[data-registration-card]]:shadow-sm [&_[data-registration-card]_div:last-child]:p-0",
      )}
    >
      {showFormStepChrome ? (
        <div className="mb-3.5 flex flex-wrap items-stretch gap-3.5 border-b border-border">
          <nav
            className="flex min-w-0 flex-1 flex-nowrap gap-2 overflow-x-auto"
            aria-label="خطوات نموذج الدراسة"
          >
            {navSteps.map((i) => {
              const s = CASE_STUDY_FORM_STEPS[i];
              const isActive = step === i;
              const isDone = i < step;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={cn(
                    "flex shrink-0 cursor-pointer items-center gap-1.5 border-none border-b-2 border-transparent bg-transparent px-3.5 py-2.5 text-xs whitespace-nowrap transition-colors",
                    isActive
                      ? "border-b-primary font-semibold text-primary"
                      : isDone
                        ? "text-success"
                        : "text-text-3 hover:text-text-2",
                  )}
                  onClick={() => goStep(i)}
                >
                  <span
                    className={cn(
                      "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold",
                      isActive && "bg-primary text-white",
                      isDone && "bg-success text-white",
                    )}
                  >
                    {STEP_AR_NUMS[i]}
                  </span>
                  {s.label}
                </button>
              );
            })}
          </nav>
          <FormProgressRings summary={summary} />
        </div>
      ) : null}

      {isFormReadOnly ? (
        <Note tone="success">
          {isParty
            ? "تم رفع نموذج دراسة الحالة — إجاباتك للعرض فقط ولا يمكن التعديل."
            : "تم رفع النموذج للنظام — العرض للقراءة فقط ولا يمكن تعديل الإجابات أو الملاحظات."}
        </Note>
      ) : null}

      {isParty && !partyAdvisory ? (
        <CaseStudyMatrixBanner
          viewerPartyId={viewerPartyId}
          isParty={!!isParty}
          partyAdvisory={partyAdvisory}
          partyContribCount={partyContribCount}
          onRefreshParty={() => setPartyRevision((n) => n + 1)}
        />
      ) : null}

      {step === 0 && sectionHasVisibleQuestions("deed") ? (
        <div className="flex flex-col gap-3">
          <CaseStudyMatrixTable
            section="deed"
            sectionTitle="بيانات الصك والعقار"
            questions={sectionQuestions.deed}
            answers={draft.answers}
            onAnswer={setAnswer}
            {...matrixTableProps}
            footer={
              !isParty ? (
                <RemarksBlock
                  label="في حال وجود اختلاف في البيانات أعلاه يتم التوضيح في الملاحظات ادناه"
                  value={draft.deedRemarks}
                  disabled={isFormReadOnly}
                  onChange={(v) => patch("deedRemarks", v)}
                />
              ) : undefined
            }
          />
          {!isParty && isLastVisibleStep ? (
            <SpecialistClosingCards reportModel={reportModel} />
          ) : null}
          {renderStepFooter("التالي — الرفع المساحي ←")}
        </div>
      ) : null}

      {step === 1 && sectionHasVisibleQuestions("survey") ? (
        <div className="flex flex-col gap-3">
          <CaseStudyMatrixTable
            section="survey"
            sectionTitle="الرفع المساحي والطبيعة"
            questions={sectionQuestions.survey}
            answers={draft.answers}
            onAnswer={setAnswer}
            {...matrixTableProps}
            footer={
              !isParty ? (
                <RemarksBlock
                  label="في حال وجود اختلاف في البيانات أعلاه يتم التوضيح في الملاحظات ادناه"
                  value={draft.surveyRemarks}
                  disabled={isFormReadOnly}
                  onChange={(v) => patch("surveyRemarks", v)}
                />
              ) : undefined
            }
          />
          {!isParty && isLastVisibleStep ? (
            <SpecialistClosingCards reportModel={reportModel} />
          ) : null}
          {renderStepFooter("التالي — مكونات العقار ←")}
        </div>
      ) : null}

      {step === 2 && sectionHasVisibleQuestions("comp") ? (
        <div className="flex flex-col gap-3">
          <CaseStudyMatrixTable
            section="comp"
            sectionTitle="مكونات العقار"
            questions={sectionQuestions.comp}
            answers={draft.answers}
            onAnswer={setAnswer}
            {...matrixTableProps}
            footer={
              !isParty ? (
                <>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border py-3 text-sm text-text">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-text-2">
                      <span className="whitespace-nowrap">عداد الكهرباء رقم</span>
                      <span className="inline-flex items-center gap-1 whitespace-nowrap">
                        <span aria-hidden="true">(</span>
                        <Input
                          className="w-[5.5rem] rounded-none border-0 border-b bg-transparent px-0.5 shadow-none focus:ring-0"
                          placeholder="رقم"
                          aria-label="رقم العداد"
                          value={draft.meterNumber}
                          disabled={isFormReadOnly}
                          onChange={(e) => patch("meterNumber", e.target.value)}
                        />
                        <span aria-hidden="true">)</span>
                      </span>
                    </span>
                    <span className="inline-flex flex-wrap items-center gap-3">
                      {(
                        [
                          ["electronic", "إلكتروني"],
                          ["analog", "مؤرشف"],
                          ["none", "لا يوجد"],
                        ] as const
                      ).map(([val, label]) => (
                        <label
                          key={val}
                          className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-normal text-text-2"
                        >
                          <input
                            type="radio"
                            name={`meter-${taskId}`}
                            checked={draft.meterType === val}
                            disabled={isFormReadOnly}
                            onChange={() => {
                              patch("meterType", val as CaseStudyMeterType);
                              if (val === "none") patch("meterNumber", "");
                            }}
                          />
                          {label}
                        </label>
                      ))}
                    </span>
                  </div>
                  <RemarksBlock
                    label="ملاحظات"
                    value={draft.componentsRemarks}
                    disabled={isFormReadOnly}
                    onChange={(v) => patch("componentsRemarks", v)}
                    rows={2}
                  />
                </>
              ) : undefined
            }
          />
          {!isParty && isLastVisibleStep ? (
            <SpecialistClosingCards reportModel={reportModel} />
          ) : null}
          {renderStepFooter("التالي — الإشغال والإيجار ←")}
        </div>
      ) : null}

      {step === 3 && sectionHasVisibleQuestions("occ") ? (
        <div className="flex flex-col gap-3">
          <CaseStudyMatrixTable
            section="occ"
            sectionTitle="الإشغال والإيجار"
            questions={sectionQuestions.occ}
            answers={draft.answers}
            onAnswer={setAnswer}
            {...matrixTableProps}
            footer={
              !isParty ? (
                <div className="border-t border-border pt-3">
                  <RegField
                    id="cs-hoa"
                    label="قيمة اشتراك اتحاد الملاك"
                    type="number"
                    placeholder="القيمة"
                    value={draft.hoaFee}
                    onChange={(v) => patch("hoaFee", v)}
                    className="inline-block max-w-[200px]"
                  />
                  <span className="me-2 text-xs text-text-2">ريال سعودي</span>
                  <RemarksBlock
                    label="ملاحظات"
                    value={draft.occupancyRemarks}
                    disabled={isFormReadOnly}
                    onChange={(v) => patch("occupancyRemarks", v)}
                    rows={2}
                  />
                </div>
              ) : undefined
            }
          />
          {!isParty && isLastVisibleStep ? (
            <SpecialistClosingCards reportModel={reportModel} />
          ) : null}
          {renderStepFooter("التالي — ملاحظات إضافية ←")}
        </div>
      ) : null}

      {step === 4 && sectionHasVisibleQuestions("extra") ? (
        <div className="flex flex-col gap-3">
          <CaseStudyMatrixTable
            section="extra"
            sectionTitle="ملاحظات إضافية"
            questions={sectionQuestions.extra}
            answers={draft.answers}
            onAnswer={setAnswer}
            {...matrixTableProps}
          />

          {!isParty && isLastVisibleStep ? (
            <SpecialistClosingCards reportModel={reportModel} />
          ) : null}
          {renderStepFooter("")}
        </div>
      ) : null}

      {!isParty ? (
        <CaseStudyInfathSpecialistSection
          draft={draft}
          disabled={isFormReadOnly}
          onPatch={(p) => {
            (Object.keys(p) as (keyof CaseStudyFormDraft)[]).forEach((key) => {
              patch(key, p[key] as CaseStudyFormDraft[typeof key]);
            });
          }}
        />
      ) : null}
    </div>
  );
}
