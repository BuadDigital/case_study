// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Alert panels per group: market on «طريقة المقارنة», cost on the cost screen, general on the final
//         opinion (alertsPanel) — cost and general alerts had no panel.
//  • Passes gates and setScreen to the review screen for the hand-over blockers list.
//  • Split  The screen pills moved to ValuationWorkNav.
// Round 2 (1b19bedc)
//  • A    The land table inside the cost approach uses the whole plot area (landPlotSqm), never an
//         apartment's floor area, and an apartment shows apartmentLandHint; deedArea goes to the cost
//         section.
// ──────────────────────────────────────────────────────────────────────────────────────────────

"use client";

import {
  Activity,
  Suspense,
  useCallback,
  useEffect,
  useState,
} from "react";
import { InlineLoadingSkeleton, cn } from "@platform/ui-kit";
import { apartmentLandHint } from "../../../lib/evaluator/cost-land-figures";
import {
  retrospectiveDraftFromSettings,
} from "../../../lib/evaluator/evaluator-validation";

import {
  Card,
  CardPad,
  CardTitle,
  GhostBtn,
} from "./atoms";
import { ApproachSettingsSection } from "./ApproachSettingsSection";
import { EngInfo } from "../EvaluatorHtmlPrimitives";
import {
  ASSET_TYPE_CHANGED_MESSAGE,
  assetTypeChangedNeedsReview,
} from "../../../lib/evaluator/inspector-data-changes";
import { ComparablesBankTable } from "./ComparablesBankTable";
import { MethodologyAlertsPanel } from "./MethodologyAlertsPanel";
import { fmt } from "./lib/shell-utils";
import { marketSubjectAreaLabel } from "./lib/market-subject";
import {
  buildNavItems,
  resolveEffectiveScreen,
  type ValuationWorkScreenId,
} from "./lib/shell-state";
import { ApproachSummaryStrip } from "./ApproachSummaryStrip";
import { ValuationWorkNav } from "./ValuationWorkNav";
import { deedNatureMatchGateDetail } from "./lib/deed-nature-match-gate";
import { useValuationWorkData } from "./useValuationWorkData";
import { useValuationWorkCommands } from "./useValuationWorkCommands";
import { ValuationWorkErrorsProvider } from "./ValuationWorkErrors";
import { ValuationWorkLoadingSkeleton } from "./ValuationWorkLoadingSkeleton";
import { ValuationWorkReviewScreen } from "./ValuationWorkReviewScreen";
import {
  AdjustmentsMatrix,
  CostApproachSection,
  FinalOpinionSection,
  usePreloadLaterWorkScreens,
} from "./lazy-work-screens";
import type { ValuationWorkShellProps } from "./ValuationWorkShell.types";

