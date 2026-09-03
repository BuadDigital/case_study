"use client";

import {
  Activity,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  InlineLoadingSkeleton,
  Spinner,
  cn,
  opsLetterCard,
} from "@platform/ui-kit";
import type { PoPropertyIntake } from "@case-study/mfe/lib/app-data/po-intake-data";
import type {
  EvaluatorReportChoices,
  EvaluatorSubmission,
} from "../../../lib/evaluator/evaluator-window-data";
import { createEvaluatorDraft } from "../../../lib/evaluator/evaluator-window-data";

import {
  Card,
  CardPad,
  GhostBtn,
  PrimaryBtn,
} from "./atoms";
import { ApproachSettingsSection } from "./ApproachSettingsSection";
import { ComparablesBankTable } from "./ComparablesBankTable";
import { fmt } from "./lib/shell-utils";
import {
  buildNavItems,
  resolveEffectiveScreen,
  type ValuationWorkScreenId,
} from "./lib/shell-state";
import { useValuationWorkData } from "./useValuationWorkData";
import { useValuationWorkCommands } from "./useValuationWorkCommands";

export type {
  ValuationWorkNavAvailability,
  ValuationWorkPropertyHint,
  ValuationWorkScreenId,
} from "./lib/shell-state";
import type {
  ValuationWorkNavAvailability,
  ValuationWorkPropertyHint,
} from "./lib/shell-state";

const EvaluatorFinalReviewTab = lazy(() =>
  import("../EvaluatorFinalReviewTab").then((m) => ({
    default: m.EvaluatorFinalReviewTab,
  })),
);
const AdjustmentsMatrix = lazy(() =>
  import("./AdjustmentsMatrix").then((m) => ({ default: m.AdjustmentsMatrix })),
);
const CostApproachSection = lazy(() =>
  import("./CostApproachSection").then((m) => ({
    default: m.CostApproachSection,
  })),
);
const CostBasisUnitCard = lazy(() =>
  import("./CostApproachSection").then((m) => ({
    default: m.CostBasisUnitCard,
  })),
);
const FinalOpinionSection = lazy(() =>
  import("./FinalOpinionSection").then((m) => ({
    default: m.FinalOpinionSection,
  })),
);

export type ValuationWorkShellProps = {
  propertyId: string;
  poNumber?: string;
  assignmentType?: string;
  districtHint?: string;
  onFinalOpinionChange?: (finalOpinionValue: number) => void;
  property?: ValuationWorkPropertyHint;
  /** Full intake row when available (final-review screen). */
  intakeProperty?: PoPropertyIntake | null;
  draft?: EvaluatorSubmission;
  disabled?: boolean;
  fieldErrors?: Record<string, string>;
  onDraftPatch?: (patch: {
    evaluatorPrice?: string;
    forcedSaleDiscountPct?: string;
  }) => void;
  onReportChoicesPatch?: (patch: Partial<EvaluatorReportChoices>) => void;
  onSubmit?: () => void;
  submitting?: boolean;
  showSubmit?: boolean;
  /** Controlled screen when embedded in EvaluatorWindow top tabs. */
  screen?: ValuationWorkScreenId;
  onScreenChange?: (screen: ValuationWorkScreenId) => void;
  /** Hide inner header/nav — top ValTabBar owns navigation. */
  embeddedInTopTabs?: boolean;
  /** Notify parent which approach tabs should appear (Rule Q-2). */
  onNavAvailabilityChange?: (nav: ValuationWorkNavAvailability) => void;
};

/**
 * Appraiser valuation work shell — matches the sales-comparison valuation design docs.
 * Horizontal screen nav (MFE already has app sidebar). Loading and derivations live in
 * `useValuationWorkData`, writes in `useValuationWorkCommands`; this file is composition.
 */
