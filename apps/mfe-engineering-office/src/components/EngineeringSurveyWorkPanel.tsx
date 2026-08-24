"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { InlineLoadingSkeleton, Spinner, cn, useToast } from "@platform/ui-kit";
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
import { scheduleScrollToFormField } from "@platform/app-shared/form-ux";
import {
  engineeringInvalidControlClass,
  firstEngineeringSurveyError,
  firstEngineeringSurveyErrorTarget,
  validateEngineeringSurveySubmission,
  type EngineeringSurveyFieldErrors,
} from "../lib/engineering-survey-validation";
import { finalizeEngineeringSurveySubmission } from "../lib/finalize-engineering-survey-submission";
import type { EngineeringSurveyWindowHostRefObject } from "../lib/engineering-survey-window-host";
import {
  extractSurveySketchFromPdf,
  sketchExtractToEmptyFieldsPatch,
  sketchNatureFieldsFromExtract,
  sketchNatureFieldsFromDeedForm,
  applyNatureSketchPatch,
  type SurveySketchExtractResult,
} from "../lib/engineering-survey-sketch-extract";
import { EngineeringSurveyChecklist } from "./EngineeringSurveyChecklist";
import { EngineeringSurveyMap } from "./EngineeringSurveyMap";
import { EngineeringSurveyPropertySummary } from "./EngineeringSurveyPropertySummary";
import {
  applyChecklistToCaseStudyAnswers,
  caseStudyAnswersChanged,
} from "../lib/engineering-survey-checklist-sync";
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
  engInputClassName,
  engLabelClassName,
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
  natureOnSiteAreaSqm: string;
  natureNorthBoundary: string;
  natureNorthBoundaryLengthM: string;
  natureSouthBoundary: string;
  natureSouthBoundaryLengthM: string;
  natureEastBoundary: string;
  natureEastBoundaryLengthM: string;
  natureWestBoundary: string;
  natureWestBoundaryLengthM: string;
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
    natureOnSiteAreaSqm: draft.natureOnSiteAreaSqm ?? "",
    natureNorthBoundary: draft.natureNorthBoundary ?? "",
    natureNorthBoundaryLengthM: draft.natureNorthBoundaryLengthM ?? "",
    natureSouthBoundary: draft.natureSouthBoundary ?? "",
    natureSouthBoundaryLengthM: draft.natureSouthBoundaryLengthM ?? "",
    natureEastBoundary: draft.natureEastBoundary ?? "",
    natureEastBoundaryLengthM: draft.natureEastBoundaryLengthM ?? "",
    natureWestBoundary: draft.natureWestBoundary ?? "",
    natureWestBoundaryLengthM: draft.natureWestBoundaryLengthM ?? "",
    surveyNotes: draft.surveyNotes,
  };
}

const BOUNDARY_ROWS = [
  ["northBoundary", "northBoundaryLengthM", "الحد الشمالي", "طول الحد الشمالي (م)"],
  ["southBoundary", "southBoundaryLengthM", "الحد الجنوبي", "طول الحد الجنوبي (م)"],
  ["eastBoundary", "eastBoundaryLengthM", "الحد الشرقي", "طول الحد الشرقي (م)"],
  ["westBoundary", "westBoundaryLengthM", "الحد الغربي", "طول الحد الغربي (م)"],
] as const;

