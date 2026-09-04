"use client";

import { Spinner, cn, opsBtnPrimary, opsFldControl, opsTfLbl } from "@platform/ui-kit";

import {
  engineeringInvalidControlClass,
  isPlattedPropertyWithPlot,
} from "../lib/engineering-survey-validation";
import { updateEngineeringSurveyDraft } from "../lib/engineering-survey-submission-commands";
import { applyNatureBoundaryPatch, natureFieldsFromDeedForm } from "../lib/engineering-survey-nature-fields";
import { EngineeringSurveyChecklist } from "./EngineeringSurveyChecklist";
import {
  EngInfo,
  EngSection,
  EngUploadBox,
} from "./EngineeringSurveyHtmlPrimitives";
import {
  BOUNDARY_ROWS,
  EngineeringSurveyMap,
  NATURE_BOUNDARY_ROWS,
} from "./EngineeringSurveyWorkParts";
import type { EngineeringSurveyWorkflow } from "./useEngineeringSurveyCommands";

/**
 * The survey tab itself — coordinates and map, deed/nature boundaries, the
 * checklist and the two required attachments. Draft state and persistence
 * belong to the survey workflow.
 */
export function EngineeringSurveyWorkBody({
  workflow,
}: {
  workflow: EngineeringSurveyWorkflow;
}) {
  const {
    draft,
    localFields,
    setLocalFields,
    fieldErrors,
    setFieldErrors,
    formError,
    formDisabled,
    locked,
    property,
    task,
    savingLocal,
    setSavingLocal,
    patchLocalField,
    handleCoordsChange,
    handleChecklistChange,
    applyRemoteDraft,
    persist,
    schedulePersist,
    showToast,
    onFilePick,
    onFileClear,
    submit,
  } = workflow;
  if (!draft || !localFields) return null;

  return (
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
          <label className={opsTfLbl} htmlFor="eng-lat">
            خط العرض (Latitude) *
          </label>
          <input
            id="eng-lat"
            dir="ltr"
            className={cn(
              opsFldControl,
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
          <label className={opsTfLbl} htmlFor="eng-lng">
            خط الطول (Longitude) *
          </label>
          <input
            id="eng-lng"
            dir="ltr"
            className={cn(
              opsFldControl,
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
      <EngUploadBox
        id="eng-survey-report"
        title="رفع التقرير المساحي"
        hint="PDF — الحجم الأقصى 20 ميجابايت"
        fileName={draft.surveyReportFileName}
        disabled={formDisabled}
        error={fieldErrors.survey_report}
        onPick={(file) => onFilePick("surveyReportFileName", file)}
        onClear={() => onFileClear("surveyReportFileName")}
      />

      <EngSection>الحدود والأطوال (حسب الصك)</EngSection>
      <div className="mb-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div>
          <label className={opsTfLbl} htmlFor="eng-on-site-area">
            المساحة الإجمالية
          </label>
          <input
            id="eng-on-site-area"
            inputMode="decimal"
            className={cn(
              opsFldControl,
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
            <label className={opsTfLbl} htmlFor={`eng-${boundKey}`}>
              {boundLabel}
            </label>
            <input
              id={`eng-${boundKey}`}
              className={opsFldControl}
              disabled={formDisabled}
              value={localFields[boundKey]}
              onChange={(e) => patchLocalField(boundKey, e.target.value)}
            />
          </div>
          <div>
            <label className={opsTfLbl} htmlFor={`eng-${lenKey}`}>
              {lenLabel}
            </label>
            <input
              id={`eng-${lenKey}`}
              inputMode="decimal"
              className={opsFldControl}
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
        <p className={cn(opsTfLbl, "mb-2")}>هل الصك مطابق للطبيعة؟</p>
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
                      if (saved) applyRemoteDraft(saved);
                    });
                    setFieldErrors((prev) => {
                      if (!prev.deed_matches_nature) return prev;
                      const { deed_matches_nature: _, ...rest } = prev;
                      return rest;
                    });

                    // When «no»: copy nature fields from deed form values already entered
                    if (next === "no" && localFields) {
                      const fromDeed = natureFieldsFromDeedForm(localFields);
                      const { patch: naturePatch, appliedCount: natureN } =
                        applyNatureBoundaryPatch(fromDeed, localFields, true);
                      if (natureN > 0) {
                        setLocalFields((prev) =>
                          prev ? { ...prev, ...naturePatch } : prev,
                        );
                        schedulePersist(naturePatch);
                        showToast(
                          `تم نسخ ${natureN} حقلاً من حدود الصك إلى الطبيعة — راجعها والمساحة يدوياً`,
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
            نعم: تُعتمد الحدود حسب الصك أعلاه · لا: تُفتح حقول الطبيعة ويمكن
            نسخ حدود الصك إليها للمراجعة
          </p>
        )}
      </div>

      {draft.deedMatchesNature === "no" ? (
        <>
          <EngSection>الحدود والأطوال (حسب الطبيعة)</EngSection>
          <div className="mb-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div>
              <label
                className={opsTfLbl}
                htmlFor="eng-nature-on-site-area"
              >
                المساحة الإجمالية
              </label>
              <input
                id="eng-nature-on-site-area"
                inputMode="decimal"
                className={cn(
                  opsFldControl,
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
                    className={opsTfLbl}
                    htmlFor={`eng-${boundKey}`}
                  >
                    {boundLabel}
                  </label>
                  <input
                    id={`eng-${boundKey}`}
                    className={opsFldControl}
                    disabled={formDisabled}
                    value={localFields[boundKey]}
                    onChange={(e) => patchLocalField(boundKey, e.target.value)}
                  />
                </div>
                <div>
                  <label className={opsTfLbl} htmlFor={`eng-${lenKey}`}>
                    {lenLabel}
                  </label>
                  <input
                    id={`eng-${lenKey}`}
                    inputMode="decimal"
                    className={opsFldControl}
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
        <label className={opsTfLbl} htmlFor="eng-survey-notes">
          ملاحظات الرفع المساحي
        </label>
        <textarea
          id="eng-survey-notes"
          rows={3}
          className={cn(opsFldControl, "resize-y")}
          disabled={formDisabled}
          value={localFields.surveyNotes}
          onChange={(e) => patchLocalField("surveyNotes", e.target.value)}
        />
      </div>

      <EngSection>خطاب إقرار صحة الموقع</EngSection>
      <EngUploadBox
        id="eng-site-letter"
        title="رفع خطاب الإقرار"
        hint={
          isPlattedPropertyWithPlot(property)
            ? "اختياري — العقار ضمن مخطط وله رقم قطعة · PDF — الحجم الأقصى 10 ميجابايت"
            : "PDF — الحجم الأقصى 10 ميجابايت"
        }
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
          onChange={handleChecklistChange}
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
            className={opsBtnPrimary}
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
}
