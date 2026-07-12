"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, InlineLoadingSkeleton, Input, Label, Note, cn, formControlClassName, useToast } from "@platform/design-system";
import type { PartyTaskPageDef } from "@platform/app-shared/prototype/party-task-pages";
import type { WorkflowTask } from "@case-study/mfe";
import { activeSurveyEntryPath } from "@case-study/mfe/lib/my-task-routes";
import {
  emptyCaseStudyFormDraft,
  InspectorFeesTab,
  loadPartyCaseStudyFormDraft,
  PartyCaseStudyFormTab,
  savePartyCaseStudyFormDraft,
} from "@case-study/mfe";
import { usePoRecordQuery } from "@case-study/mfe/query/case-study-queries";
import {
  InfoBox,
  SectionDivider,
  SectionHeader,
} from "@case-study/mfe/components/po-intake/PropertyDetailFields";
import { PropertyTransactionTimeline } from "@case-study/mfe/components/po-intake/PropertyTransactionTimeline";
import {
  FailureRaisePanel,
  blockingFailureForProperty,
  failureRecordTitle,
} from "@failures/mfe";
import { failureRaiserRoleForParty } from "@failures/mfe/lib/failure-party-roles";
import { useFailuresQuery } from "@failures/mfe/query/failures-queries";
import { isActiveFailureStatus } from "@failures/mfe/lib/failures-types";
import {
  isEngineeringSurveyFormLocked,
  type EngineeringSurveySubmission,
} from "../lib/engineering-survey-data";
import {
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
  JEDDAH_DEFAULT_LAT,
  JEDDAH_DEFAULT_LNG,
} from "../lib/jeddah-default-coords";
import {
  applyChecklistToCaseStudyAnswers,
  caseStudyAnswersChanged,
} from "../lib/engineering-survey-checklist-sync";
import { EngineeringSurveyFailuresHistory } from "./EngineeringSurveyFailuresHistory";
import { QuickActionsFab } from "./QuickActionsFab";
import { usePartyTaskRecallRequest } from "@case-study/mfe/hooks/use-party-task-recall-request";
import { usePartyTaskRecallEligibility } from "@case-study/mfe/hooks/use-party-task-recall-eligibility";
import { isEngineeringSurveyTransactionActive } from "../lib/engineering-survey-transaction-active";

