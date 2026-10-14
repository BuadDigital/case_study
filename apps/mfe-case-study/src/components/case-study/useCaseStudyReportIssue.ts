"use client";

/**
 * Issuing and reopening the specialist's case study report. Issuing is a hard gate: every visible
 * question must be answered (the server re-checks it from the body); there is no «issue anyway».
 * Split out of `useCaseStudyReportCommands` to keep that hook inside its size cap.
 */
import { useCallback, useRef, useState } from "react";
import { progressMessageForActionLabel } from "@platform/ui-kit";
import {
  issueCaseStudyReportDraft,
  reopenCaseStudyReportDraft,
  type ReopenCaseStudyReportDraftResult,
} from "../../lib/app-data/case-study-report-commands";
import {
  caseStudyReopenSuccessMessage,
  type CaseStudyReopenOutcome,
} from "../../lib/app-data/case-study-report-issue-errors";
import {
  scheduleScrollToCaseStudyField,
  scheduleScrollToCaseStudyQuestion,
} from "../../lib/app-data/case-study-report-ux";
import { openCaseStudyAppraisalTab } from "../../lib/case-study-workspace-events";
import {
  caseStudyIncompleteMessage,
  firstCaseStudyReportScrollTarget,
  firstMissingQuestionLocation,
} from "./case-study-report-state";
import type { CaseStudyReportData } from "./useCaseStudyReportData";

export function useCaseStudyReportIssue(
  data: CaseStudyReportData,
  goStep: (n: number) => void,
) {
  const {
    draft,
    setDraft,
    saving,
    setSaving,
    setReloadKey,
    sectionQuestions,
    isQuestionVisible,
    property,
    summary,
    setMissingAnswerKeys,
    setFormFieldErrors,
    showToast,
    showProgressToast,
    dismissToast,
  } = data;

  const [submittingForm, setSubmittingForm] = useState(false);
  const inFlight = useRef(false);

  const issueReport = useCallback(async () => {
    if (inFlight.current || saving) return;
    const gate = firstCaseStudyReportScrollTarget({
      draft,
      sectionQuestions,
      isQuestionVisible,
      property,
      isParty: false,
    });
    if (gate?.blocking) {
      setMissingAnswerKeys(gate.missingAnswerKeys ?? new Set());
      setFormFieldErrors({
        deedRemarks: gate.invalidDeedRemarks,
        deedNature: gate.invalidDeedNature,
        deedNatureNotes: gate.invalidDeedNatureNotes,
      });
      if (gate.invalidDeedNature || gate.invalidDeedNatureNotes) {
        openCaseStudyAppraisalTab();
      } else {
        if (gate.step !== draft.currentStep) goStep(gate.step);
        scheduleScrollToCaseStudyField(gate.targetId, 200);
      }
      showToast(gate.message, "error");
      return;
    }

    inFlight.current = true;
    setSubmittingForm(true);
    setSaving(true);
    const progressId = showProgressToast(
      progressMessageForActionLabel("إصدار تقرير دراسة الحالة"),
    );
    try {
      setMissingAnswerKeys(new Set());
      const result = await issueCaseStudyReportDraft({ ...draft, status: "draft" });
      if (result.ok) {
        setDraft(result.draft);
        showToast("تم إصدار تقرير دراسة الحالة بنجاح", "success");
        return;
      }
      const where = firstMissingQuestionLocation(
        result.missingQuestionKeys,
        sectionQuestions,
      );
      if (where) {
        setMissingAnswerKeys(result.missingQuestionKeys);
        if (where.step !== draft.currentStep) goStep(where.step);
        scheduleScrollToCaseStudyQuestion(where.key, 200);
        showToast(
          result.answersMessage ??
            caseStudyIncompleteMessage(summary.answered, summary.total),
          "error",
        );
        return;
      }
      if (result.deedNature || result.deedNatureNotes || result.deedRemarks) {
        setFormFieldErrors({
          deedRemarks: result.deedRemarks,
          deedNature: result.deedNature,
          deedNatureNotes: result.deedNatureNotes,
        });
        if (result.deedNature || result.deedNatureNotes) {
          openCaseStudyAppraisalTab();
        }
      }
      showToast(result.error, "error");
    } catch {
      showToast("تعذّر إصدار تقرير دراسة الحالة — حاول مرة أخرى", "error");
    } finally {
      dismissToast(progressId);
      setSaving(false);
      setSubmittingForm(false);
      inFlight.current = false;
    }
  }, [
    draft,
    saving,
    sectionQuestions,
    isQuestionVisible,
    property,
    summary,
    goStep,
    setDraft,
    setSaving,
    setMissingAnswerKeys,
    setFormFieldErrors,
    showToast,
    showProgressToast,
    dismissToast,
  ]);

  /**
   * Reopen the issued report (specialist only — the server refuses anyone else). A property already
   * handed over to Enfaz answers `needsEnfazConfirmation`; the dialog retries with the clear confirmed.
   * On success the draft is reloaded so the editor unlocks.
   */
  const reopenReport = useCallback(
    async (
      reason: string,
      clearEnfazHandover: boolean,
    ): Promise<CaseStudyReopenOutcome> => {
      let result: ReopenCaseStudyReportDraftResult;
      try {
        result = await reopenCaseStudyReportDraft(
          draft.taskId,
          reason,
          clearEnfazHandover,
        );
      } catch {
        return {
          ok: false,
          error: "تعذّر إعادة فتح التقرير — حاول مرة أخرى",
          needsEnfazConfirmation: false,
        };
      }
      if (!result.ok) {
        return {
          ok: false,
          error: result.error,
          needsEnfazConfirmation: result.needsEnfazConfirmation,
        };
      }
      setDraft(result.draft);
      setReloadKey((key) => key + 1);
      showToast(caseStudyReopenSuccessMessage(result.appraiserSubmitted), "success");
      return { ok: true };
    },
    [draft.taskId, setDraft, setReloadKey, showToast],
  );

  return { submittingForm, issueReport, reopenReport };
}