export type { ValuationWorkShellProps } from "./ValuationWorkShell.types";
export type {
  ValuationWorkNavAvailability,
  ValuationWorkPropertyHint,
  ValuationWorkScreenId,
} from "./lib/shell-state";
import type {
  ValuationWorkNavAvailability,
  ValuationWorkPropertyHint,
} from "./lib/shell-state";

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
  inspectionTaskId = null,
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
  onRetrospectiveDraftChange,
  onSpecialistDraftChange,
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
    poNumber,
    inspectionTaskId,
    assignmentType,
    districtHint,
    property,
    intakeProperty,
    onFinalOpinionChange,
    editLocked: disabled,
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
    approachSettings,
    marketKind,
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
    settingsSaved,
    marketEnabled,
    costEnabled,
    adjustmentsLocked,
    deedMatchPending,
    subjectSpecs,
    visibleAdoptedMarket,
    visibleAdoptedLand,
    autoNarrative,
    narrativeDirty,
    bankRows,
    bankDistanceKm,
    bankBeyond,
    landBankRows,
    landBankDistanceKm,
    landBankBeyond,
    bankRadiusKm,
    setBankRadiusKm,
    subjectAreaNum,
    onSearchBank,
    reload,
    bankSubjectCoords,
  } = data;
  const isApartment = (approachSettings?.propertyType ?? "").includes("شقة");
  // The land table's own area — the whole plot, never the apartment's floor area.
  const landPlotSqm = landSelection?.subjectAreaSqm ?? cost?.landAreaSqm ?? 0;

  const {
    onAdoptMarket,
    onAdoptLand,
    onSaveBankOverride,
    dispatchMarketMatrix,
    dispatchLandMatrix,
  } = useValuationWorkCommands(data);

  const matchWaitDetail = deedNatureMatchGateDetail(gates);

  const [draftApproaches, setDraftApproaches] =
    useState<ValuationWorkNavAvailability | null>(null);
  const onDraftApproachesChange = useCallback(
    (nav: ValuationWorkNavAvailability) => {
      setDraftApproaches(nav);
    },
    [],
  );
  const marketTab =
    draftApproaches != null ? draftApproaches.market : marketEnabled;
  const costTab =
    draftApproaches != null ? draftApproaches.cost : costEnabled;

  useEffect(() => {
    onNavAvailabilityChange?.({ market: marketTab, cost: costTab });
  }, [costTab, marketTab, onNavAvailabilityChange]);

  const comparableSeed = {
    type: property?.propertyType || intakeProperty?.propertyType,
    city: property?.city || intakeProperty?.city,
    district:
      property?.district || districtHint || intakeProperty?.district,
    latitude:
      bankSubjectCoords != null ? String(bankSubjectCoords.lat) : undefined,
    longitude:
      bankSubjectCoords != null ? String(bankSubjectCoords.lng) : undefined,
  };
  const onBankCreated = useCallback(() => {
    void reload({ silent: true, scope: "full" });
  }, [reload]);

  const navItems = buildNavItems({
    marketEnabled: marketTab,
    costEnabled: costTab,
    adoptedMarketCount: visibleAdoptedMarket.length,
  });
  const effectiveScreen = resolveEffectiveScreen(navItems, screen);

  /** Screen mounts only after first visit — then stays mounted (hidden) so drafts are not lost.
   * Basics + review stay mounted so send-from-any-tab can scroll to their fields. */
  const [visitedScreens, setVisitedScreens] = useState<Set<ValuationWorkScreenId>>(
    () => new Set(),
  );
  const screensToMount: ValuationWorkScreenId[] = loading
    ? [effectiveScreen]
    : ["basic", "review", effectiveScreen];
  if (screensToMount.some((id) => !visitedScreens.has(id))) {
    setVisitedScreens(new Set([...visitedScreens, ...screensToMount]));
  }
  const screenMode = (id: ValuationWorkScreenId) =>
    !loading && effectiveScreen === id ? "visible" : "hidden";

  usePreloadLaterWorkScreens(!loading);

  useEffect(() => {
    if (!screenControlled) return;
    if (screen !== effectiveScreen) onScreenChange?.(effectiveScreen);
  }, [effectiveScreen, onScreenChange, screen, screenControlled]);

  useEffect(() => {
    if (loading) return;
    const fromSaved = retrospectiveDraftFromSettings(approachSettings);
    if (fromSaved) onRetrospectiveDraftChange?.(fromSaved);
    if (approachSettings) {
      onSpecialistDraftChange?.({
        used: approachSettings.externalSpecialistUsed,
        details: approachSettings.externalSpecialistDetails ?? "",
      });
    }
  }, [
    approachSettings,
    loading,
    onRetrospectiveDraftChange,
    onSpecialistDraftChange,
  ]);

  /* ─── screens ─── */
  /**
   * A work tab opened before the valuation started. The tabs follow the approaches ticked in the
   * draft, so they show before «بدء التقييم» succeeds — the card says what to do and leads back,
   * where a refused start names the missing field (e.g. مبرر التقييم بأثر رجعي).
   */
  function notStartedCard(screenLabel: string) {
    return (
      <Card>
        <CardPad>
          <p className="mb-3 text-[13px] text-text-2">
            لم يبدأ التقييم بعد، فلا تُفتح «{screenLabel}». ارجع إلى «البيانات الأساسية» واضغط «بدء
            التقييم» — إن لم يبدأ تظهر رسالة بالحقل الناقص وتنتقل إليه (مثل مبرر التقييم بأثر رجعي).
          </p>
          <GhostBtn onClick={() => setScreen("basic")}>الانتقال إلى البيانات الأساسية</GhostBtn>
        </CardPad>
      </Card>
    );
  }

  function renderMarket() {
    if (!settingsSaved) return notStartedCard("طريقة المقارنة");
    if (!marketTab) {
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


    const marketIsUnit = (selection?.adjustmentBasis ?? "price_per_sqm") === "price_per_sqm";
    const marketAdopted = visibleAdoptedMarket.length;
    const marketValue = selection?.marketOpinionValueRaw ?? selection?.marketOpinionValue ?? 0;
    const marketReady = marketAdopted > 0 && marketValue > 0;

    return (
      <>
        <ApproachSummaryStrip
          title="أسلوب السوق"
          items={[
            {
              label: "مقارنات معتمدة",
              value: String(marketAdopted),
              tone: marketAdopted > 0 ? "heading" : "danger",
            },
            ...(marketAdopted > 0
              ? [
                  {
                    label: "مجموع الأوزان النسبية",
                    value: selection?.weightsSumTo100 ? "100٪" : "≠ 100٪",
                    tone: selection?.weightsSumTo100 ? ("heading" as const) : ("danger" as const),
                  },
                  {
                    label: marketIsUnit ? "سعر المتر بعد التسوية" : "المتوسط المرجّح",
                    value: fmt(selection?.weightedPricePerSqm),
                  },
                ]
              : []),
            ...(marketIsUnit
              ? [
                  {
                    label: marketSubjectAreaLabel(marketKind),
                    value: subjectAreaNum && subjectAreaNum > 0 ? `${fmt(subjectAreaNum)} م²` : "—",
                  },
                ]
              : []),
          ]}
          resultLabel={
            marketIsUnit
              ? `سعر المتر × ${marketSubjectAreaLabel(marketKind)} =`
              : "قيمة العقار بعد التسوية ="
          }
          result={marketReady ? fmt(marketValue) : "غير مكتمل — يلزم اعتماد مقارن"}
          resultTone={marketReady ? "heading" : "danger"}
        />

        <ComparablesBankTable
          rows={bankRows}
          subjectSqm={subjectAreaNum}
          distanceKm={bankDistanceKm}
          radiusKm={bankRadiusKm}
          onRadiusChange={setBankRadiusKm}
          beyond={bankBeyond}
          onAdopt={onAdoptMarket}
          onSearch={onSearchBank}
          onSaveOverride={onSaveBankOverride}
          seed={comparableSeed}
          sourceWorkOrderNumber={poNumber}
          sourcePropertyId={propertyId}
          onCreated={onBankCreated}
        />

        {selection ? (
          <Suspense fallback={<InlineLoadingSkeleton />}>
            <AdjustmentsMatrix
              selection={selection}
              adopted={visibleAdoptedMarket}
              locked={adjustmentsLocked}
              saving={saving}
              subjectArea={subjectArea}
              subjectKind={marketKind}
              idealArea={subjectArea}
              city={property?.city}
              district={property?.district ?? districtHint}
              valuationDate={officialValuationDate ?? undefined}
              subjectSpecs={subjectSpecs}
              canEditSubjectSpec
              dispatch={dispatchMarketMatrix}
            />
          </Suspense>
        ) : null}
        {gates && settingsSaved ? (
          <MethodologyAlertsPanel
            group="market"
            gates={gates}
            recon={recon}
            valuationRequestId={valuationRequestId}
            saving={saving}
            onSavingChange={setSaving}
            onReconSaved={onReconSaved}
          />
        ) : null}
      </>
    );
  }

  function alertsPanel(group: "cost" | "general") {
    return gates ? (
      <MethodologyAlertsPanel
        group={group}
        gates={gates}
        recon={recon}
        valuationRequestId={valuationRequestId}
        saving={saving}
        onSavingChange={setSaving}
        onReconSaved={onReconSaved}
      />
    ) : null;
  }

  function renderCost() {
    if (!settingsSaved) return notStartedCard("طريقة المقاول");
    if (!costTab) {
      return (
        <Card>
          <CardPad>
            <p className="text-[13px] text-text-2">أسلوب التكلفة غير مفعّل أو غير منطبق.</p>
          </CardPad>
        </Card>
      );
    }

    const landComplete = !!cost?.landEstimateComplete;
    const buildingOnly =
      (approachSettings?.costScopeKey ?? "land_and_building") === "building_only";

    return (
      <>
        <ApproachSummaryStrip
          title="أسلوب التكلفة"
          items={[
            {
              label: "أرض",
              value: buildingOnly
                ? "غير مشمولة"
                : landComplete
                  ? fmt(cost?.landValueFromMarket)
                  : "— بانتظار المقارنات",
              tone: buildingOnly ? "muted" : landComplete ? "heading" : "danger",
            },
            { label: "إحلال", value: fmt(cost?.totalCostWithIndirect) },
            { label: "إهلاك", value: fmt(cost?.depreciationValue), tone: "danger" },
          ]}
          resultLabel={buildingOnly ? "تكلفة الإحلال − الإهلاك =" : "أرض + إحلال − إهلاك ="}
          result={
            buildingOnly || landComplete
              ? fmt(cost?.costOpinionWithLand)
              : "غير مكتمل — يلزم قيمة الأرض"
          }
          resultTone={buildingOnly || landComplete ? "heading" : "danger"}
        />

        {!buildingOnly ? (
        <>
        <div
          id="cost-land-bank"
          className="mb-4 flex items-start gap-[11px] rounded-[10px] border border-border-md bg-gold-soft px-4 py-[13px]"
        >
          <span className="h-[30px] w-[3px] shrink-0 rounded-full bg-gold" />
          <div>
            <div className="text-[13px] font-extrabold text-heading">
              تقدير قيمة الأرض فضاءً
            </div>
            <div className="mt-0.5 text-[11.5px] font-normal text-gold-d">
              مكوّن داخل أسلوب التكلفة — ناتجه قيمة الأرض ولا يدخل الترجيح بين
              الأساليب. مقارناته أراضٍ خام مستقلة عن مقارنات أسلوب السوق.
            </div>
            {/* The land comparables are adjusted against the whole plot. */}
            {isApartment ? (
              <div data-testid="apartment-plot-hint" className="mt-1 text-[11.5px] font-bold text-heading">
                {apartmentLandHint(cost)}
              </div>
            ) : null}
          </div>
        </div>

        <ComparablesBankTable
          rows={landBankRows}
          subjectSqm={landPlotSqm || (isApartment ? null : subjectAreaNum)}
          distanceKm={landBankDistanceKm}
          radiusKm={bankRadiusKm}
          onRadiusChange={setBankRadiusKm}
          beyond={landBankBeyond}
          onAdopt={onAdoptLand}
          onSaveOverride={onSaveBankOverride}
          seed={comparableSeed}
          sourceWorkOrderNumber={poNumber}
          sourcePropertyId={propertyId}
          onCreated={onBankCreated}
        />

        {landSelection ? (
          <Suspense fallback={<InlineLoadingSkeleton />}>
            <AdjustmentsMatrix
              selection={landSelection}
              adopted={visibleAdoptedLand}
              locked={adjustmentsLocked}
              saving={saving}
              subjectArea={landPlotSqm ? String(landPlotSqm) : isApartment ? "" : subjectArea}
              idealArea={landPlotSqm ? String(landPlotSqm) : isApartment ? "" : subjectArea}
              city={property?.city}
              district={property?.district ?? districtHint}
              valuationDate={officialValuationDate ?? undefined}
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
        {gates ? alertsPanel("cost") : null}
      </>
    );
  }

  function renderReview() {
    return (
      <ValuationWorkReviewScreen
        draft={draft}
        propertyId={propertyId}
        poNumber={poNumber}
        assignmentType={assignmentType}
        disabled={disabled}
        intakeProperty={intakeProperty}
        valuationRequestId={valuationRequestId}
        approachSettings={approachSettings}
        fieldErrors={fieldErrors}
        onDraftPatch={onDraftPatch}
        onReportChoicesPatch={onReportChoicesPatch}
        onSettingsSaved={onSettingsSaved}
        onSpecialistDraftChange={onSpecialistDraftChange}
        showSubmit={showSubmit}
        submitting={submitting}
        onSubmit={onSubmit}
        gates={gates}
        onGoToScreen={setScreen}
      />
    );
  }

  return (
    <ValuationWorkErrorsProvider
      fieldErrors={fieldErrors}
      onScreenChange={setScreen}
    >
      <div dir="rtl" className="relative min-h-[480px]">
        {!embeddedInTopTabs ? (
          <ValuationWorkNav items={navItems} active={effectiveScreen} onSelect={setScreen} />
        ) : null}

        {deedMatchPending ? (
          <Card>
            <CardPad>
              <CardTitle>مطابقة الصك على الطبيعة لم تُحسم بعد</CardTitle>
              <p className="m-0 text-[13px] leading-relaxed text-text">
                صك تقليدي: أكمل التقييم الآن — إصدار التقرير ينتظر اعتماد دارس الحالة لمطابقة
                المعاين أو المكتب الهندسي (أو الرفع المساحي السابق) من تبويب مدخلات المعاين.
                {matchWaitDetail ? (
                  <span className="mt-1 block text-[12px] text-text-2">
                    {matchWaitDetail}
                  </span>
                ) : null}
              </p>
            </CardPad>
          </Card>
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
          {loading ? <ValuationWorkLoadingSkeleton /> : null}
          {visitedScreens.has("basic") ? (
            <Activity mode={screenMode("basic")}>
              {assetTypeChangedNeedsReview({
                changedGroups: draft?.inspectorDataChangedGroups,
                settingsSaved,
              }) ? (
                <EngInfo variant="amber">{ASSET_TYPE_CHANGED_MESSAGE}</EngInfo>
              ) : null}
              <ApproachSettingsSection
                valuationRequestId={valuationRequestId}
                assignmentType={assignmentType}
                settings={approachSettings}
                hydrateKey={settingsHydrateKey}
                saving={saving}
                onSavingChange={setSaving}
                onSettingsSaved={onSettingsSaved}
                fieldErrors={fieldErrors}
                onRetrospectiveDraftChange={onRetrospectiveDraftChange}
                onDraftApproachesChange={onDraftApproachesChange}
                hasMarketWork={visibleAdoptedMarket.length > 0}
                hasCostWork={
                  (cost?.lines?.length ?? 0) > 0 || visibleAdoptedLand.length > 0
                }
              />
            </Activity>
          ) : null}
          {visitedScreens.has("market") ? (
            <Activity mode={screenMode("market")}>{renderMarket()}</Activity>
          ) : null}
          {visitedScreens.has("cost") ? (
            <Activity mode={screenMode("cost")}>
              {renderCost()}
              {settingsSaved && costTab ? (
                <Suspense fallback={<InlineLoadingSkeleton />}>
                  <CostApproachSection
                    valuationRequestId={valuationRequestId}
                    poNumber={poNumber}
                    propertyId={propertyId}
                    inspectionTaskId={inspectionTaskId}
                    inspectorChangedGroups={draft?.inspectorDataChangedGroups}
                    cost={cost}
                    hydrateKey={costHydrateKey}
                    buildingOnly={
                      (approachSettings?.costScopeKey ?? "land_and_building") ===
                      "building_only"
                    }
                    isApartmentProperty={isApartment}
                    deedArea={property?.area}
                    costBasisKey={approachSettings?.costBasisKey || "replacement"}
                    saving={saving}
                    locked={adjustmentsLocked}
                    onSavingChange={setSaving}
                    onCostSaved={onCostSaved}
                  />
                </Suspense>
              ) : null}
            </Activity>
          ) : null}
          {!loading && effectiveScreen === "final" && !settingsSaved
            ? notStartedCard("رأي القيمة النهائي")
            : null}
          {visitedScreens.has("final") ? (
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
                    poNumber={poNumber}
                    officialValuationDate={officialValuationDate}
                    fieldErrors={fieldErrors}
                    saving={saving}
                    onSavingChange={setSaving}
                    onReconSaved={onReconSaved}
                    marketAnalysisText={marketTab ? (narrativeDirty ? analysisNotes : autoNarrative) : ""}
                    costAnalysisEnabled={costTab}
                    costBasisKey={approachSettings?.costBasisKey || "replacement"}
                  />
                  {gates ? alertsPanel("general") : null}
                </Suspense>
              ) : null}
            </Activity>
          ) : null}
          {visitedScreens.has("review") ? (
            <Activity mode={screenMode("review")}>{renderReview()}</Activity>
          ) : null}
        </div>
      </div>
    </ValuationWorkErrorsProvider>
  );
}
