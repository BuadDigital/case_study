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
// Grey areas (2026-11-10)
//  • The apartment test is the shared textLooksLikeApartment («شقه», Apartment, flat count too).
// ──────────────────────────────────────────────────────────────────────────────────────────────

"use client";

import {
  Activity,
  Suspense,
  useCallback,
  useEffect,
  useState,
} from "react";
import { InlineLoadingSkeleton, WorkSectionFieldsSkeleton, cn } from "@platform/ui-kit";
import { textLooksLikeApartment } from "@platform/app-shared/app-data/inspector-workspace-data";
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
import { EngInfo, WORK_SECTION_TOP_GAP } from "../EvaluatorHtmlPrimitives";
import {
  ASSET_TYPE_CHANGED_MESSAGE,
  assetTypeChangedNeedsReview,
} from "../../../lib/evaluator/inspector-data-changes";
import { ComparablesBankTable } from "./ComparablesBankTable";
import { MethodologyAlertsPanel } from "./MethodologyAlertsPanel";
import { fmtChainValue, roundStepLabel } from "./lib/adjustments-matrix-state";
import { fmt } from "./lib/shell-utils";
import { fmtMax } from "@platform/app-shared/format/number";
import { marketSubjectAreaLabel } from "./lib/market-subject";
import {
  buildNavItems,
  currentWorkScreen,
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

const SCREEN_LOADING_LABEL = "جاري تحميل مساحة عمل التقييم";

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
  renderSections,
  studyReportPending = false,
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
    landBankRows,
    landBankDistanceKm,
    subjectAreaNum,
    reload,
    bankSubjectCoords,
  } = data;
  // One apartment test app-wide (2026-11-10): «شقه» / «شقق» / Apartment / flat are units too, so the
  // deed area is never seeded as the building plot for them (was `.includes("شقة")` only).
  const isApartment = textLooksLikeApartment(approachSettings?.propertyType);
  // The land table's own area — the whole plot, never the apartment's floor area.
  const landPlotSqm = landSelection?.subjectAreaSqm ?? cost?.landAreaSqm ?? 0;

  const {
    onAdoptMarket,
    onAdoptLand,
    onRemoveMarket,
    onRemoveLand,
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
            لم يبدأ التقييم بعد، فلا تُفتح «{screenLabel}». ارجع إلى «أساليب وطرق التقييم» واضغط «بدء
            التقييم» — إن لم يبدأ تظهر رسالة بالحقل الناقص وتنتقل إليه (مثل مبرر التقييم بأثر رجعي).
          </p>
          <GhostBtn onClick={() => setScreen("basic")}>الانتقال إلى أساليب وطرق التقييم</GhostBtn>
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
    // 2026-11-10: the rounded market value — the figure the reconciliation and the report read
    // (the matrix below shows the unrounded one beside it).
    const marketValue = selection?.marketOpinionValue ?? 0;
    const marketRounded =
      selection?.marketOpinionValueRaw != null && selection.marketOpinionValueRaw !== marketValue;
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
                    value: fmtChainValue(selection?.weightedPricePerSqm, marketIsUnit),
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
            (marketIsUnit
              ? `سعر المتر × ${marketSubjectAreaLabel(marketKind)}`
              : "قيمة العقار بعد التسوية") +
            (marketRounded ? ` — ${roundStepLabel(selection?.valueRoundDecimals)} =` : " =")
          }
          result={marketReady ? fmt(marketValue) : "غير مكتمل — يلزم اعتماد مقارن"}
          resultTone={marketReady ? "heading" : "danger"}
        />

        {/* `mx-bank`: where «جاهزية تسليم التقييم» lands for a missing adopted comparable. */}
        <div id="mx-bank">
          <ComparablesBankTable
            rows={bankRows}
            subjectSqm={subjectAreaNum}
            distanceKm={bankDistanceKm}
            onAdopt={onAdoptMarket}
            onRemove={onRemoveMarket}
            onSaveOverride={onSaveBankOverride}
            seed={comparableSeed}
            sourceWorkOrderNumber={poNumber}
            sourcePropertyId={propertyId}
            onCreated={onBankCreated}
          />
        </div>

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
    // Omar 2026-11-12 («الأرض هي الأرض وقيمتها ثابتة»): a subject valued as land has one table —
    // the market approach's. With that approach on, the land is read here and edited there.
    const oneLandTable = landSelection?.landSharedWithMarket === true;
    const landFromMarket = oneLandTable && marketTab;

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
              {landFromMarket
                ? "أرض العقار قُيّمت في أسلوب السوق — مقارناتها وتسوياتها وأوزانها واحدة في الأسلوبين، وتُعدَّل من أسلوب السوق."
                : oneLandTable
                  ? "مكوّن داخل أسلوب التكلفة — ناتجه قيمة الأرض ولا يدخل الترجيح بين الأساليب. مقارناته وتسوياته هي نفسها في أسلوب السوق."
                  : "مكوّن داخل أسلوب التكلفة — ناتجه قيمة الأرض ولا يدخل الترجيح بين الأساليب. مقارناته أراضٍ خام مستقلة عن مقارنات أسلوب السوق."}
            </div>
            {landFromMarket ? (
              <div data-testid="cost-land-from-market" className="mt-2 flex flex-wrap items-center gap-3">
                <span className="text-[12px] font-bold text-heading">
                  {visibleAdoptedLand.length > 0
                    ? `سعر متر الأرض بعد التسويات: ${fmtMax(cost?.landUnitRateFromMarket)} ر.س. — المقارنات المعتمدة: ${visibleAdoptedLand.length}`
                    : "لا مقارنات معتمدة في أسلوب السوق بعد"}
                </span>
                <GhostBtn onClick={() => setScreen("market")}>الانتقال إلى أسلوب السوق</GhostBtn>
              </div>
            ) : null}
            {/* The land comparables are adjusted against the whole plot. */}
            {isApartment ? (
              <div data-testid="apartment-plot-hint" className="mt-1 text-[11.5px] font-bold text-heading">
                {apartmentLandHint(cost)}
              </div>
            ) : null}
          </div>
        </div>

        {landFromMarket ? null : (
        <>
        <ComparablesBankTable
          rows={landBankRows}
          subjectSqm={landPlotSqm || (isApartment ? null : subjectAreaNum)}
          distanceKm={landBankDistanceKm}
          landOnly
          onAdopt={onAdoptLand}
          onRemove={onRemoveLand}
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
              // One land table: the area row shows the area the shared comparison was made against —
              // the market table's — while the value below stays rate × the cost approach's plot.
              idealArea={
                oneLandTable ? subjectArea : landPlotSqm ? String(landPlotSqm) : isApartment ? "" : subjectArea
              }
              city={property?.city}
              district={property?.district ?? districtHint}
              valuationDate={officialValuationDate ?? undefined}
              // The subject's description per factor is one per valuation (the report prints it in
              // both tables). Fixed 2026-11-04 (PO-072172, cost only): the land table showed «—»
              // in the subject column with no way to fill it, since only the market table edited it.
              subjectSpecs={{ ...landSelection.subjectSpecs, ...subjectSpecs }}
              canEditSubjectSpec
              dispatch={dispatchLandMatrix}
            />
          </Suspense>
        ) : null}
        </>
        )}

        </>
        ) : (
          <div className="mb-4 rounded-[10px] border border-border bg-surface-2 px-4 py-3 text-[12.5px] text-text-2">
            النطاق «مبنى فقط» — قسم تقدير الأرض مخفي ومؤشر الأسلوب = تكلفة الإحلال
            ناقصاً الإهلاك. يُغيَّر النطاق من «أساليب وطرق التقييم».
          </div>
        )}
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
        nav={{ market: marketTab, cost: costTab }}
        valuationStarted={settingsSaved}
      />
    );
  }

  const buildingOnly =
    (approachSettings?.costScopeKey ?? "land_and_building") === "building_only";

  /** The deed-match notice and the load error — above the screens in both layouts. */
  const deedMatchCard = deedMatchPending ? (
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
  ) : null;
  const errorLine = error ? (
    <p className="mb-3 text-[12.5px] text-red-text">
      {error}
    </p>
  ) : null;

  const basicNode = (
    <>
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
    </>
  );
  const costNode = (
    <>
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
            buildingOnly={buildingOnly}
            isApartmentProperty={isApartment}
            deedArea={property?.area}
            costBasisKey={approachSettings?.costBasisKey || "replacement"}
            ownershipInterestKey={approachSettings?.ownershipInterestKey ?? null}
            saving={saving}
            locked={adjustmentsLocked}
            inventoryApproved={!studyReportPending}
            onSavingChange={setSaving}
            onCostSaved={onCostSaved}
            // After the cost tables, not before them, and only once the direct costs are saved
            // (2026-11-11): the appraiser read «لا يوجد بند تكلفة» before reaching — or saving —
            // the table it speaks about.
            alerts={gates ? alertsPanel("cost") : null}
          />
        </Suspense>
      ) : null}
    </>
  );
  const finalNode = settingsSaved ? (
    <Suspense fallback={<InlineLoadingSkeleton />}>
      <FinalOpinionSection
        valuationRequestId={valuationRequestId}
        recon={recon}
        gates={gates}
        cost={cost}
        hydrateKey={reconHydrateKey}
        buildingOnly={buildingOnly}
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
  ) : null;

  /*
   * Sections layout (the appraiser's page, 2026-11-10): every screen is handed to the page's
   * sections frame as its own node, so several can be open at once.
   *
   * How it works: the frame decides what is mounted and shown; this shell only builds the nodes.
   * The approaches form stays rendered while the data loads (hidden), as it always was, so it
   * hydrates from the saved settings; the other screens wait for the load. While it loads, every
   * screen shows field placeholders inside its own section — not the tabs layout's three cards
   * above the frame, which pushed the sections down and then vanished (fixed 2026-11-10).
   * "current" is the screen
   * the valuation stands at (the rail's current step) — null while loading or once the package is
   * locked.
   * Edge cases: the page drops the section of an approach that is off (onNavAvailabilityChange);
   * a screen opened before «بدء التقييم» shows the same «لم يبدأ التقييم» card as the tabs layout.
   */
  if (renderSections) {
    return (
      <ValuationWorkErrorsProvider fieldErrors={fieldErrors} onScreenChange={setScreen}>
        <div dir="rtl" className="relative">
          {renderSections({
            lead: (
              <>
                {deedMatchCard}
                {errorLine}
              </>
            ),
            screens: {
              basic: (
                <>
                  {loading ? <WorkSectionFieldsSkeleton label={SCREEN_LOADING_LABEL} /> : null}
                  {/* The section's body has no top padding of its own; the shared gap keeps the
                      first labels off the header's rule. */}
                  <div hidden={loading} className={WORK_SECTION_TOP_GAP}>
                    {basicNode}
                  </div>
                </>
              ),
              market: loading ? <WorkSectionFieldsSkeleton label={SCREEN_LOADING_LABEL} /> : renderMarket(),
              cost: loading ? <WorkSectionFieldsSkeleton label={SCREEN_LOADING_LABEL} /> : costNode,
              final: loading ? (
                <WorkSectionFieldsSkeleton label={SCREEN_LOADING_LABEL} />
              ) : (
                (finalNode ?? notStartedCard("رأي القيمة النهائي"))
              ),
              review: loading ? (
                <WorkSectionFieldsSkeleton label={SCREEN_LOADING_LABEL} />
              ) : (
                // The shared top gap (its first heading sat on the header's rule).
                <div className={WORK_SECTION_TOP_GAP}>{renderReview()}</div>
              ),
            },
            current:
              loading || disabled
                ? null
                : currentWorkScreen({
                    settingsSaved,
                    marketEnabled: marketTab,
                    marketDone:
                      visibleAdoptedMarket.length > 0 && (selection?.marketOpinionValue ?? 0) > 0,
                    costEnabled: costTab,
                    costDone:
                      (cost?.lines?.length ?? 0) > 0 &&
                      (buildingOnly || Boolean(cost?.landEstimateComplete)),
                    finalDone: (recon?.finalOpinionValue ?? 0) > 0,
                  }),
          })}
        </div>
      </ValuationWorkErrorsProvider>
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

        {deedMatchCard}

        <div
          className={cn(
            "relative pb-2",
            embeddedInTopTabs ? "pt-0" : "py-[18px]",
          )}
        >
          {errorLine}
          {loading ? <ValuationWorkLoadingSkeleton /> : null}
          {visitedScreens.has("basic") ? (
            <Activity mode={screenMode("basic")}>{basicNode}</Activity>
          ) : null}
          {visitedScreens.has("market") ? (
            <Activity mode={screenMode("market")}>{renderMarket()}</Activity>
          ) : null}
          {visitedScreens.has("cost") ? (
            <Activity mode={screenMode("cost")}>{costNode}</Activity>
          ) : null}
          {!loading && effectiveScreen === "final" && !settingsSaved
            ? notStartedCard("رأي القيمة النهائي")
            : null}
          {visitedScreens.has("final") ? (
            <Activity mode={screenMode("final")}>{finalNode}</Activity>
          ) : null}
          {visitedScreens.has("review") ? (
            <Activity mode={screenMode("review")}>{renderReview()}</Activity>
          ) : null}
        </div>
      </div>
    </ValuationWorkErrorsProvider>
  );
}