export function ValuationWorkShell({
  propertyId,
  poNumber,
  assignmentType,
  districtHint,
  onFinalOpinionChange,
  property,
  intakeProperty = null,
  draft,
  disabled = false,
  fieldErrors,
  onDraftPatch,
  onReportChoicesPatch,
  onSubmit,
  submitting = false,
  showSubmit = false,
  screen: screenProp,
  onScreenChange,
  embeddedInTopTabs = false,
  onNavAvailabilityChange,
}: ValuationWorkShellProps) {
  const [internalScreen, setInternalScreen] =
    useState<ValuationWorkScreenId>("basic");
  const screenControlled = screenProp != null;
  const screen = screenControlled ? screenProp : internalScreen;
  const setScreen = useCallback(
    (id: ValuationWorkScreenId) => {
      if (!screenControlled) setInternalScreen(id);
      onScreenChange?.(id);
    },
    [onScreenChange, screenControlled],
  );

  const data = useValuationWorkData({
    propertyId,
    assignmentType,
    districtHint,
    property,
    intakeProperty,
    onFinalOpinionChange,
    onNavAvailabilityChange,
  });
  const {
    loading,
    saving,
    setSaving,
    error,
    valuationRequestId,
    selection,
    landSelection,
    subjectArea,
    analysisNotes,
    setAnalysisNotes,
    factorDefinitions,
    catalogFactorOptions,
    approachSettings,
    settingsHydrateKey,
    cost,
    costHydrateKey,
    recon,
    reconHydrateKey,
    gates,
    officialValuationDate,
    onCostSaved,
    onReconSaved,
    onSettingsSaved,
    onSaveCostBasisUnit,
    settingsSaved,
    marketEnabled,
    costEnabled,
    adjustmentsLocked,
    subjectSpecs,
    visibleAdoptedMarket,
    visibleAdoptedLand,
    autoNarrative,
    narrativeDirty,
    bankRows,
    bankDistanceKm,
    landBankRows,
    landBankDistanceKm,
    subjectAreaNum,
    onSearchBank,
  } = data;

  const {
    saveSubjectArea,
    clearAnalysisNotes,
    onAdoptMarket,
    onAdoptLand,
    onSaveBankOverride,
    dispatchMarketMatrix,
    dispatchLandMatrix,
  } = useValuationWorkCommands(data);

  const navItems = buildNavItems({
    marketEnabled,
    costEnabled,
    adoptedMarketCount: visibleAdoptedMarket.length,
  });
  const effectiveScreen = resolveEffectiveScreen(navItems, screen);

  /** Screen mounts only after first visit — then stays mounted (hidden) so drafts are not lost. */
  const visitedScreensRef = useRef<Set<ValuationWorkScreenId>>(new Set());
  visitedScreensRef.current.add(effectiveScreen);
  const screenMode = (id: ValuationWorkScreenId) =>
    !loading && effectiveScreen === id ? "visible" : "hidden";

  useEffect(() => {
    if (!screenControlled) return;
    if (screen !== effectiveScreen) onScreenChange?.(effectiveScreen);
  }, [effectiveScreen, onScreenChange, screen, screenControlled]);

  /* ─── screens ─── */
  function renderMarket() {
    if (!settingsSaved) {
      return (
        <Card>
          <CardPad>
            <p className="text-[13px] text-text-2">
              ابدأ التقييم من شاشة البيانات الأساسية أولاً.
            </p>
          </CardPad>
        </Card>
      );
    }
    if (!marketEnabled) {
      return (
        <Card>
          <CardPad>
            <p className="text-[13px] text-text-2">
              أسلوب السوق غير مفعّل في إعدادات التقييم.
            </p>
          </CardPad>
        </Card>
      );
    }

    return (
      <>
        <ComparablesBankTable
          rows={bankRows}
          subjectSqm={subjectAreaNum}
          distanceKm={bankDistanceKm}
          onAdopt={onAdoptMarket}
          onSearch={onSearchBank}
          onSaveOverride={onSaveBankOverride}
        />

        {selection ? (
          <Suspense fallback={<InlineLoadingSkeleton />}>
            <AdjustmentsMatrix
              selection={selection}
              adopted={visibleAdoptedMarket}
              locked={adjustmentsLocked}
              saving={saving}
              subjectArea={subjectArea}
              idealArea={subjectArea}
              city={property?.city}
              district={property?.district ?? districtHint}
              valuationDate={officialValuationDate ?? undefined}
              factorDefinitions={factorDefinitions}
              catalogFactors={catalogFactorOptions}
              subjectSpecs={subjectSpecs}
              canEditSubjectSpec
              dispatch={dispatchMarketMatrix}
            />
          </Suspense>
        ) : null}

        <Card>
          <CardPad>
            <div className="mb-3 flex items-center justify-between gap-2.5">
              <span className="text-[14.5px] font-extrabold text-heading">
                تحليل التسويات
              </span>
              <div className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "text-[11px] font-semibold",
                    narrativeDirty ? "text-red-text" : "text-gold-d",
                  )}
                >
                  {narrativeDirty
                    ? "نص محرَّر يدوياً — لا يتحدث تلقائياً"
                    : "يتحدث تلقائياً مع المبررات"}
                </span>
                {narrativeDirty ? (
                  <GhostBtn disabled={saving} onClick={clearAnalysisNotes}>
                    ↺ استرجاع النص التلقائي
                  </GhostBtn>
                ) : null}
              </div>
            </div>
            <textarea
              rows={9}
              value={narrativeDirty ? analysisNotes : autoNarrative}
              onChange={(e) => setAnalysisNotes(e.target.value)}
              onBlur={() => void saveSubjectArea()}
              className="w-full resize-y rounded-[9px] border border-border bg-surface-2 px-4 py-3.5 text-[13px] font-medium leading-[2] text-text"
            />
          </CardPad>
        </Card>
      </>
    );
  }

  function renderCost() {
    if (!settingsSaved || !costEnabled) {
      return (
        <Card>
          <CardPad>
            <p className="text-[13px] text-text-2">
              {!settingsSaved
                ? "ابدأ التقييم أولاً."
                : "أسلوب التكلفة غير مفعّل أو غير منطبق."}
            </p>
          </CardPad>
        </Card>
      );
    }

    const landComplete = !!cost?.landEstimateComplete;
    const buildingOnly =
      (approachSettings?.costScopeKey ?? "land_and_building") === "building_only";

    return (
      <>
        <div className="sticky top-0 z-[14] bg-[var(--page,#f7f5f0)] py-1 pb-2.5">
          <div className="flex flex-wrap items-center gap-4 rounded-[10px] border border-border-md bg-surface px-[18px] py-[9px] shadow-[0_8px_20px_-18px_rgba(18,40,76,.4)]">
            <span className="text-[13px] font-extrabold text-heading">
              أسلوب التكلفة
            </span>
            <span className="text-[11.5px] text-text-3">
              أرض{" "}
              <b
                dir="ltr"
                className={cn(
                  buildingOnly
                    ? "text-text-3"
                    : landComplete
                      ? "text-heading"
                      : "text-red-text",
                )}
              >
                {buildingOnly
                  ? "غير مشمولة"
                  : landComplete
                    ? fmt(cost?.landValueFromMarket)
                    : "— بانتظار المقارنات"}
              </b>
            </span>
            <span className="text-[11.5px] text-text-3">
              إحلال{" "}
              <b dir="ltr" className="text-heading">
                {fmt(cost?.totalCostWithIndirect)}
              </b>
            </span>
            <span className="text-[11.5px] text-text-3">
              إهلاك{" "}
              <b dir="ltr" className="text-red-text">
                {fmt(cost?.depreciationValue)}
              </b>
            </span>
            <span className="ms-auto flex items-baseline gap-[9px]">
              <span className="text-[11.5px] font-bold text-gold-d">
                {buildingOnly
                  ? "تكلفة الإحلال − الإهلاك ="
                  : "أرض + إحلال − إهلاك ="}
              </span>
              <span
                dir="ltr"
                className={cn(
                  "text-[17px] font-extrabold",
                  buildingOnly || landComplete ? "text-heading" : "text-red-text",
                )}
              >
                {buildingOnly || landComplete
                  ? fmt(cost?.costOpinionWithLand)
                  : "غير مكتمل — يلزم قيمة الأرض"}
              </span>
            </span>
          </div>
        </div>

        <Suspense fallback={<InlineLoadingSkeleton />}>
          <CostBasisUnitCard
            key={`${approachSettings?.costBasisKey ?? "replacement"}:${approachSettings?.costMeasurementUnitKey ?? "comparison_unit"}`}
            savedBasisKey={approachSettings?.costBasisKey || "replacement"}
            savedUnitKey={
              approachSettings?.costMeasurementUnitKey || "comparison_unit"
            }
            saving={saving}
            onSave={onSaveCostBasisUnit}
          />
        </Suspense>

        {!buildingOnly ? (
        <>
        <div className="mb-4 flex items-start gap-[11px] rounded-[10px] border border-border-md bg-gold-soft px-4 py-[13px]">
          <span className="h-[30px] w-[3px] shrink-0 rounded-full bg-gold" />
          <div>
            <div className="text-[13px] font-extrabold text-heading">
              تقدير قيمة الأرض فضاءً
            </div>
            <div className="mt-0.5 text-[11.5px] font-normal text-gold-d">
              مكوّن داخل أسلوب التكلفة — ناتجه قيمة الأرض ولا يدخل التوفيق بين
              الأساليب. مقارناته أراضٍ خام مستقلة عن مقارنات أسلوب السوق.
            </div>
          </div>
        </div>

        <ComparablesBankTable
          rows={landBankRows}
          subjectSqm={cost?.landAreaSqm || subjectAreaNum}
          distanceKm={landBankDistanceKm}
          onAdopt={onAdoptLand}
          onSaveOverride={onSaveBankOverride}
        />

        {landSelection ? (
          <Suspense fallback={<InlineLoadingSkeleton />}>
            <AdjustmentsMatrix
              selection={landSelection}
              adopted={visibleAdoptedLand}
              locked={adjustmentsLocked}
              saving={saving}
              subjectArea={String(cost?.landAreaSqm || subjectArea)}
              idealArea={String(cost?.landAreaSqm || subjectArea)}
              city={property?.city}
              district={property?.district ?? districtHint}
              valuationDate={officialValuationDate ?? undefined}
              factorDefinitions={factorDefinitions}
              catalogFactors={catalogFactorOptions}
              dispatch={dispatchLandMatrix}
            />
          </Suspense>
        ) : null}

        </>
        ) : (
          <div className="mb-4 rounded-[10px] border border-border bg-surface-2 px-4 py-3 text-[12.5px] text-text-2">
            النطاق «مبنى فقط» — قسم تقدير الأرض مخفي ومؤشر الأسلوب = تكلفة الإحلال
            ناقصاً الإهلاك. يُغيَّر النطاق من شاشة البيانات الأساسية.
          </div>
        )}

      </>
    );
  }

  function renderReview() {
    const reviewDraft =
      draft ??
      createEvaluatorDraft({
        taskId: "",
        propertyId,
        poNumber: poNumber ?? "",
        assignmentType,
      });
    return (
      <>
        <Suspense fallback={<InlineLoadingSkeleton />}>
          <EvaluatorFinalReviewTab
            draft={reviewDraft}
            disabled={disabled}
            property={intakeProperty}
            assignmentType={assignmentType}
            valuationRequestId={valuationRequestId}
            approachSettings={approachSettings}
            fieldErrors={fieldErrors}
            onDraftPatch={onDraftPatch}
            onReportChoicesPatch={onReportChoicesPatch}
          />
        </Suspense>
        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          {showSubmit ? (
            <PrimaryBtn
              disabled={disabled || submitting}
              onClick={() => onSubmit?.()}
            >
              {submitting ? <Spinner /> : null}
              <span>
                {submitting
                  ? "جاري الاعتماد…"
                  : "اعتماد التقييم وإرسال للأخصائي"}
              </span>
            </PrimaryBtn>
          ) : null}
        </div>
      </>
    );
  }

  return (
    <div dir="rtl" className="relative min-h-[480px]">
      {!embeddedInTopTabs ? (
        <div className={opsLetterCard}>
          <nav className="flex flex-wrap gap-1.5 px-[22px] py-3">
            {navItems
              .filter((n) => n.show)
              .map((n) => {
                const active = effectiveScreen === n.id;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setScreen(n.id)}
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3.5 py-2 text-[12.5px] font-bold",
                      active
                        ? "border-ink bg-ink text-white"
                        : "border-border-md bg-surface text-text",
                    )}
                  >
                    {n.label}
                    {n.badge != null ? (
                      <span
                        className={cn(
                          "grid h-[17px] min-w-[17px] place-items-center rounded-full px-[5px] text-[9.5px] font-bold",
                          active
                            ? "bg-[rgba(200,181,145,.35)] text-white"
                            : "bg-gold-soft text-gold-d",
                        )}
                      >
                        {n.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
          </nav>
        </div>
      ) : null}

      <div
        className={cn(
          "relative pb-2",
          embeddedInTopTabs ? "pt-0" : "py-[18px]",
        )}
      >
        {error ? (
          <p className="mb-3 text-[12.5px] text-red-text">
            {error}
          </p>
        ) : null}
        {loading ? (
          // Placeholder skeleton sized like the real screen — no buttons/chips before data; no layout jump.
          <div aria-busy="true" aria-label="جاري تحميل مساحة عمل التقييم">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={cn(opsLetterCard, "mb-5")}
              >
                <div className="p-[18px_22px]">
                  <div className="h-4 w-44 animate-pulse rounded-md bg-[var(--navy-soft)]" />
                  <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
                    {[0, 1, 2].map((j) => (
                      <div key={j} className="min-w-0">
                        <div className="h-3 w-24 animate-pulse rounded bg-[var(--navy-soft)]" />
                        <div className="mt-2 h-9 animate-pulse rounded-[var(--radius)] bg-[var(--navy-soft)]" />
                      </div>
                    ))}
                  </div>
                  {i === 2 ? (
                    <div className="mt-4 h-24 animate-pulse rounded-[var(--radius)] bg-[var(--navy-soft)]" />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {visitedScreensRef.current.has("basic") ? (
          <Activity mode={screenMode("basic")}>
            <ApproachSettingsSection
              valuationRequestId={valuationRequestId}
              assignmentType={assignmentType}
              settings={approachSettings}
              hydrateKey={settingsHydrateKey}
              saving={saving}
              onSavingChange={setSaving}
              onSettingsSaved={onSettingsSaved}
            />
          </Activity>
        ) : null}
        {visitedScreensRef.current.has("market") ? (
          <Activity mode={screenMode("market")}>{renderMarket()}</Activity>
        ) : null}
        {visitedScreensRef.current.has("cost") ? (
          <Activity mode={screenMode("cost")}>
            {renderCost()}
            {settingsSaved && costEnabled ? (
              <Suspense fallback={<InlineLoadingSkeleton />}>
                <CostApproachSection
                  valuationRequestId={valuationRequestId}
                  poNumber={poNumber}
                  propertyId={propertyId}
                  cost={cost}
                  hydrateKey={costHydrateKey}
                  buildingOnly={
                    (approachSettings?.costScopeKey ?? "land_and_building") ===
                    "building_only"
                  }
                  isApartmentProperty={(approachSettings?.propertyType ?? "").includes(
                    "شقة",
                  )}
                  costBasisKey={approachSettings?.costBasisKey || "replacement"}
                  saving={saving}
                  onSavingChange={setSaving}
                  onCostSaved={onCostSaved}
                />
              </Suspense>
            ) : null}
          </Activity>
        ) : null}
        {!loading && effectiveScreen === "final" && !settingsSaved ? (
          <Card>
            <CardPad>
              <p className="text-[13px] text-text-2">
                ابدأ التقييم أولاً لفتح رأي القيمة النهائي.
              </p>
            </CardPad>
          </Card>
        ) : null}
        {visitedScreensRef.current.has("final") ? (
          <Activity mode={screenMode("final")}>
            {settingsSaved ? (
              <Suspense fallback={<InlineLoadingSkeleton />}>
                <FinalOpinionSection
                  valuationRequestId={valuationRequestId}
                  recon={recon}
                  gates={gates}
                  cost={cost}
                  hydrateKey={reconHydrateKey}
                  buildingOnly={
                    (approachSettings?.costScopeKey ?? "land_and_building") ===
                    "building_only"
                  }
                  hasAdoptedMarket={visibleAdoptedMarket.length > 0}
                  assignmentType={assignmentType}
                  officialValuationDate={officialValuationDate}
                  saving={saving}
                  onSavingChange={setSaving}
                  onReconSaved={onReconSaved}
                />
              </Suspense>
            ) : null}
          </Activity>
        ) : null}
        {visitedScreensRef.current.has("review") ? (
          <Activity mode={screenMode("review")}>{renderReview()}</Activity>
        ) : null}
      </div>
    </div>
  );
}
