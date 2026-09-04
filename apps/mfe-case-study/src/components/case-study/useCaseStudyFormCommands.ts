"use client";

/**
 * Every write the case study form performs: the draft persistence for both
 * variants, single-answer saves, step moves, and the draft-save / submit
 * actions with their progress toasts. It reads and mutates the state owned by
 * `useCaseStudyFormData`.
 */
import { useCallback, useEffect, useRef } from "react";
import { progressMessageForActionLabel } from "@platform/ui-kit";
import { useIdempotentAction } from "@platform/app-shared";
import {
  CASE_STUDY_FORM_STEPS,
  type CaseStudyFormAnswer,
} from "../../lib/app-data/case-study-form-data";
import type { CaseStudyFormDraft } from "../../lib/app-data/case-study-form-model";
import { loadPartyCaseStudyFormDraft } from "../../lib/app-data/case-study-form-reads";
import {
  saveCaseStudyFormDraft,
  savePartyCaseStudyFormDraft,
} from "../../lib/app-data/case-study-form-commands";
import { scheduleScrollToCaseStudyQuestion } from "../../lib/app-data/case-study-form-ux";
import {
  collectMissingCaseStudyAnswers,
  deedNonMatchAnswerKeys,
} from "./case-study-form-state";
import type { CaseStudyFormData } from "./useCaseStudyFormData";

export function useCaseStudyFormCommands(data: CaseStudyFormData) {
  const {
    isParty,
    partyChildTaskId,
    sectionQuestions,
    draft,
    setDraft,
    hydrated,
    parentFormSubmitted,
    saving,
    setSaving,
    setMissingAnswerKeys,
    isQuestionVisible,
    canEditKey,
    visibleStepIndices,
    summary,
    showToast,
    showProgressToast,
    dismissToast,
  } = data;

  const persistToServer = useCallback(
    async (next: CaseStudyFormDraft, idempotencyKey?: string) => {
      if (isParty) return savePartyCaseStudyFormDraft(next);
      return saveCaseStudyFormDraft(next, idempotencyKey);
    },
    [isParty],
  );

  const pendingSubmitDraft = useRef<CaseStudyFormDraft | null>(null);
  const { execute: executeFormSubmit, loading: submittingForm } =
    useIdempotentAction(
      useCallback(
        async (idempotencyKey: string) => {
          const next = pendingSubmitDraft.current;
          if (!next) throw new Error("لا يوجد نموذج للإرسال");
          return persistToServer(next, idempotencyKey);
        },
        [persistToServer],
      ),
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
    [
      persistToServer,
      isParty,
      draft.status,
      parentFormSubmitted,
      setDraft,
      showToast,
    ],
  );

  const setAnswer = useCallback(
    (key: string, value: CaseStudyFormAnswer | null) => {
      if (!canEditKey(key)) return;

      setMissingAnswerKeys((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });

      const displayAnswers = { ...draft.answers, [key]: value };
      const marksPartyReview = !isParty && (value === "A" || value === "B" || value === "NA");
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
    [
      canEditKey,
      draft,
      isParty,
      partyChildTaskId,
      setDraft,
      setMissingAnswerKeys,
      showToast,
    ],
  );

  const goStep = (n: number) => {
    const step = Math.max(0, Math.min(CASE_STUDY_FORM_STEPS.length - 1, n));
    persist({ ...draft, currentStep: step });
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
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
    opts?: { skipSavingGuard?: boolean; idempotentSubmit?: boolean },
  ): Promise<boolean> => {
    if (!opts?.skipSavingGuard && (saving || submittingForm)) return false;

    const progressId = showProgressToast(
      progressMessageForActionLabel(actionLabel),
    );
    if (!opts?.skipSavingGuard) setSaving(true);
    try {
      let result: Awaited<ReturnType<typeof persistToServer>>;
      if (opts?.idempotentSubmit) {
        pendingSubmitDraft.current = buildNext();
        const outcome = await executeFormSubmit();
        if (outcome.status === "skipped") return false;
        result = outcome.value;
      } else {
        result = await persistToServer(buildNext());
      }
      if (!result.ok) {
        showToast(result.error, "error");
        return false;
      }
      setDraft(result.draft);
      showToast(successMessage, "success");
      return true;
    } finally {
      dismissToast(progressId);
      if (!opts?.skipSavingGuard) setSaving(false);
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

  const submitForm = async () => {
    if (!isParty && draft.status === "submitted") return;
    if (isParty && (draft.status === "submitted" || parentFormSubmitted)) return;
    if (saving || submittingForm) return;
    if (isParty) {
      await withSaveFeedback(
        "حفظ إجاباتي",
        "تم حفظ إجاباتك في نموذج الدراسة",
        () => ({ ...draft, status: "draft" }),
      );
      return;
    }

    setSaving(true);
    try {
      const { answered, total, pct } = summary;
      const deedNonMatchKeys = deedNonMatchAnswerKeys(
        draft.answers,
        sectionQuestions,
        isQuestionVisible,
      );
      if (
        deedNonMatchKeys.length > 0 &&
        !String(draft.deedRemarks ?? "").trim()
      ) {
        showToast(
          "الملاحظات إلزامية عند إجابة «غير مطابق» في أسئلة الصك — أكمل ملاحظات قسم الصك.",
          "error",
        );
        if (draft.currentStep !== 0) goStep(0);
        return;
      }
      if (pct < 100) {
        const { missing, firstMissingKey, firstMissingStep } =
          collectMissingCaseStudyAnswers(
            draft.answers,
            sectionQuestions,
            isQuestionVisible,
          );
        setMissingAnswerKeys(missing);
        if (firstMissingKey) {
          const step = firstMissingStep ?? draft.currentStep;
          if (step !== draft.currentStep) {
            goStep(step);
          }
          scheduleScrollToCaseStudyQuestion(firstMissingKey, 200);
        }
        showToast(
          `أسئلة ناقصة: ${total - answered} من ${total} — انتقل للحقل المميّز`,
          "error",
        );
        const ok = window.confirm(
          `تم الإجابة على ${answered} من ${total} سؤالاً (${pct}%). هل تريد الرفع رغم ذلك؟`,
        );
        if (!ok) return;
        setMissingAnswerKeys(new Set());
      }
      await withSaveFeedback(
        "رفع النموذج للنظام",
        "تم رفع نموذج دراسة الحالة للنظام بنجاح",
        () => ({ ...draft, status: "submitted" }),
        { skipSavingGuard: true, idempotentSubmit: true },
      );
    } finally {
      setSaving(false);
    }
  };

  return {
    submittingForm,
    persist,
    setAnswer,
    goStep,
    patch,
    saveDraft,
    submitForm,
  };
}

export type CaseStudyFormCommands = ReturnType<typeof useCaseStudyFormCommands>;