const NATURE_BOUNDARY_ROWS = [
  [
    "natureNorthBoundary",
    "natureNorthBoundaryLengthM",
    "الحد الشمالي",
    "طول الحد الشمالي (م)",
  ],
  [
    "natureSouthBoundary",
    "natureSouthBoundaryLengthM",
    "الحد الجنوبي",
    "طول الحد الجنوبي (م)",
  ],
  [
    "natureEastBoundary",
    "natureEastBoundaryLengthM",
    "الحد الشرقي",
    "طول الحد الشرقي (م)",
  ],
  [
    "natureWestBoundary",
    "natureWestBoundaryLengthM",
    "الحد الغربي",
    "طول الحد الغربي (م)",
  ],
] as const;

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

  const [draft, setDraft] = useState<EngineeringSurveySubmission | null>(null);
  const [localFields, setLocalFields] = useState<LocalTextFields | null>(null);
  const [workTab, setWorkTab] = useState<WorkTab>("survey");
  const [fieldErrors, setFieldErrors] = useState<EngineeringSurveyFieldErrors>(
    {},
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingLocal, setSavingLocal] = useState(false);
  const [sketchExtractNote, setSketchExtractNote] = useState<string | null>(
    null,
  );
  const [sketchExtracting, setSketchExtracting] = useState(false);
  /** Last croquis length parse — seed nature lengths when مطابقة = لا */
  const [lastSketchExtract, setLastSketchExtract] =
    useState<SurveySketchExtractResult | null>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatchRef = useRef<Parameters<
    typeof updateEngineeringSurveyDraft
  >[1]>({});

  const liveSurveyTask = useMemo(
    () => workflowTasks.find((t) => t.id === task.id) ?? task,
    [task, workflowTasks],
  );

  const documentaryGate = useMemo(
    () =>
      surveyWorkGate({
        role,
        surveyTask: liveSurveyTask,
        tasks: workflowTasks,
        hasActiveFailure: Boolean(blockingFailure) || activeFailureCount > 0,
        fieldInspectionCompleted:
          draft?.fieldInspectionCompleted ??
          liveSurveyTask.fieldInspectionCompleted,
      }),
    [
      activeFailureCount,
      blockingFailure,
      draft?.fieldInspectionCompleted,
      liveSurveyTask,
      role,
      workflowTasks,
    ],
  );

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

  // Refresh inspection-completed flag without discarding in-progress form edits.
  useEffect(() => {
    if (!task.id) return;
    let cancelled = false;
    const refreshGate = () => {
      void fetchEngineeringSurveySubmission(task.id).then((fresh) => {
        if (cancelled || !fresh) return;
        if (typeof fresh.fieldInspectionCompleted !== "boolean") return;
        setDraft((prev) => {
          if (!prev) return prev;
          if (prev.fieldInspectionCompleted === fresh.fieldInspectionCompleted) {
            return prev;
          }
          return {
            ...prev,
            fieldInspectionCompleted: fresh.fieldInspectionCompleted,
          };
        });
      });
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshGate();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refreshGate);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refreshGate);
    };
  }, [task.id]);

  const locked =
    (draft ? isEngineeringSurveyFormLocked(draft.status) : false) ||
    forceReadOnly ||
    task.status === "completed";
  const formDisabled = locked || viewOnly || !documentaryGate.ready;
  const transactionActive = useMemo(
    () => isEngineeringSurveyTransactionActive(task.status, draft?.status),
    [draft?.status, task.status],
  );
  const notesEditable = !locked && !viewOnly && documentaryGate.ready;
  const savedNote = draft?.transactionNote?.trim() ?? "";

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
      if (
        key === "latitude" ||
        key === "longitude" ||
        key === "onSiteAreaSqm" ||
        key === "natureOnSiteAreaSqm"
      ) {
        setFieldErrors((prev) => {
          const next = { ...prev };
          if (key === "latitude") delete next.latitude;
          if (key === "longitude") delete next.longitude;
          if (key === "onSiteAreaSqm") delete next.on_site_area;
          if (key === "natureOnSiteAreaSqm") delete next.nature_on_site_area;
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
      scheduleScrollToFormField(firstEngineeringSurveyErrorTarget(errors));
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
    const isSurveyReport = field === "surveyReportFileName";

    void runWithUploadToast(async () => {
      if (isSurveyReport) {
        setSketchExtracting(true);
        setSketchExtractNote(null);
      }
      try {
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
          delete nextErrors[isSurveyReport ? "survey_report" : "site_letter"];
          return nextErrors;
        });

        if (!isSurveyReport) return;

        // Extraction is best-effort only — never fail the upload after the PDF is saved.
        try {
          // Croquis PDF only — no property/بورصة mix-in
          const extracted = await extractSurveySketchFromPdf(file);
          setLastSketchExtract(extracted);
          const currentFields = localFields ?? localFieldsFromDraft(draft);
          // overwrite=true: re-upload must replace previous lengths
          const { patch, appliedCount } = sketchExtractToEmptyFieldsPatch(
            extracted,
            {
              ...currentFields,
              deedMatchesNature: draft.deedMatchesNature,
            },
            true,
          );

          const lengthFilled = [
            extracted.deed.north.lengthM,
            extracted.deed.south.lengthM,
            extracted.deed.east.lengthM,
            extracted.deed.west.lengthM,
          ].filter(Boolean).length;

          if (appliedCount > 0) {
            const { deedMatchesNature, ...textPatch } = patch;
            if (Object.keys(textPatch).length > 0) {
              setLocalFields((prev) => ({
                ...(prev ?? localFieldsFromDraft(draft)),
                ...textPatch,
              }));
              schedulePersist(textPatch);
            }
            if (deedMatchesNature != null) {
              const saved = await updateEngineeringSurveyDraft(draft.taskId, {
                deedMatchesNature,
              });
              if (saved) setDraft(saved);
            }
            setFieldErrors((prev) => {
              const nextErrors = { ...prev };
              delete nextErrors.on_site_area;
              delete nextErrors.nature_on_site_area;
              delete nextErrors.deed_matches_nature;
              return nextErrors;
            });
          }

          const msg =
            extracted.warning ??
            (lengthFilled > 0
              ? `تُعبّأت ${lengthFilled} أطوال. وصف الحد يدوياً — المساحة يدوية.`
              : "تم رفع التقرير. لم تُقرأ أرقام أطوال — عبّئ الحدود والأطوال يدوياً.");

          setSketchExtractNote(msg);
          showToast(
            lengthFilled > 0
              ? `أطوال: ${lengthFilled}/4 · وصف الحد يدوياً · المساحة يدوياً`
              : "تم رفع التقرير — الأطوال ووصف الحد يدوياً",
            lengthFilled === 0 ? "info" : "success",
          );
        } catch (extractErr) {
          console.error("[survey-sketch-extract]", extractErr);
          const detail =
            extractErr instanceof Error
              ? extractErr.message
              : "تعذّر الاستخراج التلقائي";
          setSketchExtractNote(
            `تم رفع التقرير. ${detail} — عبّئ الأطوال ووصف الحد يدوياً.`,
          );
          showToast("تم رفع التقرير — راجع الحدود يدوياً", "info");
        }
      } catch (err) {
        // Actual upload/cache failure — surface to runWithUploadToast
        if (isSurveyReport) {
          setSketchExtractNote(null);
        }
        throw err;
      } finally {
        if (isSurveyReport) setSketchExtracting(false);
      }
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
      if (field === "surveyReportFileName") setSketchExtractNote(null);
    });
  }

  if (!draft || !localFields) {
    return <InlineLoadingSkeleton className="my-2" />;
  }

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
              fieldErrors.latitude && engineeringInvalidControlClass,
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
              fieldErrors.longitude && engineeringInvalidControlClass,
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

      <EngSection>التقرير المساحي</EngSection>
      {!formDisabled ? (
        <EngInfo>
          ℹ بعد الرفع: تُعبَّأ **أطوال الحدود فقط** (الأرقام) عند توفرها في التقرير.
          «وصف الحد» والمساحة يدوية.
        </EngInfo>
      ) : null}
      <EngUploadBox
        id="eng-survey-report"
        title="رفع التقرير المساحي"
        hint="PDF — الحجم الأقصى 20 ميجابايت"
        fileName={draft.surveyReportFileName}
        disabled={formDisabled || sketchExtracting}
        error={fieldErrors.survey_report}
        onPick={(file) => onFilePick("surveyReportFileName", file)}
        onClear={() => onFileClear("surveyReportFileName")}
      />
      {sketchExtracting ? (
        <div
          className="mt-2 mb-3 flex items-center gap-2.5 rounded-[10px] border border-[color-mix(in_srgb,var(--gold)_28%,transparent)] bg-[color-mix(in_srgb,var(--gold)_8%,transparent)] px-3.5 py-3 text-[12.5px] font-semibold text-text-2"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <Spinner className="size-4 border-gold-d border-e-transparent text-gold-d" />
          <span>جارٍ قراءة أطوال الحدود من التقرير…</span>
        </div>
      ) : null}
      {sketchExtractNote && !sketchExtracting ? (
        <EngInfo variant="amber">{sketchExtractNote}</EngInfo>
      ) : null}

      <EngSection>الحدود والأطوال (حسب الصك)</EngSection>
      <div className="mb-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div>
          <label className={engLabelClassName} htmlFor="eng-on-site-area">
            المساحة الإجمالية
          </label>
          <input
            id="eng-on-site-area"
            inputMode="decimal"
            className={cn(
              engInputClassName,
              fieldErrors.on_site_area && engineeringInvalidControlClass,
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

      {BOUNDARY_ROWS.map(([boundKey, lenKey, boundLabel, lenLabel]) => (
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

      <EngSection>مطابقة الصك للطبيعة</EngSection>
      <div
        id="eng-deed-matches"
        className={cn(
          "mb-3 rounded-lg",
          fieldErrors.deed_matches_nature && engineeringInvalidControlClass,
        )}
      >
        <p className={cn(engLabelClassName, "mb-2")}>هل الصك مطابق للطبيعة؟</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { value: "yes" as const, label: "نعم" },
              { value: "no" as const, label: "لا" },
            ] as const
          ).map((opt) => {
            const selected = draft.deedMatchesNature === opt.value;
            return (
              <label
                key={opt.value}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px] font-semibold transition-colors",
                  selected
                    ? "border-ink bg-ink text-white"
                    : "border-border bg-surface-2 text-text-2 hover:border-border-md",
                  formDisabled && "pointer-events-none opacity-70",
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  disabled={formDisabled}
                  checked={selected}
                  onChange={() => {
                    const next =
                      draft.deedMatchesNature === opt.value ? null : opt.value;
                    void updateEngineeringSurveyDraft(task.id, {
                      deedMatchesNature: next,
                    }).then((saved) => {
                      if (saved) setDraft(saved);
                    });
                    setFieldErrors((prev) => {
                      if (!prev.deed_matches_nature) return prev;
                      const { deed_matches_nature: _, ...rest } = prev;
                      return rest;
                    });

                    // عند «لا»: عبّئ أوصاف/أطوال الطبيعة من الكروكي (بدون مساحة)
                    if (next === "no" && localFields) {
                      const fromExtract = lastSketchExtract
                        ? sketchNatureFieldsFromExtract(lastSketchExtract)
                        : sketchNatureFieldsFromDeedForm(localFields);

                      const { patch: naturePatch, appliedCount: natureN } =
                        applyNatureSketchPatch(fromExtract, localFields, true);
                      if (natureN > 0) {
                        setLocalFields((prev) =>
                          prev ? { ...prev, ...naturePatch } : prev,
                        );
                        schedulePersist(naturePatch);
                        setSketchExtractNote(
                          `تم تعبئة ${natureN} حقلاً حسب الطبيعة — المساحة الإجمالية يدوياً.`,
                        );
                        showToast(
                          `طبيعة: ${natureN} حقل · المساحة يدوياً`,
                          "success",
                        );
                      }
                    }
                  }}
                />
                <span
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded border text-[10px]",
                    selected
                      ? "border-white bg-white text-ink"
                      : "border-border-md bg-surface",
                  )}
                  aria-hidden
                >
                  {selected ? "✓" : ""}
                </span>
                {opt.label}
              </label>
            );
          })}
        </div>
        {fieldErrors.deed_matches_nature ? (
          <p className="mt-1.5 text-[11px] text-[#a5432e]">
            {fieldErrors.deed_matches_nature}
          </p>
        ) : (
          <p className="mt-1.5 text-[11px] text-text-3">
            نعم: تُعتمد الحدود حسب الصك أعلاه · لا: تُفتح حقول الطبيعة وتُعبَّأ
            تلقائياً من الكروكي عند الإمكان
          </p>
        )}
      </div>

      {draft.deedMatchesNature === "no" ? (
        <>
          <EngSection>الحدود والأطوال (حسب الطبيعة)</EngSection>
          <div className="mb-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div>
              <label
                className={engLabelClassName}
                htmlFor="eng-nature-on-site-area"
              >
                المساحة الإجمالية
              </label>
              <input
                id="eng-nature-on-site-area"
                inputMode="decimal"
                className={cn(
                  engInputClassName,
                  fieldErrors.nature_on_site_area &&
                    engineeringInvalidControlClass,
                )}
                disabled={formDisabled}
                value={localFields.natureOnSiteAreaSqm}
                onChange={(e) =>
                  patchLocalField("natureOnSiteAreaSqm", e.target.value)
                }
              />
              {fieldErrors.nature_on_site_area ? (
                <p className="mt-1 text-[11px] text-[#a5432e]">
                  {fieldErrors.nature_on_site_area}
                </p>
              ) : null}
            </div>
          </div>

          {NATURE_BOUNDARY_ROWS.map(
            ([boundKey, lenKey, boundLabel, lenLabel]) => (
              <div
                key={boundKey}
                className="mb-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2"
              >
                <div>
                  <label
                    className={engLabelClassName}
                    htmlFor={`eng-${boundKey}`}
                  >
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
            ),
          )}
        </>
      ) : null}

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

      <EngSection>خطاب إقرار صحة الموقع</EngSection>
      <EngUploadBox
        id="eng-site-letter"
        title="رفع خطاب الإقرار"
        hint="PDF — الحجم الأقصى 10 ميجابايت"
        fileName={draft.siteLetterFileName}
        disabled={formDisabled}
        error={fieldErrors.site_letter}
        onPick={(file) => onFilePick("siteLetterFileName", file)}
        onClear={() => onFileClear("siteLetterFileName")}
      />

      <div id="eng-site-confirm">
        {formDisabled ? (
          <div className="mt-3 rounded-lg border border-[#fad7a0] bg-[#fef3d7] px-3 py-2.5 text-[11.5px] leading-[1.7] text-[#7a5b12]">
            {draft.siteConfirmed
              ? "✓ تم الإقرار بأن المكتب الهندسي تحقق ميدانياً وأن بيانات التقرير المساحي صحيحة ودقيقة."
              : "لم يتم الإقرار بعد بصحة الموقع."}
          </div>
        ) : (
          <label
            className={cn(
              "mt-3 flex cursor-pointer items-start gap-[9px] rounded-lg border border-[#fad7a0] bg-[#fef3d7] px-3 py-2.5 text-[11.5px] leading-[1.7] text-[#7a5b12]",
              fieldErrors.site_confirmed && engineeringInvalidControlClass,
            )}
          >
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
      </div>

      <EngSection>نموذج التحقق الميداني — 13 بنداً</EngSection>
      <div
        id="eng-checklist"
        className={cn(
          fieldErrors.checklist && engineeringInvalidControlClass,
        )}
      >
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
          <p className="mt-1 text-[11px] text-[#a5432e]">
            {fieldErrors.checklist}
          </p>
        ) : null}
      </div>

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
                autoOpenRaise={false}
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
    </>
  );
}
