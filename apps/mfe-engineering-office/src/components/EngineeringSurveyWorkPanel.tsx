"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { InlineLoadingSkeleton, Spinner, cn, useToast } from "@platform/design-system";
import type { PartyTaskPageDef } from "@platform/app-shared/prototype/party-task-pages";
import type { WorkflowTask } from "@case-study/mfe";
import { activeSurveyEntryPath } from "@case-study/mfe/lib/my-task-routes";
import {
  emptyCaseStudyFormDraft,
  loadPartyCaseStudyFormDraft,
  savePartyCaseStudyFormDraft,
} from "@case-study/mfe";
import {
  surveyWorkGate,
  declarationPhoneGate,
  hasAnyPartyPhone,
} from "@case-study/mfe/lib/prototype/documentary-workflow-gates";
import { usePrototype } from "@platform/app-shared/contexts/PrototypeContext";
import {
  usePoRecordQuery,
  useWorkflowTasksQuery,
} from "@case-study/mfe/query/case-study-queries";
import { useInspectorFeesQuery } from "@case-study/mfe/query/inspector-fees-queries";
import {
  FailureRaisePanel,
  blockingFailureForProperty,
  failureRecordTitle,
} from "@failures/mfe";
import { failureRaiserRoleForParty } from "@failures/mfe/lib/failure-party-roles";
import { useFailuresQuery } from "@failures/mfe/query/failures-queries";
import { isActiveFailureStatus } from "@failures/mfe/lib/failures-types";
import {
  createEngineeringSurveyDraft,
  isEngineeringSurveyFormLocked,
  type EngineeringSurveySubmission,
} from "../lib/engineering-survey-data";
import {
  fetchEngineeringSurveySubmission,
  getOrCreateEngineeringSurveyDraft,
  loadEngineeringSurveySubmission,
  updateEngineeringSurveyDraft,
} from "../lib/engineering-survey-submission-storage";
import {
  cacheEngineeringSurveyFile,
  clearEngineeringSurveyFile,
} from "../lib/engineering-survey-attachments";
import {
  firstEngineeringSurveyError,
  validateEngineeringSurveySubmission,
  type EngineeringSurveyFieldErrors,
} from "../lib/engineering-survey-validation";
import { finalizeEngineeringSurveySubmission } from "../lib/finalize-engineering-survey-submission";
import type { EngineeringSurveyWindowHostRefObject } from "../lib/engineering-survey-window-host";
import { EngineeringSurveyChecklist } from "./EngineeringSurveyChecklist";
import { EngineeringSurveyMap } from "./EngineeringSurveyMap";
import { EngineeringSurveyPropertySummary } from "./EngineeringSurveyPropertySummary";
import {
  applyChecklistToCaseStudyAnswers,
  caseStudyAnswersChanged,
} from "../lib/engineering-survey-checklist-sync";
import { QuickActionsFab } from "./QuickActionsFab";
import { usePartyTaskRecallRequest } from "@case-study/mfe/hooks/use-party-task-recall-request";
import { usePartyTaskRecallEligibility } from "@case-study/mfe/hooks/use-party-task-recall-eligibility";
import { isEngineeringSurveyTransactionActive } from "../lib/engineering-survey-transaction-active";
import {
  EngField,
  EngInfo,
  EngSection,
  EngStatusPill,
  EngTabBar,
  EngUploadBox,
  ENG_STATUS_COLORS,
  engCardClassName,
  engChipClassName,
  engInputClassName,
  engLabelClassName,
  engPpHeadClassName,
  engPrimaryBtnClassName,
} from "./EngineeringSurveyHtmlPrimitives";

type WorkTab = "property" | "survey" | "fees" | "notes" | "failures";

type LocalTextFields = {
  latitude: string;
  longitude: string;
  onSiteAreaSqm: string;
  northBoundary: string;
  northBoundaryLengthM: string;
  southBoundary: string;
  southBoundaryLengthM: string;
  eastBoundary: string;
  eastBoundaryLengthM: string;
  westBoundary: string;
  westBoundaryLengthM: string;
  surveyNotes: string;
};

