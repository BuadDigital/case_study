"use client";

/**
 * Every write the engineering survey work screen performs: starting the survey,
 * field and coordinate edits, the checklist sync into the case study answers,
 * the two attachments and the finalize submit the window host calls. It reads
 * and mutates the state owned by `useEngineeringSurveyData`.
 */
import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { activeSurveyEntryPath } from "@case-study/mfe/lib/my-task-routes";
import { emptyCaseStudyFormDraft } from "@case-study/mfe/lib/app-data/case-study-form-model";
import { loadPartyCaseStudyFormDraft } from "@case-study/mfe/lib/app-data/case-study-form-reads";
import { savePartyCaseStudyFormDraft } from "@case-study/mfe/lib/app-data/case-study-form-commands";
import {
  declarationPhoneGate,
  hasAnyPartyPhone,
} from "@case-study/mfe/lib/app-data/documentary-workflow-gates";
import { useIdempotentAction } from "@platform/app-shared";
import { failureRecordTitle } from "@failures/mfe/lib/failures-labels";
import type { EngineeringSurveySubmission } from "../lib/engineering-survey-data";
import { loadEngineeringSurveySubmission } from "../lib/engineering-survey-submission-model";
import { updateEngineeringSurveyDraft } from "../lib/engineering-survey-submission-commands";
import {
  cacheEngineeringSurveyFile,
  clearEngineeringSurveyFile,
} from "../lib/engineering-survey-attachments";
import { scheduleScrollToFormField } from "@platform/app-shared/form-ux";
import {
  firstEngineeringSurveyError,
  firstEngineeringSurveyErrorTarget,
  validateEngineeringSurveySubmission,
  isPlattedPropertyWithPlot,
} from "../lib/engineering-survey-validation";
import { finalizeEngineeringSurveySubmission } from "../lib/finalize-engineering-survey-submission";
import {
  applyChecklistToCaseStudyAnswers,
  caseStudyAnswersChanged,
} from "../lib/engineering-survey-checklist-sync";
import {
  checklistAnswerSignature,
  fieldErrorKeyForLocalField,
  surveyAttachmentTarget,
  withoutFieldErrors,
  type SurveyAttachmentField,
} from "./engineering-survey-work-state";
import {
  localFieldsFromDraft,
  type LocalTextFields,
} from "./EngineeringSurveyWorkParts";
import type { EngineeringSurveyData } from "./useEngineeringSurveyData";

