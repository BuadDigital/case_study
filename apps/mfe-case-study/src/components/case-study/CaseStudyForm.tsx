"use client";

import {
  Button,
  FormGroup,
  InlineLoadingSkeleton,
  Input,
  Label,
  Note,
  Tab,
  TabBar,
  cn,
} from "@platform/ui-kit";
import { RegField } from "@platform/app-shared/registration/FormFields";
import {
  CASE_STUDY_FORM_STEPS,
  caseStudyAnswerKey,
} from "../../lib/app-data/case-study-form-data";
import { CaseStudyMatrixTable } from "./CaseStudyMatrixTable";
import { CaseStudyDeedNatureMatchSection } from "./CaseStudyDeedNatureMatchSection";
import { CaseStudyInfathSpecialistSection } from "./CaseStudyInfathSpecialistSection";
import {
  partyById,
  type CaseStudyInfoPartyId,
} from "@settings/mfe/lib/app-data/case-study-info-roles-data";
import type {
  CaseStudyFormDraft,
  CaseStudyMeterType,
} from "../../lib/app-data/case-study-form-model";
import type { PoIntakeRecord, PoPropertyIntake } from "../../lib/app-data/po-intake-data";
import type { WorkflowTask } from "../../lib/app-data/tasks-storage";
import {
  CaseStudyMatrixBanner,
  FormProgressRings,
  RemarksBlock,
  SpecialistClosingCards,
} from "./CaseStudyFormParts";
import { FORM_STEP_SECTIONS } from "./case-study-form-state";
import { useCaseStudyFormCommands } from "./useCaseStudyFormCommands";
import { useCaseStudyFormData } from "./useCaseStudyFormData";

type Props = {
  taskId: string;
  task: WorkflowTask;
  property: PoPropertyIntake | null;
  poRecord?: Pick<
    PoIntakeRecord,
    "assignmentSpecialist" | "receivedFromEnfathAt" | "promulgationDate"
  > | null;
  requestDateSeed?: string;
  /** Specialist — full form; party — matrix-assigned questions only */
  variant?: "specialist" | "party";
  partyId?: CaseStudyInfoPartyId;
  partyChildTaskId?: string;
  parentFormTaskId?: string;
  /** Appraiser — advisory answers for the specialist; not final on the study form */
  partyAdvisory?: boolean;
  /** Lock the view (e.g. after party task completion) — greyed out and non-editable */
  forceReadOnly?: boolean;
};