function localFieldsFromDraft(
  draft: EngineeringSurveySubmission,
): LocalTextFields {
  return {
    latitude: draft.latitude,
    longitude: draft.longitude,
    onSiteAreaSqm: draft.onSiteAreaSqm,
    northBoundary: draft.northBoundary,
    northBoundaryLengthM: draft.northBoundaryLengthM,
    southBoundary: draft.southBoundary,
    southBoundaryLengthM: draft.southBoundaryLengthM,
    eastBoundary: draft.eastBoundary,
    eastBoundaryLengthM: draft.eastBoundaryLengthM,
    westBoundary: draft.westBoundary,
    westBoundaryLengthM: draft.westBoundaryLengthM,
    surveyNotes: draft.surveyNotes,
  };
}

export function EngineeringSurveyWorkPanel({
  def,
  childTask: task,
  hostRef,
  deedNumber,
  onFailureSubmitted,
  variant = "workspace",
  forceReadOnly = false,
}: {
  def: PartyTaskPageDef;
  childTask: WorkflowTask;
  hostRef: EngineeringSurveyWindowHostRefObject;
  deedNumber: string;
  onBack?: () => void;
  onFailureSubmitted?: () => void;
  variant?: "workspace" | "entry";
  forceReadOnly?: boolean;
}) {
  const router = useRouter();
  const { role } = usePrototype();
  const viewOnly = variant === "workspace";
  const propertyId = task.propertyId ?? "";
  const { showToast, runWithUploadToast } = useToast();
  const { data: record } = usePoRecordQuery(task.poNumber);
  const property = record?.properties.find((p) => p.id === propertyId);
  const { data: failures = [] } = useFailuresQuery();
  const { data: workflowTasks = [] } = useWorkflowTasksQuery();
  const { data: feesSummary } = useInspectorFeesQuery({
    workflowTaskId: task.id,
    submittedOnly: false,
  });

  const feeForTask = useMemo(() => {
    const rows = feesSummary?.rows ?? [];
    return rows.find((r) => r.workflowTaskId === task.id) ?? null;
  }, [feesSummary?.rows, task.id]);

  const activeFailureCount = useMemo(() => {
    if (!propertyId) return 0;
    return failures.filter(
      (f) =>
        f.poNumber === task.poNumber &&
        f.propertyId === propertyId &&
        isActiveFailureStatus(f.status),
    ).length;
  }, [failures, propertyId, task.poNumber]);

  const blockingFailure = useMemo(() => {
    if (!propertyId) return null;
    return blockingFailureForProperty(failures, {
      poNumber: task.poNumber,
      propertyId,
      deedNumber,
    });
  }, [deedNumber, failures, propertyId, task.poNumber]);

  const documentaryGate = useMemo(
    () =>
      surveyWorkGate({
        role,
        surveyTask: task,
        tasks: workflowTasks,
        hasActiveFailure: Boolean(blockingFailure) || activeFailureCount > 0,
        planNumber: property?.planNumber,
        plotNumber: property?.plotNumber,
        locationMapUrl: property?.locationMapUrl,
      }),
    [
      activeFailureCount,
      blockingFailure,
      property?.locationMapUrl,
      property?.planNumber,
      property?.plotNumber,
      role,
      task,
      workflowTasks,
    ],
  );

  const [draft, setDraft] = useState<EngineeringSurveySubmission | null>(null);
  const [localFields, setLocalFields] = useState<LocalTextFields | null>(null);
  const [workTab, setWorkTab] = useState<WorkTab>("survey");
  const [fieldErrors, setFieldErrors] = useState<EngineeringSurveyFieldErrors>(
    {},
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [failureRaiseOpen, setFailureRaiseOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingLocal, setSavingLocal] = useState(false);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatchRef = useRef<Parameters<
    typeof updateEngineeringSurveyDraft
  >[1]>({});

  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;
    const readOnly = forceReadOnly || viewOnly;
    const load = readOnly
      ? fetchEngineeringSurveySubmission(task.id).then(
          (existing) =>
            existing ??
            createEngineeringSurveyDraft({
              taskId: task.id,
              propertyId,
              poNumber: task.poNumber,
            }),
        )
      : getOrCreateEngineeringSurveyDraft({
          taskId: task.id,
          propertyId,
          poNumber: task.poNumber,
        });
    void load
      .then((loaded) => {
        if (cancelled) return;
        setDraft(loaded);
        setLocalFields(localFieldsFromDraft(loaded));
        setNoteDraft(loaded.transactionNote ?? "");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setFormError(
          err instanceof Error ? err.message : "تعذّر تحميل مسودة الرفع المساحي",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [task.id, task.poNumber, propertyId, forceReadOnly, viewOnly]);

  const locked =
    (draft ? isEngineeringSurveyFormLocked(draft.status) : false) ||
    forceReadOnly ||
    task.status === "completed";
  const formDisabled = locked || viewOnly || !documentaryGate.ready;
  const recallEligible = usePartyTaskRecallEligibility(task);
  const transactionActive = useMemo(
    () => isEngineeringSurveyTransactionActive(task.status, draft?.status),
    [draft?.status, task.status],
  );
  const notesEditable = !locked && !viewOnly && documentaryGate.ready;
  const savedNote = draft?.transactionNote?.trim() ?? "";

  useEffect(() => {
    if (workTab !== "failures") setFailureRaiseOpen(false);
  }, [workTab]);

  const openFailuresTab = useCallback(() => {
    setWorkTab("failures");
    setFailureRaiseOpen(true);
    showToast("سجّل وصف التعذر في النموذج أدناه", "info");
  }, [showToast]);

  const openNotesTab = useCallback(() => {
    setWorkTab("notes");
  }, []);

  const handleStartSurvey = useCallback(() => {
    if (!transactionActive) {
      showToast(
        "تم إرسال الرفع المساحي لهذا العقار. استخدم «طلب استرجاع المعاملة» لإعادة فتح العمل.",
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
    showToast,
    task.id,
    transactionActive,
    viewOnly,
  ]);

  const handleAddObstruction = useCallback(() => {
    if (!transactionActive) {
      showToast("لا يمكن تسجيل تعذر بعد إرسال المعاملة.", "info");
      return;
    }
    openFailuresTab();
  }, [openFailuresTab, showToast, transactionActive]);

  const handleAddNote = useCallback(() => {
    if (!transactionActive) {
      showToast("لا يمكن إضافة ملاحظة بعد إرسال المعاملة.", "info");
      return;
    }
    openNotesTab();
  }, [openNotesTab, showToast, transactionActive]);

  const handleRequestRecall = usePartyTaskRecallRequest({
    taskId: task.id,
    poNumber: task.poNumber,
    propertyId,
    isSubmitted: recallEligible,
    notSubmittedMessage: "لا يمكن طلب الاسترجاع قبل إرسال الرفع المساحي",
  });

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

  const persist = useCallback(
    (patch: Parameters<typeof updateEngineeringSurveyDraft>[1]) => {
      if (!task.id) return;
      void updateEngineeringSurveyDraft(task.id, patch)
        .then((next) => {
          if (!next) return;
          setDraft(next);
          // Keep local text fields unless this patch came from file/checklist locks.
        })
        .catch((err: unknown) => {
          showToast(
            err instanceof Error
              ? err.message
              : "تعذّر حفظ الرفع المساحي — حاول مرة أخرى",
            "error",
          );
        });
    },
    [task.id, showToast],
  );

  const flushPendingPersist = useCallback(async () => {
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    const patch = pendingPatchRef.current;
    pendingPatchRef.current = {};
    if (!task.id || Object.keys(patch).length === 0) return;
    try {
      const next = await updateEngineeringSurveyDraft(task.id, patch);
      if (next) setDraft(next);
    } catch (err: unknown) {
      showToast(
        err instanceof Error
          ? err.message
          : "تعذّر حفظ الرفع المساحي — حاول مرة أخرى",
        "error",
      );
    }
  }, [showToast, task.id]);

  const schedulePersist = useCallback(
    (patch: Parameters<typeof updateEngineeringSurveyDraft>[1]) => {
      pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      persistTimerRef.current = setTimeout(() => {
        void flushPendingPersist();
      }, 350);
    },
    [flushPendingPersist],
  );

  const patchLocalField = useCallback(
    <K extends keyof LocalTextFields>(key: K, value: LocalTextFields[K]) => {
      setLocalFields((prev) => (prev ? { ...prev, [key]: value } : prev));
      schedulePersist({ [key]: value } as Parameters<
        typeof updateEngineeringSurveyDraft
      >[1]);
      if (key === "latitude" || key === "longitude" || key === "onSiteAreaSqm") {
        setFieldErrors((prev) => {
          const next = { ...prev };
          if (key === "latitude") delete next.latitude;
          if (key === "longitude") delete next.longitude;
          if (key === "onSiteAreaSqm") delete next.on_site_area;
          return next;
        });
      }
    },
    [schedulePersist],
  );

  const saveNote = useCallback(() => {
    if (!notesEditable) return;
    persist({ transactionNote: noteDraft });
    setDraft((prev) =>
      prev ? { ...prev, transactionNote: noteDraft } : prev,
    );
    showToast("تم حفظ الملاحظة", "success");
  }, [noteDraft, notesEditable, persist, showToast]);

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!draft || locked || viewOnly) return;
    void syncCaseStudyFromChecklist(draft.checklist);
  }, [draft, locked, syncCaseStudyFromChecklist, viewOnly]);

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
    const errors = validateEngineeringSurveySubmission(merged);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      const message = firstEngineeringSurveyError(errors);
      setFormError(message);
      showToast(message, "error");
      return false;
    }

    // Ensure latest local text is on the server before finalize.
    await updateEngineeringSurveyDraft(task.id, localFields);

    hostRef.current?.onSavingChange?.(true);
    setFormError(null);
    const result = await finalizeEngineeringSurveySubmission(task.id);
    hostRef.current?.onSavingChange?.(false);

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
    property?.contacts,
    task.id,
    hostRef,
    showToast,
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
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.latitude;
        delete next.longitude;
        return next;
      });
    },
    [schedulePersist],
  );

  function onFilePick(
    field: "surveyReportFileName" | "siteLetterFileName",
    file: File | null,
  ) {
    if (!file || formDisabled || !draft) return;
    const docField =
      field === "surveyReportFileName" ? "surveyReport" : "siteLetter";
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
      if (next) setDraft(next);
      setFieldErrors((prev) => {
        const nextErrors = { ...prev };
        delete nextErrors[
          field === "surveyReportFileName" ? "survey_report" : "site_letter"
        ];
        return nextErrors;
      });
    });
  }

  function onFileClear(field: "surveyReportFileName" | "siteLetterFileName") {
    if (!draft || formDisabled) return;
    const docField =
      field === "surveyReportFileName" ? "surveyReport" : "siteLetter";
    void clearEngineeringSurveyFile(draft.taskId, docField).then((cleared) => {
      if (!cleared) {
        showToast("تعذّر حذف المرفق — حاول مرة أخرى", "error");
        return;
      }
      const next = loadEngineeringSurveySubmission(draft.taskId);
      if (next) setDraft(next);
    });
  }

  if (!draft || !localFields) {
    return <InlineLoadingSkeleton className="my-2" />;
  }

  const statusPill =
    task.status === "completed" ? (
      <EngStatusPill label="مكتمل" color={ENG_STATUS_COLORS.completed} />
    ) : locked ? (
      <EngStatusPill label="مُرسل" color={ENG_STATUS_COLORS.submitted} />
    ) : draft.status === "reopened" ? (
      <EngStatusPill label="مُعاد للتصحيح" color={ENG_STATUS_COLORS.reopened} />
    ) : (
      <EngStatusPill label="مسودة" color={ENG_STATUS_COLORS.draft} />
    );

  const surveyBody = (
    <>
      {draft.status === "reopened" && draft.returnNote ? (
        <EngInfo variant="amber">
          <strong>⚠ تم إعادة الرفع المساحي — يرجى المراجعة والتصحيح.</strong>
          <br />
          {draft.returnNote}
        </EngInfo>
      ) : null}

      {formError ? (
        <EngInfo variant="red">
          <strong>!</strong> {formError}
        </EngInfo>
      ) : null}

      {locked ? (
        <EngInfo variant="amber">
          تم إرسال الرفع المساحي لهذا العقار. استخدم «طلب استرجاع المعاملة»
          لإعادة فتح العمل.
        </EngInfo>
      ) : null}

      <EngSection>موقع العقار الميداني</EngSection>
      {!formDisabled ? (
        <EngInfo>
          ℹ يُستخدم الموقع للتحقق من زيارة المكتب الهندسي. يجب أن تتطابق
          الإحداثيات مع موقع العقار الفعلي.
        </EngInfo>
      ) : null}
      <div className="mb-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div>
          <label className={engLabelClassName} htmlFor="eng-lat">
            خط العرض (Latitude) *
          </label>
          <input
            id="eng-lat"
            dir="ltr"
            className={cn(
              engInputClassName,
              fieldErrors.latitude && "!border-[#c0553d]",
            )}
            disabled={formDisabled}
            value={localFields.latitude}
            onChange={(e) => patchLocalField("latitude", e.target.value)}
          />
          {fieldErrors.latitude ? (
            <p className="mt-1 text-[11px] text-[#a5432e]">
              {fieldErrors.latitude}
            </p>
          ) : null}
        </div>
        <div>
          <label className={engLabelClassName} htmlFor="eng-lng">
            خط الطول (Longitude) *
          </label>
          <input
            id="eng-lng"
            dir="ltr"
            className={cn(
              engInputClassName,
              fieldErrors.longitude && "!border-[#c0553d]",
            )}
            disabled={formDisabled}
            value={localFields.longitude}
            onChange={(e) => patchLocalField("longitude", e.target.value)}
          />
          {fieldErrors.longitude ? (
            <p className="mt-1 text-[11px] text-[#a5432e]">
              {fieldErrors.longitude}
            </p>
          ) : null}
        </div>
      </div>
      <EngineeringSurveyMap
        latitude={localFields.latitude}
        longitude={localFields.longitude}
        disabled={formDisabled}
        onCoordsChange={handleCoordsChange}
      />

      <EngSection>الحدود والأطوال (إنفاذ)</EngSection>
      <div className="mb-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div>
          <label className={engLabelClassName} htmlFor="eng-on-site-area">
            المساحة على الطبيعة (م²)
          </label>
          <input
            id="eng-on-site-area"
            inputMode="decimal"
            className={cn(
              engInputClassName,
              fieldErrors.on_site_area && "!border-[#c0553d]",
            )}
            disabled={formDisabled}
            value={localFields.onSiteAreaSqm}
            onChange={(e) => patchLocalField("onSiteAreaSqm", e.target.value)}
          />
          {fieldErrors.on_site_area ? (
            <p className="mt-1 text-[11px] text-[#a5432e]">
              {fieldErrors.on_site_area}
            </p>
          ) : null}
        </div>
      </div>

      {(
        [
          [
            "northBoundary",
            "northBoundaryLengthM",
            "الحد الشمالي",
            "طول الحد الشمالي التقريبي (م)",
          ],
          [
            "southBoundary",
            "southBoundaryLengthM",
            "الحد الجنوبي",
            "طول الحد الجنوبي التقريبي (م)",
          ],
          [
            "eastBoundary",
            "eastBoundaryLengthM",
            "الحد الشرقي",
            "طول الحد الشرقي التقريبي (م)",
          ],
          [
            "westBoundary",
            "westBoundaryLengthM",
            "الحد الغربي",
            "طول الحد الغربي التقريبي (م)",
          ],
        ] as const
      ).map(([boundKey, lenKey, boundLabel, lenLabel]) => (
        <div
          key={boundKey}
          className="mb-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2"
        >
          <div>
            <label className={engLabelClassName} htmlFor={`eng-${boundKey}`}>
              {boundLabel}
            </label>
            <input
              id={`eng-${boundKey}`}
              className={engInputClassName}
              disabled={formDisabled}
              value={localFields[boundKey]}
              onChange={(e) => patchLocalField(boundKey, e.target.value)}
            />
          </div>
          <div>
            <label className={engLabelClassName} htmlFor={`eng-${lenKey}`}>
              {lenLabel}
            </label>
            <input
              id={`eng-${lenKey}`}
              inputMode="decimal"
              className={engInputClassName}
              disabled={formDisabled}
              value={localFields[lenKey]}
              onChange={(e) => patchLocalField(lenKey, e.target.value)}
            />
          </div>
        </div>
      ))}

      <div className="mb-1">
        <label className={engLabelClassName} htmlFor="eng-survey-notes">
          ملاحظات الرفع المساحي
        </label>
        <textarea
          id="eng-survey-notes"
          rows={3}
          className={cn(engInputClassName, "resize-y")}
          disabled={formDisabled}
          value={localFields.surveyNotes}
          onChange={(e) => patchLocalField("surveyNotes", e.target.value)}
        />
      </div>

      <EngSection>التقرير المساحي</EngSection>
      <EngUploadBox
        title="رفع التقرير المساحي"
        hint="PDF — الحجم الأقصى 20 ميجابايت"
        fileName={draft.surveyReportFileName}
        disabled={formDisabled}
        error={fieldErrors.survey_report}
        onPick={(file) => onFilePick("surveyReportFileName", file)}
        onClear={() => onFileClear("surveyReportFileName")}
      />

      <EngSection>خطاب إقرار صحة الموقع</EngSection>
      <EngUploadBox
        title="رفع خطاب الإقرار"
        hint="PDF — الحجم الأقصى 10 ميجابايت"
        fileName={draft.siteLetterFileName}
        disabled={formDisabled}
        error={fieldErrors.site_letter}
        onPick={(file) => onFilePick("siteLetterFileName", file)}
        onClear={() => onFileClear("siteLetterFileName")}
      />

      {formDisabled ? (
        <div className="mt-3 rounded-lg border border-[#fad7a0] bg-[#fef3d7] px-3 py-2.5 text-[11.5px] leading-[1.7] text-[#7a5b12]">
          {draft.siteConfirmed
            ? "✓ تم الإقرار بأن المكتب الهندسي تحقق ميدانياً وأن بيانات التقرير المساحي صحيحة ودقيقة."
            : "لم يتم الإقرار بعد بصحة الموقع."}
        </div>
      ) : (
        <label className="mt-3 flex cursor-pointer items-start gap-[9px] rounded-lg border border-[#fad7a0] bg-[#fef3d7] px-3 py-2.5 text-[11.5px] leading-[1.7] text-[#7a5b12]">
          <input
            type="checkbox"
            className="mt-0.5 accent-[var(--gold-d)]"
            checked={draft.siteConfirmed}
            onChange={(e) => {
              persist({ siteConfirmed: e.target.checked });
              setFieldErrors((prev) => {
                const next = { ...prev };
                delete next.site_confirmed;
                return next;
              });
            }}
          />
          <span>
            أُقرّ بأن المكتب الهندسي تحقق ميدانياً وأن بيانات التقرير المساحي
            المرفوع <strong>صحيحة ودقيقة</strong>.
          </span>
        </label>
      )}
      {fieldErrors.site_confirmed ? (
        <p className="mt-1 text-[11px] text-[#a5432e]">
          {fieldErrors.site_confirmed}
        </p>
      ) : null}

      <EngSection>نموذج التحقق الميداني — 13 بنداً</EngSection>
      <EngineeringSurveyChecklist
        rows={draft.checklist}
        disabled={formDisabled}
        onChange={(checklist) => {
          persist({ checklist });
          void syncCaseStudyFromChecklist(checklist);
          setFieldErrors((prev) => {
            const next = { ...prev };
            delete next.checklist;
            return next;
          });
        }}
      />
      {fieldErrors.checklist ? (
        <p className="mt-1 text-[11px] text-[#a5432e]">{fieldErrors.checklist}</p>
      ) : null}

      {!formDisabled ? (
        <div className="mt-[18px] flex justify-start">
          <button
            type="button"
            className={engPrimaryBtnClassName}
            disabled={savingLocal}
            aria-busy={savingLocal || undefined}
            onClick={() => {
              void (async () => {
                setSavingLocal(true);
                try {
                  await submit();
                } finally {
                  setSavingLocal(false);
                }
              })();
            }}
          >
            {savingLocal ? <Spinner /> : null}
            <span>
              {savingLocal ? "جاري الإرسال…" : "إرسال الرفع المساحي"}
            </span>
          </button>
        </div>
      ) : null}
    </>
  );

  const feeAmountLabel = feeForTask
    ? `${Number(feeForTask.netFeeSar ?? 0).toLocaleString("ar-SA")} ر.س`
    : "—";

  return (
    <>
      <div className="mx-auto w-full max-w-[1100px]">
        <div className={engPpHeadClassName}>
          <h1 className="m-0 flex flex-wrap items-center gap-2.5 text-[18px] font-extrabold leading-tight text-heading">
            <span>مساحة عمل الرفع المساحي</span>
            <span className="text-[14px] font-bold text-gold-d [direction:ltr]">
              صك {deedNumber}
            </span>
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className={engChipClassName}>
              {task.assigneeName?.trim() || def.assigneeSubtitle || "المكتب الهندسي"}
            </span>
            {statusPill}
            {viewOnly ? (
              <EngStatusPill label="استعراض" color={ENG_STATUS_COLORS.view} />
            ) : null}
          </div>
        </div>

        <div className={engCardClassName}>
          <EngTabBar
            active={workTab}
            onChange={(id) => setWorkTab(id as WorkTab)}
            tabs={[
              { id: "property", label: "بيانات العقار" },
              { id: "survey", label: "الرفع المساحي" },
              { id: "fees", label: "مالية المعاملة" },
              { id: "notes", label: "ملاحظة", dot: Boolean(savedNote) },
              {
                id: "failures",
                label: "التعذرات",
                badge: activeFailureCount,
              },
            ]}
          />

          {!documentaryGate.ready ? (
            <div className="mb-3.5 rounded-lg border border-[#fad7a0] bg-[#fef3d7] px-3 py-2.5 text-[11.5px] leading-[1.7] text-[#7a5b12]">
              <strong>⚠ الرفع مجمّد ولا يُحتسب الوقت:</strong>{" "}
              {documentaryGate.reason}
            </div>
          ) : null}

          {viewOnly && documentaryGate.ready ? (
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#fad7a0] bg-[#fef3d7] px-3 py-2.5 text-[11.5px] leading-[1.7] text-[#7a5b12]">
              <span>
                👁 وضع الاستعراض — جميع الحقول للقراءة فقط.
                {locked ? "" : " للتعديل ابدأ عملية الرفع."}
              </span>
              {!locked ? (
                <button
                  type="button"
                  className={cn(engPrimaryBtnClassName, "!px-3.5 !py-1.5 !text-[11.5px]")}
                  onClick={handleStartSurvey}
                >
                  بدء الرفع المساحي
                </button>
              ) : null}
            </div>
          ) : null}

          <div
            className={cn(
              formDisabled &&
                workTab !== "property" &&
                workTab !== "fees" &&
                "pointer-events-none select-none opacity-75",
              locked &&
                workTab === "survey" &&
                "rounded-[10px] bg-[#F1F5F9] p-3 grayscale-[0.35]",
            )}
          >
            {workTab === "property" ? (
              <EngineeringSurveyPropertySummary
                property={property}
                record={record ?? undefined}
                deedNumber={deedNumber}
              />
            ) : null}

            {workTab === "survey" ? surveyBody : null}

            {workTab === "fees" ? (
              <>
                <EngSection>أتعاب الرفع المساحي</EngSection>
                <div className="mb-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  <EngField label="قيمة الأتعاب" value={feeAmountLabel} />
                  <EngField label="حالة الاستحقاق">
                    {draft.status === "submitted" || locked ? (
                      <EngStatusPill
                        label="مستحقة بعد الإرسال"
                        color={ENG_STATUS_COLORS.submitted}
                      />
                    ) : (
                      <EngStatusPill
                        label="تُستحق عند إرسال الرفع"
                        color={ENG_STATUS_COLORS.pending}
                      />
                    )}
                  </EngField>
                  <EngField label="حالة الدفع">
                    <EngStatusPill
                      label={
                        feeForTask?.billingStatus === "disbursed"
                          ? "صُرفت"
                          : "لم تُصرف"
                      }
                      color={
                        feeForTask?.billingStatus === "disbursed"
                          ? ENG_STATUS_COLORS.submitted
                          : ENG_STATUS_COLORS.unpaid
                      }
                    />
                  </EngField>
                </div>
                <EngInfo>
                  تُستحق أتعاب الرفع المساحي للمكتب الهندسي عند إرسال المعاملة
                  واعتمادها من أخصائي دراسة الحالة.
                </EngInfo>
              </>
            ) : null}

            {workTab === "notes" ? (
              <>
                <EngSection>ملاحظة على المعاملة</EngSection>
                <textarea
                  id="eng-workspace-note"
                  className={cn(engInputClassName, "min-h-[120px] resize-y")}
                  rows={5}
                  disabled={!notesEditable}
                  value={noteDraft}
                  placeholder="اكتب ملاحظتك هنا…"
                  onChange={(e) => setNoteDraft(e.target.value)}
                />
                {notesEditable ? (
                  <div className="mt-3">
                    <button
                      type="button"
                      className={cn(
                        engPrimaryBtnClassName,
                        "!px-[18px] !py-[7px] !text-xs",
                      )}
                      onClick={saveNote}
                    >
                      حفظ الملاحظة
                    </button>
                  </div>
                ) : (
                  <p className="mt-2 text-[11px] text-text-3">
                    {viewOnly
                      ? "وضع الاستعراض — لا يمكن التعديل."
                      : "لا يمكن تعديل الملاحظة بعد إرسال المعاملة أو إغلاقها."}
                  </p>
                )}
              </>
            ) : null}

            {workTab === "failures" && propertyId ? (
              <FailureRaisePanel
                poNumber={task.poNumber}
                propertyId={propertyId}
                deedNumber={deedNumber}
                specialist={task.assigneeName || def.assigneeSubtitle}
                raisedByRole={failureRaiserRoleForParty(def)}
                onSubmitted={onFailureSubmitted}
                autoOpenRaise={failureRaiseOpen}
                raiseDisabled={formDisabled}
                raiseDisabledReason={
                  viewOnly
                    ? "وضع الاستعراض — لا يمكن تسجيل تعذر من هنا."
                    : "لا يمكن تسجيل تعذر بعد إرسال المعاملة."
                }
              />
            ) : null}
          </div>
        </div>
      </div>

      <QuickActionsFab
        placement="bottom-start"
        deedNumber={deedNumber}
        startSurveyDimmed={
          !transactionActive ||
          Boolean(blockingFailure) ||
          !documentaryGate.ready ||
          locked
        }
        workActionsDimmed={!transactionActive || locked}
        recallDimmed={transactionActive || !recallEligible}
        onStartSurvey={handleStartSurvey}
        onAddObstruction={handleAddObstruction}
        onAddNote={handleAddNote}
        onRequestRecall={handleRequestRecall}
      />
    </>
  );
}