export function useEngineeringSurveyCommands(data: EngineeringSurveyData) {
  const {
    role,
    viewOnly,
    propertyId,
    property,
    task,
    hostRef,
    draft,
    setDraft,
    draftRef,
    localFields,
    setLocalFields,
    setFieldErrors,
    setFormError,
    documentaryGate,
    locked,
    formDisabled,
    transactionActive,
    notesEditable,
    blockingFailure,
    setWorkTab,
    noteDraft,
    persist,
    schedulePersist,
    flushPendingPersist,
    applyRemoteDraft,
    showToast,
    runWithUploadToast,
  } = data;

  const router = useRouter();

  const { execute: executeSurveySubmit } = useIdempotentAction(
    useCallback(
      async (idempotencyKey: string) =>
        finalizeEngineeringSurveySubmission(task.id, idempotencyKey),
      [task.id],
    ),
  );

  const handleStartSurvey = useCallback(() => {
    if (!transactionActive) {
      showToast(
        "تم إرسال الرفع المساحي لهذا العقار. استخدم «طلب استرجاع المعاملة» من قائمة الإجراءات لإعادة فتح العمل.",
        "info",
      );
      return;
    }
    if (!documentaryGate.ready) {
      showToast(documentaryGate.reason, "error");
      if (blockingFailure) setWorkTab("failures");
      return;
    }
    if (blockingFailure) {
      showToast(
        `لا يمكن بدء الرفع المساحي — يوجد تعذر نشط: ${failureRecordTitle(blockingFailure)}`,
        "error",
      );
      setWorkTab("failures");
      return;
    }
    // HTML: start switches to work mode + survey tab; entry already is work mode.
    if (!viewOnly) {
      setWorkTab("survey");
      return;
    }
    router.push(activeSurveyEntryPath(task.id));
  }, [
    blockingFailure,
    documentaryGate,
    router,
    setWorkTab,
    showToast,
    task.id,
    transactionActive,
    viewOnly,
  ]);

  const syncCaseStudyFromChecklist = useCallback(
    async (checklist: EngineeringSurveySubmission["checklist"]) => {
      if (locked || viewOnly || !task.id) return;

      const partyDraft =
        (await loadPartyCaseStudyFormDraft(task.id)) ??
        emptyCaseStudyFormDraft(task.id, {
          propertyId,
          poNumber: task.poNumber,
        });

      const mergedAnswers = applyChecklistToCaseStudyAnswers(
        checklist,
        partyDraft.answers,
      );
      if (!caseStudyAnswersChanged(partyDraft.answers, mergedAnswers)) return;

      const saved = await savePartyCaseStudyFormDraft({
        ...partyDraft,
        answers: mergedAnswers,
      });
      if (!saved.ok) {
        showToast(
          saved.error ?? "تعذّر مزامنة إجابات دراسة الحالة",
          "error",
        );
      }
    },
    [locked, propertyId, task.id, task.poNumber, showToast, viewOnly],
  );

  const patchLocalField = useCallback(
    <K extends keyof LocalTextFields>(key: K, value: LocalTextFields[K]) => {
      setLocalFields((prev) => (prev ? { ...prev, [key]: value } : prev));
      schedulePersist({ [key]: value } as Parameters<
        typeof updateEngineeringSurveyDraft
      >[1]);
      const errorKey = fieldErrorKeyForLocalField(key);
      if (errorKey) {
        setFieldErrors((prev) => withoutFieldErrors(prev, [errorKey]));
      }
    },
    [schedulePersist, setFieldErrors, setLocalFields],
  );

  const saveNote = useCallback(() => {
    if (!notesEditable) return;
    persist({ transactionNote: noteDraft });
    setDraft((prev) =>
      prev ? { ...prev, transactionNote: noteDraft } : prev,
    );
    showToast("تم حفظ الملاحظة", "success");
  }, [noteDraft, notesEditable, persist, setDraft, showToast]);

  const submit = useCallback(async (): Promise<boolean> => {
    if (!draft || locked || viewOnly || !localFields) return false;

    await flushPendingPersist();

    if (!documentaryGate.ready) {
      setFormError(documentaryGate.reason);
      showToast(documentaryGate.reason, "error");
      return false;
    }

    const phoneGate = declarationPhoneGate({
      role,
      hasPhone: hasAnyPartyPhone(property?.contacts),
      phoneWasPresentAtDeclaration: draft.declarationPhoneSatisfied,
    });
    if (!phoneGate.ready) {
      setFormError(phoneGate.reason);
      showToast(phoneGate.reason, "error");
      return false;
    }

    if (
      hasAnyPartyPhone(property?.contacts) &&
      !draft.declarationPhoneSatisfied
    ) {
      await updateEngineeringSurveyDraft(task.id, {
        declarationPhoneSatisfied: true,
      });
    }

    const merged: EngineeringSurveySubmission = {
      ...draft,
      ...localFields,
    };
    const siteLetterRequired = !isPlattedPropertyWithPlot(property);
    const errors = validateEngineeringSurveySubmission(merged, {
      siteLetterRequired,
    });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      const message = firstEngineeringSurveyError(errors);
      setFormError(message);
      showToast(message, "error");
      scheduleScrollToFormField(firstEngineeringSurveyErrorTarget(errors));
      return false;
    }

    // Ensure latest local text is on the server before finalize.
    await updateEngineeringSurveyDraft(task.id, localFields);

    hostRef.current?.onSavingChange?.(true);
    setFormError(null);
    const outcome = await executeSurveySubmit();
    hostRef.current?.onSavingChange?.(false);

    if (outcome.status === "skipped") return false;

    const result = outcome.value;
    if (result) {
      setDraft(result.submission);
      setLocalFields(localFieldsFromDraft(result.submission));
      if (result.warning) {
        showToast(result.warning, "error");
      }
      hostRef.current?.onSubmitted?.();
      return true;
    }
    const message = "تعذر إرسال الرفع المساحي — حاول مرة أخرى";
    setFormError(message);
    showToast(message, "error");
    return false;
  }, [
    draft,
    localFields,
    locked,
    viewOnly,
    flushPendingPersist,
    documentaryGate,
    role,
    property,
    property?.contacts,
    task.id,
    hostRef,
    setDraft,
    setFieldErrors,
    setFormError,
    setLocalFields,
    showToast,
    executeSurveySubmit,
  ]);

  useEffect(() => {
    if (!hostRef.current) return;
    hostRef.current.submit = submit;
  }, [hostRef, submit]);

  const handleCoordsChange = useCallback(
    (lat: string, lng: string) => {
      setLocalFields((prev) =>
        prev ? { ...prev, latitude: lat, longitude: lng } : prev,
      );
      schedulePersist({ latitude: lat, longitude: lng });
      setFieldErrors((prev) =>
        withoutFieldErrors(prev, ["latitude", "longitude"]),
      );
    },
    [schedulePersist, setFieldErrors, setLocalFields],
  );

  const handleChecklistChange = useCallback(
    (checklist: EngineeringSurveySubmission["checklist"]) => {
      const prevAnswers = checklistAnswerSignature(draftRef.current?.checklist);
      const nextAnswers = checklistAnswerSignature(checklist);
      setDraft((prev) => (prev ? { ...prev, checklist } : prev));
      schedulePersist({ checklist });
      if (prevAnswers !== nextAnswers) {
        void syncCaseStudyFromChecklist(checklist);
      }
      setFieldErrors((prev) => withoutFieldErrors(prev, ["checklist"]));
    },
    [
      draftRef,
      schedulePersist,
      setDraft,
      setFieldErrors,
      syncCaseStudyFromChecklist,
    ],
  );

  function onFilePick(field: SurveyAttachmentField, file: File | null) {
    if (!file || formDisabled || !draft) return;
    const { docField, errorKey } = surveyAttachmentTarget(field);

    void runWithUploadToast(async () => {
      const result = await cacheEngineeringSurveyFile(
        draft.taskId,
        docField,
        file,
      );
      if (!result.ok) {
        setFormError(result.error);
        throw new Error(result.error);
      }
      const next = loadEngineeringSurveySubmission(draft.taskId);
      if (next) applyRemoteDraft(next);
      setFieldErrors((prev) => withoutFieldErrors(prev, [errorKey]));
    });
  }

  function onFileClear(field: SurveyAttachmentField) {
    if (!draft || formDisabled) return;
    const { docField } = surveyAttachmentTarget(field);
    void clearEngineeringSurveyFile(draft.taskId, docField).then((cleared) => {
      if (!cleared) {
        showToast("تعذّر حذف المرفق — حاول مرة أخرى", "error");
        return;
      }
      const next = loadEngineeringSurveySubmission(draft.taskId);
      if (next) applyRemoteDraft(next);
    });
  }

  return {
    handleStartSurvey,
    patchLocalField,
    saveNote,
    submit,
    handleCoordsChange,
    handleChecklistChange,
    onFilePick,
    onFileClear,
  };
}

export type EngineeringSurveyCommands = ReturnType<
  typeof useEngineeringSurveyCommands
>;

/** The composed bag the work panel and its body read from. */
export type EngineeringSurveyWorkflow = EngineeringSurveyData &
  EngineeringSurveyCommands;
