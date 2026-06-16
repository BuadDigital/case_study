"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  FormGroup,
  Input,
  Label,
  Note,
  Textarea,
  cn,
} from "@platform/design-system";
import { RegistrationFormCard } from "@platform/app-shared/registration/RegistrationFormCard";
import { RegField } from "@platform/app-shared/registration/FormFields";
import {
  CASE_STUDY_FORM_STEPS,
  CASE_STUDY_SECTION_QUESTIONS,
  caseStudyAnswerKey,
  type CaseStudyFormAnswer,
  type CaseStudyQuestionSection,
} from "../../lib/prototype/case-study-form-data";
import { CaseStudyReportActions } from "./CaseStudyReportActions";
import { CaseStudyProgressDonut } from "./CaseStudyProgressDonut";
import { CaseStudyMatrixTable } from "./CaseStudyMatrixTable";
import { CaseStudyInfathSpecialistSection } from "./CaseStudyInfathSpecialistSection";
import {
  canPartyAnswerQuestion,
  CASE_STUDY_INFO_ROLES_CHANGED_EVENT,
  emptyCaseStudyInfoRolesConfig,
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
  loadPartyCaseStudyFormDraft,
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

function migrateFormStep(storedStep: number): number {
  const max = CASE_STUDY_FORM_STEPS.length - 1;
  // Legacy drafts used step 0 for بيانات التعميد (removed).
  const next = storedStep >= 1 ? storedStep - 1 : 0;
  return Math.max(0, Math.min(max, next));
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <FormGroup className="mb-4 border-t border-border pt-3">
      <Label className="mb-1.5 text-xs font-medium text-amber-text">{label}</Label>
      <Textarea
        rows={rows}
        placeholder="الملاحظات..."
        value={value}
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
    <RegistrationFormCard title="التقرير النهائي">
      <p className="mb-3 text-xs leading-relaxed text-text-2">
        يُعبّأ التقرير تلقائياً من إجابات النموذج وبيانات النظام (الصك، أمر
        العمل، التاريخ، المعتمد).
      </p>
      <CaseStudyReportActions model={reportModel} />
    </RegistrationFormCard>
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
  const infoRoles = infoRolesData ?? DEFAULT_INFO_ROLES_CONFIG;
  const infoRolesMatrix = infoRoles.matrix;

  const [draft, setDraft] = useState<CaseStudyFormDraft>(() =>
    emptyCaseStudyFormDraft(storageTaskId, seed),
  );
  const [hydrated, setHydrated] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [partyRevision, setPartyRevision] = useState(0);
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
    (key: string) =>
      isPartyQuestionVisible(infoRolesMatrix, key, viewerPartyId),
    [viewerPartyId, infoRolesMatrix],
  );

  const partyContribCount = useMemo(() => {
    if (isParty) return 0;
    let n = 0;
    for (const [key, items] of Object.entries(partyAnswersByKey)) {
      if (isQuestionVisible(key)) n += items.length;
    }
    return n;
  }, [isParty, partyAnswersByKey, isQuestionVisible]);

  useEffect(() => {
    if (isParty) return;
    const refresh = () => setPartyRevision((n) => n + 1);
    window.addEventListener("focus", refresh);
    window.addEventListener(CASE_STUDY_INFO_ROLES_CHANGED_EVENT, refresh);
    window.addEventListener(EVALUATOR_SUBMISSION_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener(CASE_STUDY_INFO_ROLES_CHANGED_EVENT, refresh);
      window.removeEventListener(EVALUATOR_SUBMISSION_CHANGED_EVENT, refresh);
    };
  }, [isParty]);

  const canEditKey = useCallback(
    (key: string) =>
      canPartyAnswerQuestion(infoRolesMatrix, key, viewerPartyId),
    [viewerPartyId, infoRolesMatrix],
  );

  const sectionHasVisibleQuestions = useCallback(
    (section: CaseStudyQuestionSection) =>
      CASE_STUDY_SECTION_QUESTIONS[section].some((_, i) =>
        isQuestionVisible(caseStudyAnswerKey(section, i)),
      ),
    [isQuestionVisible],
  );

  const visibleStepIndices = useMemo(() => {
    return FORM_STEP_SECTIONS.map((section, i) =>
      sectionHasVisibleQuestions(section) ? i : -1,
    ).filter((i) => i >= 0);
  }, [sectionHasVisibleQuestions]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const parentDraft = await loadCaseStudyFormDraft(referenceTaskId);
      const partyStored = isParty
        ? await loadPartyCaseStudyFormDraft(storageTaskId)
        : null;
      const stored = isParty
        ? partyStored
        : await loadCaseStudyFormDraft(storageTaskId);
      const base =
        stored ?? emptyCaseStudyFormDraft(storageTaskId, seed);
      const mergedAnswers = isParty
        ? { ...parentDraft?.answers, ...base.answers }
        : base.answers;
      if (cancelled) return;
      setDraft({
        ...base,
        ...seed,
        answers: mergedAnswers,
        specialistReviewApproved: {
          ...base.specialistReviewApproved,
          ...stored?.specialistReviewApproved,
        },
        requestNumber: seed.requestNumber ?? base.requestNumber,
        deedNumber: seed.deedNumber ?? base.deedNumber,
        requestDate: seed.requestDate ?? base.requestDate,
        currentStep: stored ? migrateFormStep(stored.currentStep) : 0,
      });
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per task
  }, [storageTaskId, referenceTaskId, isParty]);

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

  const persist = useCallback(
    (next: CaseStudyFormDraft) => {
      setDraft(next);
      if (isParty) void savePartyCaseStudyFormDraft(next);
      else void saveCaseStudyFormDraft(next);
    },
    [isParty],
  );

  const setAnswer = useCallback(
    (key: string, value: CaseStudyFormAnswer | null) => {
      if (!canEditKey(key)) return;
      setDraft((d) => {
        const displayAnswers = { ...d.answers, [key]: value };
        const next = { ...d, answers: displayAnswers };
        if (isParty && partyChildTaskId) {
          void loadPartyCaseStudyFormDraft(partyChildTaskId).then((prevParty) => {
            const partyAnswers = {
              ...(prevParty?.answers ?? {}),
              [key]: value,
            };
            void savePartyCaseStudyFormDraft({
              ...next,
              taskId: partyChildTaskId,
              answers: partyAnswers,
            });
          });
        } else {
          void saveCaseStudyFormDraft(next);
        }
        return next;
      });
    },
    [canEditKey, isParty, partyChildTaskId],
  );

  const summary = useMemo(() => {
    let total = 0;
    let answered = 0;
    for (const section of FORM_STEP_SECTIONS) {
      CASE_STUDY_SECTION_QUESTIONS[section].forEach((_, i) => {
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
  }, [draft.answers, isQuestionVisible]);

  const reportModel = useMemo(
    () => buildCaseStudyReportModel(draft, property, task, poRecord),
    [draft, property, task, poRecord],
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
    if (isParty) return;
    setDraft((d) => {
      const next = { ...d, [key]: value };
      void saveCaseStudyFormDraft(next);
      return next;
    });
  };

  const saveDraft = () => {
    persist({ ...draft, status: "draft" });
    setSaveNotice("تم حفظ المسودة — يمكنك مواصلة التعبئة لاحقاً");
    window.setTimeout(() => setSaveNotice(null), 4000);
  };

  const submitForm = () => {
    if (isParty) {
      persist({ ...draft, status: "draft" });
      setSaveNotice("تم حفظ إجاباتك في نموذج الدراسة");
      window.setTimeout(() => setSaveNotice(null), 4000);
      return;
    }
    const { answered, total, pct } = summary;
    if (pct < 100) {
      const ok = window.confirm(
        `تم الإجابة على ${answered} من ${total} سؤالاً (${pct}%). هل تريد الرفع رغم ذلك؟`,
      );
      if (!ok) return;
    }
    persist({ ...draft, status: "submitted" });
    setSaveNotice("تم رفع نموذج دراسة الحالة للنظام بنجاح");
    window.setTimeout(() => setSaveNotice(null), 5000);
  };

  if (!hydrated || !infoRolesReady) {
    return <p className="my-2 text-xs text-text-3">جاري تحميل النموذج…</p>;
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

  const formFooterActions = (
    <div className="flex justify-end gap-2">
      <Button onClick={saveDraft}>حفظ مسودة</Button>
      {isParty ? (
        <Button variant="primary" onClick={submitForm}>
          حفظ إجاباتي
        </Button>
      ) : (
        <Button
          className="border-success bg-success text-white hover:border-primary-mid hover:bg-primary-mid"
          onClick={submitForm}
        >
          رفع النموذج للنظام
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
      {!partyAdvisory ? (
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

      {saveNotice ? <Note tone="success">{saveNotice}</Note> : null}

      {isParty ? (
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
            answers={draft.answers}
            onAnswer={setAnswer}
            {...matrixTableProps}
            footer={
              !isParty ? (
                <RemarksBlock
                  label="في حال وجود اختلاف في البيانات أعلاه يتم التوضيح في الملاحظات ادناه"
                  value={draft.deedRemarks}
                  onChange={(v) => patch("deedRemarks", v)}
                />
              ) : undefined
            }
          />
          {!isParty && isLastVisibleStep ? (
            <SpecialistClosingCards reportModel={reportModel} />
          ) : null}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <span />
            {isLastVisibleStep ? (
              showStepFooterActions ? formFooterActions : null
            ) : (
              <Button variant="primary" onClick={() => goAdjacentStep(1)}>
                التالي — الرفع المساحي ←
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {step === 1 && sectionHasVisibleQuestions("survey") ? (
        <div className="flex flex-col gap-3">
          <CaseStudyMatrixTable
            section="survey"
            sectionTitle="الرفع المساحي والطبيعة"
            answers={draft.answers}
            onAnswer={setAnswer}
            {...matrixTableProps}
            footer={
              !isParty ? (
                <RemarksBlock
                  label="في حال وجود اختلاف في البيانات أعلاه يتم التوضيح في الملاحظات ادناه"
                  value={draft.surveyRemarks}
                  onChange={(v) => patch("surveyRemarks", v)}
                />
              ) : undefined
            }
          />
          {!isParty && isLastVisibleStep ? (
            <SpecialistClosingCards reportModel={reportModel} />
          ) : null}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            {!isFirstVisibleStep ? (
              <Button variant="outline" onClick={() => goAdjacentStep(-1)}>
                → السابق
              </Button>
            ) : (
              <span />
            )}
            {isLastVisibleStep ? (
              showStepFooterActions ? formFooterActions : null
            ) : (
              <Button variant="primary" onClick={() => goAdjacentStep(1)}>
                التالي — مكونات العقار ←
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {step === 2 && sectionHasVisibleQuestions("comp") ? (
        <div className="flex flex-col gap-3">
          <CaseStudyMatrixTable
            section="comp"
            sectionTitle="مكونات العقار"
            answers={draft.answers}
            onAnswer={setAnswer}
            {...matrixTableProps}
            footer={
              !isParty ? (
                <>
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-border py-3 text-sm text-text">
                    <span className="font-semibold text-text-2">عداد الكهرباء رقم (</span>
                    <Input
                      className="w-[5.5rem] rounded-none border-0 border-b bg-transparent px-0.5 shadow-none focus:ring-0"
                      placeholder="رقم"
                      aria-label="رقم العداد"
                      value={draft.meterNumber}
                      onChange={(e) => patch("meterNumber", e.target.value)}
                    />
                    <span className="font-semibold text-text-2">)</span>
                    <span className="ms-2 inline-flex flex-wrap items-center gap-3">
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
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            {!isFirstVisibleStep ? (
              <Button variant="outline" onClick={() => goAdjacentStep(-1)}>
                → السابق
              </Button>
            ) : (
              <span />
            )}
            {isLastVisibleStep ? (
              showStepFooterActions ? formFooterActions : null
            ) : (
              <Button variant="primary" onClick={() => goAdjacentStep(1)}>
                التالي — الإشغال والإيجار ←
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {step === 3 && sectionHasVisibleQuestions("occ") ? (
        <div className="flex flex-col gap-3">
          <CaseStudyMatrixTable
            section="occ"
            sectionTitle="الإشغال والإيجار"
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
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            {!isFirstVisibleStep ? (
              <Button variant="outline" onClick={() => goAdjacentStep(-1)}>
                → السابق
              </Button>
            ) : (
              <span />
            )}
            {isLastVisibleStep ? (
              showStepFooterActions ? formFooterActions : null
            ) : (
              <Button variant="primary" onClick={() => goAdjacentStep(1)}>
                التالي — ملاحظات إضافية ←
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {step === 4 && sectionHasVisibleQuestions("extra") ? (
        <div className="flex flex-col gap-3">
          <CaseStudyMatrixTable
            section="extra"
            sectionTitle="ملاحظات إضافية"
            answers={draft.answers}
            onAnswer={setAnswer}
            {...matrixTableProps}
          />

          {!isParty && isLastVisibleStep ? (
            <SpecialistClosingCards reportModel={reportModel} />
          ) : null}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            {!isFirstVisibleStep ? (
              <Button variant="outline" onClick={() => goAdjacentStep(-1)}>
                → السابق
              </Button>
            ) : (
              <span />
            )}
            {isLastVisibleStep ? (showStepFooterActions ? formFooterActions : null) : null}
          </div>
        </div>
      ) : null}

      {!isParty ? (
        <CaseStudyInfathSpecialistSection
          draft={draft}
          disabled={draft.status === "submitted"}
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
