"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, InlineLoadingSkeleton, Input, Label, cn, formControlClassName, useToast } from "@platform/design-system";
import type { PartyTaskPageDef } from "@platform/app-shared/prototype/party-task-pages";
import type { WorkflowTask } from "@case-study/mfe";
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
import { FailureRaisePanel } from "@failures/mfe";
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

type WorkTab = "property" | "survey" | "fees" | "failures";

export function EngineeringSurveyWorkPanel({
  def,
  childTask: task,
  hostRef,
  deedNumber,
  onFailureSubmitted,
}: {
  def: PartyTaskPageDef;
  childTask: WorkflowTask;
  hostRef: EngineeringSurveyWindowHostRefObject;
  deedNumber: string;
  onFailureSubmitted?: () => void;
}) {
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

  const [draft, setDraft] = useState<EngineeringSurveySubmission | null>(null);
  const [workTab, setWorkTab] = useState<WorkTab>("survey");
  const [fieldErrors, setFieldErrors] = useState<EngineeringSurveyFieldErrors>(
    {},
  );
  const [formError, setFormError] = useState<string | null>(null);

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
  const formDisabled = locked;

  const syncCaseStudyFromChecklist = useCallback(
    async (checklist: EngineeringSurveySubmission["checklist"]) => {
      if (locked || !task.id) return;

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

      await savePartyCaseStudyFormDraft({
        ...partyDraft,
        answers: mergedAnswers,
      });
    },
    [locked, propertyId, task.id, task.poNumber],
  );

  const persist = useCallback(
    (patch: Parameters<typeof updateEngineeringSurveyDraft>[1]) => {
      if (!task.id) return;
      void updateEngineeringSurveyDraft(task.id, patch).then((next) => {
        if (next) setDraft(next);
      });
    },
    [task.id],
  );

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
    const submitted = await finalizeEngineeringSurveySubmission(task.id);
    hostRef.current?.onSavingChange?.(false);

    if (submitted) {
      setDraft(submitted);
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
        showToast(result.error, "error");
        return false;
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
    void clearEngineeringSurveyFile(draft.taskId, docField).then(() => {
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
      <InfoBox icon="ℹ">
        يُستخدم الموقع للتحقق من زيارة المكتب الهندسي. يجب أن تتطابق الإحداثيات
        مع موقع العقار الفعلي.
      </InfoBox>
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
      {draft.surveyReportFileName ? (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-[var(--radius-DEFAULT)] border border-[#a9dfbf] bg-[#d5f5ef] px-3 py-2 text-xs">
          <span>{draft.surveyReportFileName}</span>
          {!formDisabled ? (
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
      {draft.siteLetterFileName ? (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-[var(--radius-DEFAULT)] border border-[#a9dfbf] bg-[#d5f5ef] px-3 py-2 text-xs">
          <span>{draft.siteLetterFileName}</span>
          {!formDisabled ? (
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

      <SectionDivider />
      <SectionHeader>أسئلة نموذج دراسة الحالة</SectionHeader>
      <PartyCaseStudyFormTab def={def} childTask={task} />
    </>
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <nav
        className="flex shrink-0 gap-0 overflow-x-auto border-b border-border bg-surface px-4 sm:px-6 [&::-webkit-scrollbar]:h-0"
        aria-label="أقسام المهمة"
      >
        <button
          type="button"
          className={cn(
            "mb-[-1px] flex items-center gap-1.5 border-b-2 border-transparent bg-transparent px-3.5 py-2.5 font-inherit text-xs text-text-2 transition-colors hover:text-text",
            workTab === "property" && "border-b-primary font-medium text-primary",
          )}
          onClick={() => setWorkTab("property")}
        >
          بيانات العقار
        </button>
        <button
          type="button"
          className={cn(
            "mb-[-1px] flex items-center gap-1.5 border-b-2 border-transparent bg-transparent px-3.5 py-2.5 font-inherit text-xs text-text-2 transition-colors hover:text-text",
            workTab === "survey" && "border-b-primary font-medium text-primary",
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
          الأتعاب
        </button>
        <button
          type="button"
          className={cn(
            "mb-[-1px] flex items-center gap-1.5 border-b-2 border-transparent bg-transparent px-3.5 py-2.5 font-inherit text-xs text-text-2 transition-colors hover:text-text",
            workTab === "failures" && "border-b-primary font-medium text-primary",
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

      <div className="flex min-h-0 flex-1 flex-col items-stretch overflow-hidden lg:flex-row">
        <div className="order-1 min-h-0 min-w-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {workTab === "property" ? (
            <EngineeringSurveyPropertySummary
              property={property}
              record={record ?? undefined}
            />
          ) : null}
          {workTab === "survey" ? surveyBody : null}
          {workTab === "fees" ? (
            <InspectorFeesTab tasks={[task]} variant="engineering-survey" />
          ) : null}
          {workTab === "failures" && propertyId ? (
            <div>
              <SectionHeader>التعذرات المسجلة</SectionHeader>
              <FailureRaisePanel
                poNumber={task.poNumber}
                propertyId={propertyId}
                deedNumber={deedNumber}
                specialist={task.assigneeName || def.assigneeSubtitle}
                raisedByRole={failureRaiserRoleForParty(def)}
                onSubmitted={onFailureSubmitted}
              />
            </div>
          ) : null}
        </div>

        {record && property ? (
          <PropertyTransactionTimeline record={record} property={property} />
        ) : null}
      </div>
    </div>
  );
}