type WorkTab = "property" | "survey" | "fees" | "notes" | "failures";

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
  onFailureSubmitted?: () => void;
  variant?: "workspace" | "entry";
  /** When true (e.g. completed task), forms stay visible but locked. */
  forceReadOnly?: boolean;
}) {
  const router = useRouter();
  const readOnly = variant === "workspace" || forceReadOnly;
  const propertyId = task.propertyId ?? "";
  const { showToast, runWithUploadToast } = useToast();
  const { data: record } = usePoRecordQuery(task.poNumber);
  const property = record?.properties.find((p) => p.id === propertyId);
  const { data: failures = [] } = useFailuresQuery();

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
  const [workTab, setWorkTab] = useState<WorkTab>("survey");
  const [fieldErrors, setFieldErrors] = useState<EngineeringSurveyFieldErrors>(
    {},
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [failureRaiseOpen, setFailureRaiseOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingLocal, setSavingLocal] = useState(false);

  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;
    void getOrCreateEngineeringSurveyDraft({
      taskId: task.id,
      propertyId,
      poNumber: task.poNumber,
    }).then((loaded) => {
      if (!cancelled) setDraft(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [task.id, task.poNumber, propertyId]);

  const locked = draft ? isEngineeringSurveyFormLocked(draft.status) : false;
  const formDisabled = locked || readOnly;
  const recallEligible = usePartyTaskRecallEligibility(task);
  const transactionActive = useMemo(
    () => isEngineeringSurveyTransactionActive(task.status, draft?.status),
    [draft?.status, task.status],
  );
  const notesEditable = transactionActive && !locked && !readOnly;
  const savedNote = draft?.surveyNotes?.trim() ?? "";

  useEffect(() => {
    setNoteDraft(draft?.surveyNotes ?? "");
  }, [draft?.surveyNotes]);

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
    if (blockingFailure) {
      showToast(
        `لا يمكن بدء الرفع المساحي — يوجد تعذر نشط: ${failureRecordTitle(blockingFailure)}`,
        "error",
      );
      setWorkTab("failures");
      return;
    }
    router.push(activeSurveyEntryPath(task.id));
  }, [
    blockingFailure,
    router,
    showToast,
    task.id,
    transactionActive,
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
      if (locked || readOnly || !task.id) return;

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
    [locked, propertyId, task.id, task.poNumber, showToast],
  );

  const persist = useCallback(
    (patch: Parameters<typeof updateEngineeringSurveyDraft>[1]) => {
      if (!task.id) return;
      void updateEngineeringSurveyDraft(task.id, patch)
        .then((next) => {
          if (next) setDraft(next);
        })
        .catch((err: unknown) => {
          showToast(
            err instanceof Error ? err.message : "تعذّر حفظ الرفع المساحي — حاول مرة أخرى",
            "error",
          );
        });
    },
    [task.id, showToast],
  );

  const saveNote = useCallback(() => {
    if (!notesEditable) return;
    persist({ surveyNotes: noteDraft });
    showToast("تم حفظ الملاحظة", "success");
  }, [noteDraft, notesEditable, persist, showToast]);

  useEffect(() => {
    if (!draft || locked) return;
    void syncCaseStudyFromChecklist(draft.checklist);
  }, [draft, locked, syncCaseStudyFromChecklist]);

  const submit = useCallback(async (): Promise<boolean> => {
    if (!draft || locked) return false;

    const errors = validateEngineeringSurveySubmission(draft);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      const message = firstEngineeringSurveyError(errors);
      setFormError(message);
      showToast(message, "error");
      return false;
    }

    hostRef.current?.onSavingChange?.(true);
    setFormError(null);
    const result = await finalizeEngineeringSurveySubmission(task.id);
    hostRef.current?.onSavingChange?.(false);

    if (result) {
      setDraft(result.submission);
      if (result.warning) {
        showToast(result.warning, "error");
      }
      hostRef.current?.onSubmitted?.();
      return true;
    }
    const message = "تعذر إتمام الرفع المساحي — حاول مرة أخرى";
    setFormError(message);
    showToast(message, "error");
    return false;
  }, [draft, locked, hostRef, task.id, showToast]);

  useEffect(() => {
    if (!hostRef.current) return;
    hostRef.current.submit = submit;
  }, [hostRef, submit]);

  const handleCoordsChange = useCallback(
    (lat: string, lng: string) => {
      persist({ latitude: lat, longitude: lng });
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.latitude;
        delete next.longitude;
        return next;
      });
    },
    [persist],
  );

  function onFilePick(
    field: "surveyReportFileName" | "siteLetterFileName",
    file: File | null,
  ) {
    if (!file || formDisabled || !draft) return;
    const docField =
      field === "surveyReportFileName" ? "surveyReport" : "siteLetter";
    void runWithUploadToast(async () => {
      const result = await cacheEngineeringSurveyFile(draft.taskId, docField, file);
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

  if (!draft) {
    return <InlineLoadingSkeleton className="my-2" />;
  }

  const surveyBody = (
    <>
      {draft.status === "reopened" && draft.returnNote ? (
        <InfoBox variant="amber" icon="⚠">
          <strong>تم إعادة الرفع المساحي — يرجى المراجعة والتصحيح.</strong>
          <br />
          {draft.returnNote}
        </InfoBox>
      ) : null}

      {formError ? (
        <InfoBox variant="red" icon="!">
          {formError}
        </InfoBox>
      ) : null}

      <SectionHeader>موقع العقار الميداني</SectionHeader>
      {!readOnly ? (
        <InfoBox icon="ℹ">
          يُستخدم الموقع للتحقق من زيارة المكتب الهندسي. يجب أن تتطابق الإحداثيات
          مع موقع العقار الفعلي.
        </InfoBox>
      ) : null}
      <div className="mb-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div>
          <Label htmlFor="eng-lat" className="text-xs">
            خط العرض (Latitude) <span className="text-danger-text">*</span>
          </Label>
          <Input
            id="eng-lat"
            className="font-mono text-[13px]"
            disabled={formDisabled}
            value={draft.latitude}
            placeholder={JEDDAH_DEFAULT_LAT}
            onChange={(e) => {
              persist({ latitude: e.target.value });
              setFieldErrors((prev) => {
                const next = { ...prev };
                delete next.latitude;
                return next;
              });
            }}
          />
        </div>
        <div>
          <Label htmlFor="eng-lng" className="text-xs">
            خط الطول (Longitude) <span className="text-danger-text">*</span>
          </Label>
          <Input
            id="eng-lng"
            className="font-mono text-[13px]"
            disabled={formDisabled}
            value={draft.longitude}
            placeholder={JEDDAH_DEFAULT_LNG}
            onChange={(e) => {
              persist({ longitude: e.target.value });
              setFieldErrors((prev) => {
                const next = { ...prev };
                delete next.longitude;
                return next;
              });
            }}
          />
        </div>
      </div>
      {fieldErrors.latitude || fieldErrors.longitude ? (
        <p className="mb-3 text-[11px] text-danger-text" role="alert">
          {fieldErrors.latitude ?? fieldErrors.longitude}
        </p>
      ) : null}
      <EngineeringSurveyMap
        latitude={draft.latitude}
        longitude={draft.longitude}
        disabled={formDisabled}
        onCoordsChange={handleCoordsChange}
      />

      <SectionDivider />
      <SectionHeader>الحدود والأطوال (إنفاذ)</SectionHeader>
      <div className="mb-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="mb-3.5">
          <Label htmlFor="eng-on-site-area" className="text-xs">
            المساحة على الطبيعة (م²)
          </Label>
          <Input
            id="eng-on-site-area"
            className="text-xs"
            disabled={formDisabled}
            value={draft.onSiteAreaSqm}
            onChange={(e) => persist({ onSiteAreaSqm: e.target.value })}
          />
        </div>
      </div>
      {(
        [
          ["northBoundary", "northBoundaryLengthM", "الحد الشمالي", "طول الحد الشمالي التقريبي (م)"],
          ["southBoundary", "southBoundaryLengthM", "الحد الجنوبي", "طول الحد الجنوبي التقريبي (م)"],
          ["eastBoundary", "eastBoundaryLengthM", "الحد الشرقي", "طول الحد الشرقي التقريبي (م)"],
          ["westBoundary", "westBoundaryLengthM", "الحد الغربي", "طول الحد الغربي التقريبي (م)"],
        ] as const
      ).map(([boundKey, lenKey, boundLabel, lenLabel]) => (
        <div key={boundKey} className="mb-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div className="mb-3.5">
            <Label className="text-xs">{boundLabel}</Label>
            <Input
              className="text-xs"
              disabled={formDisabled}
              value={draft[boundKey]}
              onChange={(e) => persist({ [boundKey]: e.target.value })}
            />
          </div>
          <div className="mb-3.5">
            <Label className="text-xs">{lenLabel}</Label>
            <Input
              className="text-xs"
              disabled={formDisabled}
              value={draft[lenKey]}
              onChange={(e) => persist({ [lenKey]: e.target.value })}
            />
          </div>
        </div>
      ))}
      <div className="mb-3.5">
        <Label htmlFor="eng-survey-notes" className="text-xs">
          ملاحظات الرفع المساحي
        </Label>
        <textarea
          id="eng-survey-notes"
          className={cn(
            formControlClassName,
            "min-h-[72px] resize-y py-2 leading-relaxed",
          )}
          rows={3}
          disabled={formDisabled}
          value={draft.surveyNotes}
          onChange={(e) => persist({ surveyNotes: e.target.value })}
        />
      </div>

      <SectionDivider />
      <SectionHeader>التقرير المساحي</SectionHeader>
      {!readOnly ? (
        <div className="rounded-[var(--radius-DEFAULT)] border-2 border-dashed border-border-md bg-surface-2 p-[18px] text-center">
          <div className="mb-1 text-xs font-semibold text-text-2">رفع التقرير المساحي</div>
          <div className="mb-2.5 text-[11px] text-text-3">PDF — الحجم الأقصى 20 ميجابايت</div>
          <label className="mt-1 inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-[var(--radius-DEFAULT)] border border-primary bg-primary px-2 py-1 text-[11px] text-white transition-colors hover:border-primary-mid hover:bg-primary-mid">
            اختيار ملف
            <input
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              disabled={formDisabled}
              onChange={(e) =>
                onFilePick("surveyReportFileName", e.target.files?.[0] ?? null)
              }
            />
          </label>
        </div>
      ) : null}
      {draft.surveyReportFileName ? (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-[var(--radius-DEFAULT)] border border-[#a9dfbf] bg-[#d5f5ef] px-3 py-2 text-xs">
          <span>{draft.surveyReportFileName}</span>
          {!formDisabled && !readOnly ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onFileClear("surveyReportFileName")}
            >
              حذف
            </Button>
          ) : null}
        </div>
      ) : null}
      {fieldErrors.survey_report ? (
        <p className="mt-1 text-[11px] text-danger-text">{fieldErrors.survey_report}</p>
      ) : null}

      <SectionDivider />
      <SectionHeader>خطاب إقرار صحة الموقع</SectionHeader>
      {!readOnly ? (
        <div className="rounded-[var(--radius-DEFAULT)] border-2 border-dashed border-border-md bg-surface-2 p-[18px] text-center">
          <div className="mb-1 text-xs font-semibold text-text-2">رفع خطاب الإقرار</div>
          <div className="mb-2.5 text-[11px] text-text-3">PDF — الحجم الأقصى 10 ميجابايت</div>
          <label className="mt-1 inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-[var(--radius-DEFAULT)] border border-primary bg-primary px-2 py-1 text-[11px] text-white transition-colors hover:border-primary-mid hover:bg-primary-mid">
            اختيار ملف
            <input
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              disabled={formDisabled}
              onChange={(e) =>
                onFilePick("siteLetterFileName", e.target.files?.[0] ?? null)
              }
            />
          </label>
        </div>
      ) : null}
      {draft.siteLetterFileName ? (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-[var(--radius-DEFAULT)] border border-[#a9dfbf] bg-[#d5f5ef] px-3 py-2 text-xs">
          <span>{draft.siteLetterFileName}</span>
          {!formDisabled && !readOnly ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onFileClear("siteLetterFileName")}
            >
              حذف
            </Button>
          ) : null}
        </div>
      ) : null}
      {readOnly ? (
        <div className="mt-3 rounded-[var(--radius-DEFAULT)] border border-[#fad7a0] bg-[#fef3d7] px-3 py-2.5 text-[11px] leading-relaxed">
          {draft.siteConfirmed
            ? "تم الإقرار بأن المكتب الهندسي تحقق ميدانياً وأن بيانات التقرير المساحي صحيحة ودقيقة."
            : "لم يتم الإقرار بعد بصحة الموقع."}
        </div>
      ) : (
        <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-[var(--radius-DEFAULT)] border border-[#fad7a0] bg-[#fef3d7] px-3 py-2.5 text-[11px] leading-relaxed">
          <input
            type="checkbox"
            checked={draft.siteConfirmed}
            disabled={formDisabled}
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
        <p className="mt-1 text-[11px] text-danger-text">{fieldErrors.site_confirmed}</p>
      ) : null}
      {fieldErrors.site_letter ? (
        <p className="mt-1 text-[11px] text-danger-text">{fieldErrors.site_letter}</p>
      ) : null}

      <SectionDivider />
      <SectionHeader>نموذج التحقق الميداني — 13 بنداً</SectionHeader>
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
        <p className="mt-1 text-[11px] text-danger-text">{fieldErrors.checklist}</p>
      ) : null}
    </>
  );

  const surveyWorkSection = (
    <section className="min-h-0 min-w-0 overflow-y-auto rounded-xl border border-border bg-surface p-3">
      <h3 className="m-0 mb-2 text-sm font-semibold text-text">
        {def.workTitle}
      </h3>
      <Note tone="info" className="mb-4">
        {def.workIntro}
      </Note>
      <fieldset
        disabled={formDisabled}
        className={cn(
          "m-0 min-w-0 border-0 p-0",
          formDisabled &&
            "pointer-events-none select-none rounded-[10px] bg-[#F1F5F9] p-3 opacity-70 grayscale-[0.35]",
        )}
      >
        {surveyBody}
      </fieldset>
      {variant === "entry" && !formDisabled ? (
        <div className="mt-4 rounded-[var(--radius-lg)] border border-border bg-surface p-4 shadow-[0_-4px_16px_rgba(15,52,96,0.08)]">
          <div
            dir="ltr"
            className="flex flex-wrap items-center justify-end gap-2"
          >
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={savingLocal}
              loading={savingLocal}
              showActionToast={false}
              actionLabel={def.saveLabel}
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
              <i className="ti ti-send" aria-hidden /> {def.saveLabel}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );

  const caseStudySection = (
    <section className="min-h-0 min-w-0 overflow-y-auto rounded-xl border border-border bg-surface p-3">
      <h3 className="m-0 mb-2 text-sm font-semibold text-text">
        نموذج الدراسة
      </h3>
      <PartyCaseStudyFormTab
        def={def}
        childTask={task}
        forceReadOnly={formDisabled}
      />
    </section>
  );

  const surveySplit = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 sm:px-6 sm:py-5">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-2">
        {surveyWorkSection}
        {caseStudySection}
      </div>
    </div>
  );

  return (
    <>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <nav
          className="flex shrink-0 gap-0 overflow-x-auto border-b border-border bg-surface px-4 sm:px-6 [&::-webkit-scrollbar]:h-0"
          aria-label="أقسام المهمة"
          role="tablist"
        >
          <button
            type="button"
            className={cn(
              "mb-[-1px] flex items-center gap-1.5 border-b-2 border-transparent bg-transparent px-3.5 py-2.5 font-inherit text-xs text-text-2 transition-colors hover:text-text",
              workTab === "property" &&
                "border-b-primary font-medium text-primary",
            )}
            onClick={() => setWorkTab("property")}
          >
            بيانات العقار
          </button>
          <button
            type="button"
            className={cn(
              "mb-[-1px] flex items-center gap-1.5 border-b-2 border-transparent bg-transparent px-3.5 py-2.5 font-inherit text-xs text-text-2 transition-colors hover:text-text",
              workTab === "survey" &&
                "border-b-primary font-medium text-primary",
            )}
            onClick={() => setWorkTab("survey")}
          >
            {def.workTitle}
          </button>
          <button
            type="button"
            className={cn(
              "mb-[-1px] flex items-center gap-1.5 border-b-2 border-transparent bg-transparent px-3.5 py-2.5 font-inherit text-xs text-text-2 transition-colors hover:text-text",
              workTab === "fees" && "border-b-primary font-medium text-primary",
            )}
            onClick={() => setWorkTab("fees")}
          >
            مالية المعاملة
          </button>
          <button
            type="button"
            className={cn(
              "mb-[-1px] flex max-w-[200px] items-center gap-1.5 border-b-2 border-transparent bg-transparent px-3.5 py-2.5 font-inherit text-xs text-text-2 transition-colors hover:text-text",
              workTab === "notes" && "border-b-primary font-medium text-primary",
            )}
            onClick={() => setWorkTab("notes")}
          >
            <span>ملاحظة</span>
            {savedNote ? (
              <span
                className="inline-block size-1.5 rounded-full bg-primary"
                aria-hidden
              />
            ) : null}
          </button>
          <button
            type="button"
            className={cn(
              "mb-[-1px] flex items-center gap-1.5 border-b-2 border-transparent bg-transparent px-3.5 py-2.5 font-inherit text-xs text-text-2 transition-colors hover:text-text",
              workTab === "failures" &&
                "border-b-primary font-medium text-primary",
            )}
            onClick={() => setWorkTab("failures")}
          >
            التعذرات
            {activeFailureCount > 0 ? (
              <span className="rounded-[10px] bg-danger-bg px-1.5 py-px text-[10px] font-medium text-danger-text">
                {activeFailureCount}
              </span>
            ) : null}
          </button>
        </nav>

        {workTab === "survey" ? (
          surveySplit
        ) : (
          <div className="flex min-h-0 flex-1 flex-row items-stretch overflow-hidden max-lg:flex-col">
            <div className="order-1 min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
              {blockingFailure && workTab === "property" ? (
                <InfoBox variant="amber" icon="⚠">
                  <strong>يوجد تعذر نشط على هذا العقار.</strong>
                  <br />
                  لا يمكن بدء الرفع المساحي حتى يُعالج التعذر:{" "}
                  {failureRecordTitle(blockingFailure)}
                </InfoBox>
              ) : null}
              {workTab === "property" ? (
                <EngineeringSurveyPropertySummary
                  property={property}
                  record={record ?? undefined}
                />
              ) : null}
              {workTab === "fees" ? (
                <InspectorFeesTab
                  tasks={[task]}
                  variant="engineering-survey"
                />
              ) : null}
              {workTab === "notes" ? (
                <div>
                  <SectionHeader>ملاحظة على المعاملة</SectionHeader>
                  <textarea
                    id="eng-workspace-note"
                    className={cn(
                      formControlClassName,
                      "min-h-[120px] w-full resize-y py-2 leading-relaxed",
                    )}
                    rows={5}
                    disabled={!notesEditable}
                    value={noteDraft}
                    placeholder="اكتب ملاحظتك هنا…"
                    onChange={(e) => setNoteDraft(e.target.value)}
                  />
                  {notesEditable ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        showActionToast={false}
                        onClick={saveNote}
                      >
                        حفظ الملاحظة
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-text-3">
                      لا يمكن تعديل الملاحظة بعد إرسال المعاملة أو إغلاقها.
                    </p>
                  )}
                </div>
              ) : null}
              {workTab === "failures" && propertyId ? (
                <div>
                  <SectionHeader>تسجيل تعذر</SectionHeader>
                  <FailureRaisePanel
                    poNumber={task.poNumber}
                    propertyId={propertyId}
                    deedNumber={deedNumber}
                    specialist={task.assigneeName || def.assigneeSubtitle}
                    raisedByRole={failureRaiserRoleForParty(def)}
                    onSubmitted={onFailureSubmitted}
                    autoOpenRaise={failureRaiseOpen}
                  />
                  <SectionDivider />
                  <SectionHeader>سجل التعذرات</SectionHeader>
                  <EngineeringSurveyFailuresHistory
                    poNumber={task.poNumber}
                    propertyId={propertyId}
                    deedNumber={deedNumber}
                  />
                </div>
              ) : null}
            </div>

            {record && property ? (
              <PropertyTransactionTimeline
                record={record}
                property={property}
              />
            ) : null}
          </div>
        )}
      </div>

      {variant === "workspace" ? (
        <QuickActionsFab
          placement="bottom-start"
          deedNumber={deedNumber}
          startSurveyDimmed={!transactionActive || Boolean(blockingFailure)}
          workActionsDimmed={!transactionActive}
          recallDimmed={transactionActive || !recallEligible}
          onStartSurvey={handleStartSurvey}
          onAddObstruction={handleAddObstruction}
          onAddNote={handleAddNote}
          onRequestRecall={handleRequestRecall}
        />
      ) : null}
    </>
  );
}