/**
 * Case study form — step chrome around the question matrix, plus the deed,
 * meters and closing blocks. State lives in `useCaseStudyFormData` and
 * persistence in `useCaseStudyFormCommands`.
 */
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
  forceReadOnly = false,
}: Props) {
  const data = useCaseStudyFormData({
    taskId,
    task,
    property,
    poRecord,
    requestDateSeed,
    variant,
    partyId,
    partyChildTaskId,
    parentFormTaskId,
    partyAdvisory,
    forceReadOnly,
  });
  const commands = useCaseStudyFormCommands(data);
  const {
    isParty,
    viewerPartyId,
    infoRolesReady,
    sectionQuestions,
    draft,
    hydrated,
    setHydrated,
    loadError,
    setLoadError,
    setReloadKey,
    parentFormSubmitted,
    saving,
    submittingForm,
    missingAnswerKeys,
    partyAnswersByKey,
    partyContribCount,
    setPartyRevision,
    isQuestionVisible,
    canEditKey,
    sectionHasVisibleQuestions,
    visibleStepIndices,
    summary,
    reportModel,
    goStep,
    patch,
    setAnswer,
    saveDraft,
    submitForm,
  } = { ...data, ...commands };

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
        بالمعلومة». راجع الإعدادات من قائمة الملف الشخصي.
      </Note>
    );
  }

  const step = draft.currentStep;
  const navSteps = visibleStepIndices;
  const isLastVisibleStep = navSteps[navSteps.length - 1] === step;
  const showStepFooterActions = !partyAdvisory;
  const isPartyVariant = variant === "party";
  const showFormStepChrome = !partyAdvisory && !isPartyVariant;
  const isFormReadOnly = Boolean(
    forceReadOnly ||
      (!isParty && draft.status === "submitted") ||
      (isParty && (draft.status === "submitted" || parentFormSubmitted)),
  );

  const matrixTableProps = {
    canEditKey,
    visibleKey: isQuestionVisible,
    sectionIndex: navSteps.indexOf(step) + 1,
    sectionTotal: navSteps.length || 1,
    missingAnswerKeys,
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
    <div className="flex flex-wrap items-center justify-end gap-2 rounded-[10px] border border-border bg-surface-2/50 px-3.5 py-3">
      <Button
        variant="outline"
        showActionToast={false}
        loading={saving}
        onClick={saveDraft}
      >
        حفظ مسودة
      </Button>
      {isParty ? (
        <Button
          variant="primary"
          showActionToast={false}
          loading={saving}
          onClick={submitForm}
        >
          حفظ إجاباتي
        </Button>
      ) : (
        <Button
          variant="primary"
          showActionToast={false}
          loading={saving || submittingForm}
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
        "flex flex-col gap-0",
        isFormReadOnly &&
          "select-none rounded-[10px] bg-surface-2/60 p-3 pointer-events-none [&_button]:cursor-not-allowed [&_[data-report-section]]:pointer-events-auto [&_[data-report-section]_button]:cursor-pointer",
        partyAdvisory && "mt-0",
      )}
      aria-disabled={isFormReadOnly || undefined}
    >
      {showFormStepChrome ? (
        <div
          className={cn(
            "mx-[-20px] flex flex-wrap items-stretch gap-0 border-b border-border",
            isFormReadOnly && "pointer-events-auto",
          )}
        >
          <TabBar
            className="z-10 mb-0 min-w-0 flex-1 flex-wrap gap-x-0.5 gap-y-0 overflow-visible whitespace-nowrap border-0 bg-transparent px-3.5 sm:px-3.5"
            aria-label="خطوات نموذج الدراسة"
          >
            {navSteps.map((i) => {
              const s = CASE_STUDY_FORM_STEPS[i];
              const isActive = step === i;
              return (
                <Tab
                  key={s.id}
                  active={isActive}
                  onClick={() => goStep(i)}
                  className={cn(
                    "relative mb-0 max-lg:min-h-0 border-0 border-b-0 px-2.5 py-[9px] text-[12.5px] font-normal text-text-2",
                    "rounded-none transition-[background,color] duration-150",
                    "hover:bg-[color-mix(in_srgb,#102B4E_6%,transparent)] hover:text-heading",
                    isActive &&
                      "!border-0 !bg-ink !font-normal !text-white hover:!bg-ink hover:!text-white",
                  )}
                >
                  {s.label}
                </Tab>
              );
            })}
          </TabBar>
          <div className="flex shrink-0 items-center border-s border-border/60 px-3 py-1.5">
            <FormProgressRings
              summary={summary}
              submitted={draft.status === "submitted" || parentFormSubmitted}
            />
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3.5 pt-4">
      {isFormReadOnly ? (
        <Note tone="success">
          {forceReadOnly
            ? "المهمة مكتملة — الأسئلة للعرض فقط ولا يمكن التعديل."
            : isParty
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
        <div className="flex flex-col gap-3.5">
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
        </div>
      ) : null}

      {step === 1 && sectionHasVisibleQuestions("survey") ? (
        <div className="flex flex-col gap-3.5">
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
          {!isParty ? (
            <CaseStudyDeedNatureMatchSection
              draft={draft}
              disabled={isFormReadOnly}
              onPatch={(p) => {
                if (p.deedNatureMatchOutcome !== undefined)
                  patch("deedNatureMatchOutcome", p.deedNatureMatchOutcome);
                if (p.deedNatureMatchNotes !== undefined)
                  patch("deedNatureMatchNotes", p.deedNatureMatchNotes);
              }}
            />
          ) : null}
          {!isParty && isLastVisibleStep ? (
            <SpecialistClosingCards reportModel={reportModel} />
          ) : null}
        </div>
      ) : null}

      {step === 2 && sectionHasVisibleQuestions("comp") ? (
        <div className="flex flex-col gap-3.5">
          <CaseStudyMatrixTable
            section="comp"
            sectionTitle="مكونات العقار"
            questions={sectionQuestions.comp}
            answers={draft.answers}
            onAnswer={setAnswer}
            {...matrixTableProps}
            footer={
              !isParty ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-text">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-text-2">
                      <span className="whitespace-nowrap">عداد الكهرباء رقم</span>
                      <span className="inline-flex items-center gap-1 whitespace-nowrap">
                        <span aria-hidden="true">(</span>
                        <Input
                          className="w-[5.5rem] rounded-none border-0 border-b border-border-md bg-transparent px-0.5 shadow-none focus:ring-0"
                          placeholder="رقم"
                          aria-label="رقم العداد"
                          value={draft.meterNumber}
                          disabled={isFormReadOnly}
                          onChange={(e) => patch("meterNumber", e.target.value)}
                        />
                        <span aria-hidden="true">)</span>
                      </span>
                    </span>
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {(
                        [
                          ["electronic", "إلكتروني"],
                          ["analog", "مؤرشف"],
                          ["none", "لا يوجد"],
                        ] as const
                      ).map(([val, label]) => {
                        const on = draft.meterType === val;
                        return (
                          <label
                            key={val}
                            className={cn(
                              "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition-colors",
                              on
                                ? "border-ink bg-ink text-white"
                                : "border-border-md bg-surface text-text-2 hover:text-heading",
                              isFormReadOnly && "cursor-not-allowed opacity-50",
                            )}
                          >
                            <input
                              type="radio"
                              name={`meter-${taskId}`}
                              className="sr-only"
                              checked={on}
                              disabled={isFormReadOnly}
                              onChange={() => {
                                patch("meterType", val as CaseStudyMeterType);
                                if (val === "none") patch("meterNumber", "");
                              }}
                            />
                            {label}
                          </label>
                        );
                      })}
                    </span>
                  </div>
                  <RemarksBlock
                    label="ملاحظات"
                    value={draft.componentsRemarks}
                    disabled={isFormReadOnly}
                    onChange={(v) => patch("componentsRemarks", v)}
                    rows={2}
                  />
                </div>
              ) : undefined
            }
          />
          {!isParty && isLastVisibleStep ? (
            <SpecialistClosingCards reportModel={reportModel} />
          ) : null}
        </div>
      ) : null}

      {step === 3 && sectionHasVisibleQuestions("occ") ? (
        <div className="flex flex-col gap-3.5">
          <CaseStudyMatrixTable
            section="occ"
            sectionTitle="الإشغال والإيجار"
            questions={sectionQuestions.occ}
            answers={draft.answers}
            onAnswer={setAnswer}
            {...matrixTableProps}
            footer={
              !isParty ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <RegField
                      id="cs-hoa"
                      label="قيمة اشتراك اتحاد الملاك"
                      type="number"
                      placeholder="القيمة"
                      value={draft.hoaFee}
                      onChange={(v) => patch("hoaFee", v)}
                      className="inline-block max-w-[200px]"
                    />
                    <span className="pb-2 text-xs text-text-2">ريال سعودي</span>
                  </div>
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
        </div>
      ) : null}

      {step === 4 && sectionHasVisibleQuestions("extra") ? (
        <div className="flex flex-col gap-3.5">
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

      {showStepFooterActions ? formFooterActions : null}
      </div>
    </div>
  );
}
