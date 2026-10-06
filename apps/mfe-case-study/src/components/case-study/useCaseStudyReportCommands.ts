"use client";

/**
 * Every write the case study form performs: the draft persistence for both
 * variants, single-answer saves, step moves, and the draft-save / submit
 * actions with their progress toasts. It reads and mutates the state owned by
 * `useCaseStudyReportData`.
 */
import { useCallback, useEffect, useRef } from "react";
import { progressMessageForActionLabel } from "@platform/ui-kit";
import {
  CASE_STUDY_REPORT_STEPS,
  type CaseStudyReportAnswer,
} from "../../lib/app-data/case-study-report-data";
import type { CaseStudyReportDraft } from "../../lib/app-data/case-study-report-model";
import { loadPartyCaseStudyReportDraft } from "../../lib/app-data/case-study-report-reads";
import {
  saveCaseStudyReportDraft,
  savePartyCaseStudyReportDraft,
} from "../../lib/app-data/case-study-report-commands";
import type { CaseStudyReportData } from "./useCaseStudyReportData";
import { useCaseStudyReportIssue } from "./useCaseStudyReportIssue";

export function useCaseStudyReportCommands(data: CaseStudyReportData) {
  const {
    isParty,
    partyChildTaskId,
    draft,
    setDraft,
    hydrated,
    parentFormSubmitted,
    saving,
    setSaving,
    setMissingAnswerKeys,
    setFormFieldErrors,
    canEditKey,
    visibleStepIndices,
    showToast,
    showProgressToast,
    dismissToast,
  } = data;

  const draftRef = useRef(draft);
  draftRef.current = draft;

  const persistToServer = useCallback(
    async (next: CaseStudyReportDraft, idempotencyKey?: string) => {
      if (isParty) return savePartyCaseStudyReportDraft(next);
      return saveCaseStudyReportDraft(next, idempotencyKey);
    },
    [isParty],
  );

  const persist = useCallback(
    (next: CaseStudyReportDraft) => {
      setDraft(next);
      if (!isParty && next.status === "issued" && draft.status === "issued") {
        return;
      }
      if (
        isParty &&
        (parentFormSubmitted ||
          draft.status === "issued" ||
          next.status === "issued")
      ) {
        return;
      }
      void persistToServer(next).then((result) => {
        if (result && !result.ok) showToast(result.error, "error");
      }).catch(() => {
        showToast("تعذّر حفظ تقرير دراسة الحالة — حاول مرة أخرى", "error");
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
    (key: string, value: CaseStudyReportAnswer | null) => {
      if (!canEditKey(key)) return;

      setMissingAnswerKeys((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });

      const displayAnswers = { ...draft.answers, [key]: value };
      const marksPartyReview = !isParty && (value === "A" || value === "B" || value === "NA");
      const next: CaseStudyReportDraft = {
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
        void loadPartyCaseStudyReportDraft(partyChildTaskId)
          .then((prevParty) => {
            const partyAnswers = {
              ...(prevParty?.answers ?? {}),
              [key]: value,
            };
            return savePartyCaseStudyReportDraft({
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
        void saveCaseStudyReportDraft(next).then((result) => {
          if (!result.ok) showToast(result.error, "error");
        }).catch(() => {
          showToast("تعذّر حفظ تقرير دراسة الحالة — حاول مرة أخرى", "error");
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

  const setAnswerNote = useCallback(
    (key: string, note: string) => {
      if (!canEditKey(key)) return;
      const nextNotes = { ...(draft.answerNotes ?? {}) };
      if (note.trim()) nextNotes[key] = note;
      else delete nextNotes[key];
      const next: CaseStudyReportDraft = { ...draft, answerNotes: nextNotes };
      setDraft(next);

      if (isParty && partyChildTaskId) {
        void loadPartyCaseStudyReportDraft(partyChildTaskId)
          .then((prevParty) => {
            const partyNotes = { ...(prevParty?.answerNotes ?? {}) };
            if (note.trim()) partyNotes[key] = note;
            else delete partyNotes[key];
            return savePartyCaseStudyReportDraft({
              ...next,
              taskId: partyChildTaskId,
              answers: { ...(prevParty?.answers ?? {}), ...next.answers },
              answerNotes: partyNotes,
            });
          })
          .then((result) => {
            if (result && !result.ok) showToast(result.error, "error");
          })
          .catch((err: unknown) => {
            showToast(
              err instanceof Error
                ? err.message
                : "تعذّر حفظ الملاحظة — حاول مرة أخرى",
              "error",
            );
          });
      } else {
        void saveCaseStudyReportDraft(next)
          .then((result) => {
            if (!result.ok) showToast(result.error, "error");
          })
          .catch(() => {
            showToast("تعذّر حفظ تقرير دراسة الحالة — حاول مرة أخرى", "error");
          });
      }
    },
    [canEditKey, draft, isParty, partyChildTaskId, setDraft, showToast],
  );

  const goStep = useCallback((n: number) => {
    const step = Math.max(0, Math.min(CASE_STUDY_REPORT_STEPS.length - 1, n));
    persist({ ...draftRef.current, currentStep: step });
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [persist]);

  const { submittingForm, issueReport, reopenReport } = useCaseStudyReportIssue(
    data,
    goStep,
  );

  useEffect(() => {
    if (!hydrated || visibleStepIndices.length === 0) return;
    if (!visibleStepIndices.includes(draft.currentStep)) {
      goStep(visibleStepIndices[0]);
    }
  }, [hydrated, visibleStepIndices, draft.currentStep, goStep]);

  const patch = <K extends keyof CaseStudyReportDraft>(
    key: K,
    value: CaseStudyReportDraft[K],
  ) => {
    const current = draftRef.current;
    if (isParty || current.status === "issued") return;
    if (
      key === "deedRemarks" ||
      key === "deedNatureMatchOutcome" ||
      key === "deedNatureMatchNotes"
    ) {
      setFormFieldErrors({});
    }
    const next = { ...current, [key]: value };
    draftRef.current = next;
    persist(next);
  };

  const withSaveFeedback = async (
    actionLabel: string,
    successMessage: string,
    buildNext: () => CaseStudyReportDraft,
  ): Promise<boolean> => {
    if (saving || submittingForm) return false;

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
    if (!isParty && draft.status === "issued") return;
    void withSaveFeedback(
      "حفظ مسودة",
      "تم حفظ المسودة — يمكنك مواصلة التعبئة لاحقاً",
      () => ({ ...draft, status: "draft" }),
    );
  };

  const submitForm = async () => {
    if (!isParty && draft.status === "issued") return;
    if (isParty && (draft.status === "issued" || parentFormSubmitted)) return;
    if (saving || submittingForm) return;
    if (isParty) {
      await withSaveFeedback(
        "حفظ إجاباتي",
        "تم حفظ إجاباتك في تقرير دراسة الحالة",
        () => ({ ...draft, status: "draft" }),
      );
      return;
    }

    await issueReport();
  };

  return {
    submittingForm,
    persist,
    setAnswer,
    setAnswerNote,
    goStep,
    patch,
    saveDraft,
    submitForm,
    reopenReport,
  };
}

export type CaseStudyReportCommands = ReturnType<typeof useCaseStudyReportCommands>;
