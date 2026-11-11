// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Split  The valuation-date block moved to ValuationDateFields; the date checks moved to the pure
//           approachSettingsDraftError (lib/approach-settings-form).
//  • Holds and sends the retrospective rationale (approachSettingsDraftRequestFields).
//  • Holds and sends the ownership interest and the remaining lease years (OwnershipInterestFields).
// Round 2 (1b19bedc)
//  • The approach toggles are reported to the nav only after the saved settings load (draftReady) —
//          the all-off defaults hid every approach tab and a refresh fell back to «البيانات الأساسية».
// Layout (2026-11-11)
//  • The card reads in the order of the decision: «what is valued» — scope · interest · date in
//          three columns — then «by which approach» — market and cost side by side, the cost
//          basis inside the cost card it belongs to — then the save. One sentence about the land
//          comparables instead of three; the unavailable income approach is one grey line.
// ──────────────────────────────────────────────────────────────────────────────────────────────

"use client";

import { memo, useEffect, useRef, useState } from "react";
import {
  getValuationApproachSettings,
  isNoExternalSpecialistAssumption,
  saveValuationApproachSettings,
  type ValuationApproachSettingsDto,
} from "@platform/api-client";
import { invalidControlClass } from "@platform/app-shared/form-ux";
import {
  cn,
  AppModal,
  Button,
  useToast,
  useWorkDensity,
} from "@platform/ui-kit";
import type { EvaluatorRetrospectiveDraft } from "../../../lib/evaluator/evaluator-validation";

import { valuationPurposeKeyForAssignment } from "@platform/app-shared/app-data/assignment-valuation-defaults";
import {
  Card,
  CardPad,
  CardTitle,
  FieldLabel,
  PrimaryBtn,
  ToggleChip,
} from "./atoms";

import { apiConfig } from "./lib/shell-utils";
import {
  OwnershipInterestFields,
  RetrospectiveFields,
  SETTINGS_FIELD_HINT,
  SETTINGS_FIELD_LABEL,
  SETTINGS_ROW_2,
  SETTINGS_ROW_3,
  ValuationDateModeField,
} from "./ApproachSettingsFields";
import {
  approachSettingsDraftError,
  approachSettingsDraftRequestFields,
  normalizeOwnershipInterestKey,
  type ApproachSettingsDraft,
} from "./lib/approach-settings-form";
import { useValuationWorkErrors } from "./ValuationWorkErrors";
import {
  approachesDisabledWithWork,
  disableApproachConfirmCopy,
  initialApproachToggles,
} from "./lib/valuation-data-state";
import {
  defaultSelectedSpecialAssumptions,
  shouldUseDefaultSpecialAssumptions,
} from "../../../lib/evaluator/special-assumption-rows";

/**
 * Basics screen — owns valuation settings drafts (approaches, scope, basis,
 * valuation date) locally: writes here do not re-render the valuation shell.
 * Reads top to bottom in the order of the decision: what is valued (scope, interest, date),
 * by which approach (the cost basis inside the cost card), then the save.
 * Rehydrates from the server payload via hydrateKey — bumps on full load and every settings save
 * (so an old draft cannot overwrite what was saved from the cost screen).
 */
/** One approach's card: the tick, its name and what the approach does. */
const APPROACH_CARD_HEAD = "flex items-start gap-2.5 px-3.5 py-[13px]";

export const ApproachSettingsSection = memo(function ApproachSettingsSection({
  valuationRequestId,
  assignmentType,
  settings,
  hydrateKey,
  saving,
  onSavingChange,
  onSettingsSaved,
  fieldErrors: sendErrors,
  onRetrospectiveDraftChange,
  hasMarketWork = false,
  hasCostWork = false,
  onDraftApproachesChange,
}: {
  valuationRequestId: string | null;
  assignmentType?: string;
  settings: ValuationApproachSettingsDto | null;
  hydrateKey: number;
  saving: boolean;
  onSavingChange: (saving: boolean) => void;
  onSettingsSaved: (dto: ValuationApproachSettingsDto) => void;
  fieldErrors?: Record<string, string>;
  onRetrospectiveDraftChange?: (draft: EvaluatorRetrospectiveDraft) => void;
  hasMarketWork?: boolean;
  hasCostWork?: boolean;
  onDraftApproachesChange?: (nav: { market: boolean; cost: boolean }) => void;
}) {
  const { showToast } = useToast();
  const {
    fieldErrors: workErrors,
    reportFieldError,
    reportSaveFailure,
    clearSaveErrors,
  } = useValuationWorkErrors();
  /** Send-time errors (snake_case keys) plus the last failed save (server keys). */
  const fieldErrors = { ...sendErrors, ...workErrors };
  const approachesError =
    fieldErrors.appliedApproaches ||
    fieldErrors.costApproachEnabled ||
    fieldErrors.incomeApproachEnabled ||
    fieldErrors.marketApproachEnabled ||
    fieldErrors.valuationPurposeKey ||
    fieldErrors.valuationPurposeNote ||
    "";
  const work = useWorkDensity();
  const [asMarketEnabled, setAsMarketEnabled] = useState(false);
  const [asCostEnabled, setAsCostEnabled] = useState(false);
  const [asCostBasis, setAsCostBasis] = useState("replacement");
  /** Cost valuation scope: land_and_building | building_only (interactive form spec). */
  const [asCostScope, setAsCostScope] = useState("land_and_building");
  const [asCostUnit, setAsCostUnit] = useState("comparison_unit");
  const [asPurpose, setAsPurpose] = useState(() =>
    valuationPurposeKeyForAssignment(assignmentType),
  );
  const [asPurposeNote, setAsPurposeNote] = useState("");
  const [asDateMode, setAsDateMode] = useState("issue");
  const [asRetroKind, setAsRetroKind] = useState<"single" | "range">("single");
  const [asRetroDate, setAsRetroDate] = useState("");
  const [asRetroDateEnd, setAsRetroDateEnd] = useState("");
  const [asRetroRationale, setAsRetroRationale] = useState("");
  const [asOwnership, setAsOwnership] = useState("freehold");
  const [asLeaseYears, setAsLeaseYears] = useState("");
  const [asAssumptions, setAsAssumptions] = useState<string[]>([]);
  const [confirmDisableOpen, setConfirmDisableOpen] = useState(false);
  /**
   * The toggles hold the saved settings (hydrated). Before that they are the useState defaults
   * (all off): reporting them hid every approach tab for a moment, and a refresh that had just
   * restored «طريقة المقاول» fell back to «البيانات الأساسية».
   */
  const [draftReady, setDraftReady] = useState(false);

  const hydratedKeyRef = useRef<number | null>(null);
  useEffect(() => {
    if (hydratedKeyRef.current === hydrateKey) return;
    hydratedKeyRef.current = hydrateKey;
    if (!settings) return;
    const toggles = initialApproachToggles(settings);
    setDraftReady(true);
    setAsMarketEnabled(toggles.market);
    setAsCostEnabled(toggles.cost);
    setAsCostBasis(settings.costBasisKey || "replacement");
    setAsCostScope(settings.costScopeKey || "land_and_building");
    setAsCostUnit(settings.costMeasurementUnitKey || "comparison_unit");
    setAsPurpose(
      settings.valuationPurposeKey ||
        valuationPurposeKeyForAssignment(assignmentType),
    );
    setAsPurposeNote(settings.valuationPurposeNote ?? "");
    setAsDateMode(settings.valuationDateMode || "issue");
    setAsRetroDate(settings.retrospectiveDate ?? "");
    setAsRetroDateEnd(settings.retrospectiveDateEnd ?? "");
    setAsRetroKind(settings.retrospectiveDateEnd?.trim() ? "range" : "single");
    setAsRetroRationale(settings.retrospectiveRationale ?? "");
    setAsOwnership(normalizeOwnershipInterestKey(settings.ownershipInterestKey));
    setAsLeaseYears(
      settings.remainingLeaseYears != null ? String(settings.remainingLeaseYears) : "",
    );
    const loadedAssumptions = settings.selectedAssumptions ?? [];
    const library = settings.assumptionLibrary ?? [];
    // When no saved selection exists: all special-assumption items are selected by default.
    setAsAssumptions(
      shouldUseDefaultSpecialAssumptions(loadedAssumptions)
        ? defaultSelectedSpecialAssumptions(
            library,
            settings.externalSpecialistUsed,
          )
        : settings.externalSpecialistUsed
          ? loadedAssumptions.filter((x) => !isNoExternalSpecialistAssumption(x))
          : loadedAssumptions,
    );
  }, [hydrateKey, settings, assignmentType]);

  useEffect(() => {
    onRetrospectiveDraftChange?.({
      mode: asDateMode,
      kind: asRetroKind,
      date: asRetroDate,
      dateEnd: asRetroDateEnd,
    });
  }, [
    asDateMode,
    asRetroKind,
    asRetroDate,
    asRetroDateEnd,
    onRetrospectiveDraftChange,
  ]);

  useEffect(() => {
    if (!draftReady) return;
    onDraftApproachesChange?.({
      market: asMarketEnabled,
      cost:
        asCostEnabled &&
        (settings?.costApproachAllowed ?? true) &&
        asCostScope !== "land_only",
    });
  }, [
    asMarketEnabled,
    asCostEnabled,
    asCostScope,
    draftReady,
    settings?.costApproachAllowed,
    onDraftApproachesChange,
  ]);

  const draft: ApproachSettingsDraft = {
    dateMode: asDateMode,
    retroKind: asRetroKind,
    retroDate: asRetroDate,
    retroDateEnd: asRetroDateEnd,
    retroRationale: asRetroRationale,
    ownershipKey: asOwnership,
    leaseYearsText: asLeaseYears,
  };

  async function saveApproachSettings() {
    const config = apiConfig();
    if (!config || !valuationRequestId) {
      // Otherwise the click does nothing at all — no toast, no saving indicator — and the
      // appraiser has no way to know their edits were never sent.
      showToast(
        "تعذّر حفظ الأساليب — الجلسة غير متاحة حالياً. أعد تحميل الصفحة أو سجّل الدخول من جديد.",
        "error",
      );
      return;
    }
    const draftError = approachSettingsDraftError(draft);
    if (draftError) {
      reportFieldError(draftError.key, draftError.message);
      return;
    }
    onSavingChange(true);
    const latest = await getValuationApproachSettings(config, valuationRequestId);
    let selectedAssumptions = latest.ok
      ? [...(latest.data.selectedAssumptions ?? [])]
      : [...asAssumptions];
    const library = latest.ok
      ? latest.data.assumptionLibrary
      : settings?.assumptionLibrary ?? [];
    const specialistUsed = latest.ok
      ? latest.data.externalSpecialistUsed
      : (settings?.externalSpecialistUsed ?? false);
    const specialistDetails = latest.ok
      ? latest.data.externalSpecialistDetails
      : settings?.externalSpecialistDetails;
    // Empty / auto-only «لم يستعن…» means never customized — persist the full library.
    if (shouldUseDefaultSpecialAssumptions(selectedAssumptions)) {
      selectedAssumptions = defaultSelectedSpecialAssumptions(
        library,
        specialistUsed,
      );
    } else if (specialistUsed) {
      selectedAssumptions = selectedAssumptions.filter(
        (x) => !isNoExternalSpecialistAssumption(x),
      );
    } else {
      const clause = library.find(isNoExternalSpecialistAssumption);
      if (clause && !selectedAssumptions.includes(clause)) {
        selectedAssumptions = [...selectedAssumptions, clause];
      }
    }
    const res = await saveValuationApproachSettings(config, valuationRequestId, {
      marketApproachEnabled: asMarketEnabled,
      costApproachEnabled:
        asCostEnabled &&
        (settings?.costApproachAllowed ?? true) &&
        asCostScope !== "land_only",
      // The income approach is not available yet — always sent off.
      incomeApproachEnabled: false,
      costBasisKey: asCostBasis,
      costScopeKey: asCostScope,
      costMeasurementUnitKey: asCostUnit,
      adjustmentsEditUnlocked: true,
      valuationPurposeKey:
        valuationPurposeKeyForAssignment(assignmentType) || asPurpose || null,
      valuationPurposeNote: asPurposeNote.trim() || null,
      externalSpecialistUsed: specialistUsed,
      externalSpecialistDetails: specialistDetails?.trim() || null,
      valuationDateMode: asDateMode,
      retrospectiveDate: asDateMode === "retrospective" ? asRetroDate || null : null,
      retrospectiveDateEnd:
        asDateMode === "retrospective" && asRetroKind === "range"
          ? asRetroDateEnd || null
          : null,
      ...approachSettingsDraftRequestFields(draft),
      selectedAssumptions,
    });
    onSavingChange(false);
    if (!res.ok) {
      const fallback =
        res.kind === "auth"
          ? "انتهت الجلسة — سجّل الدخول مجدداً ثم أعد الحفظ."
          : res.kind === "network"
            ? "تعذّر الاتصال بالخادم — تحقق من اتصالك بالإنترنت وأعد المحاولة."
            : "تعذّر حفظ الأساليب — أعد المحاولة بعد قليل، وإن تكرر الخطأ تواصل مع الدعم الفني.";
      reportSaveFailure(res, fallback);
      return;
    }
    clearSaveErrors();
    showToast(
      settings?.isSaved ? "تم حفظ الأساليب" : "تم بدء التقييم",
      "success",
    );
    onSettingsSaved(res.data);
  }

  const settingsSaved = settings?.isSaved ?? false;
  const isLandKind = settings?.isLandPropertyType ?? false;
  // Buildings can be valued (property is not land, or the specialist listed components).
  const buildingsAllowed = settings?.costApproachAllowed ?? true;
  const costAllowed = buildingsAllowed && asCostScope !== "land_only";
  const nextCostEnabled = asCostEnabled && costAllowed;
  /** The cost card is ticked and applies — its basis opens inside it. */
  const costOn = nextCostEnabled;
  // The card names the cost by the basis chosen under it («الإحلال» stood there even on «إعادة الإنتاج»).
  const costBasisWord = asCostBasis === "reproduction" ? "تكلفة إعادة الإنتاج" : "تكلفة الإحلال";

  function chooseScope(next: "land_only" | "building_only" | "land_and_building") {
    setAsCostScope(next);
    // «أرض فقط» values no buildings; «مباني فقط» starts with the cost approach ticked, but the
    // appraiser may untick it and value by the market approach alone (an apartment — A→Z #44).
    if (next === "land_only") setAsCostEnabled(false);
    if (next === "building_only") setAsCostEnabled(true);
  }
  const droppingWithWork = settingsSaved
    ? approachesDisabledWithWork({
        savedMarketEnabled: settings?.marketApproachEnabled ?? false,
        savedCostEnabled: settings?.costApproachEnabled ?? false,
        nextMarketEnabled: asMarketEnabled,
        nextCostEnabled,
        hasMarketWork,
        hasCostWork,
      })
    : [];
  const confirmCopy = disableApproachConfirmCopy(droppingWithWork);

  function requestSave() {
    if (!asMarketEnabled && !nextCostEnabled) {
      reportFieldError("appliedApproaches", "يلزم تفعيل أسلوب واحد على الأقل");
      return;
    }
    if (confirmCopy) {
      setConfirmDisableOpen(true);
      return;
    }
    void saveApproachSettings();
  }

  return (
    <>
      <Card>
        <CardPad>
          {/* The appraiser's page (work density): the section's header carries the title. */}
          {work ? null : <CardTitle>أساليب وطرق التقييم المستخدمة</CardTitle>}

          {/* 1 — what is valued: scope · interest · date, one column each. */}
          <div className={cn(SETTINGS_ROW_3, "mb-4")}>
            <div>
              <span className={SETTINGS_FIELD_LABEL}>نطاق التقييم</span>
              <div
                id="as-scope"
                className={cn(
                  "flex flex-wrap gap-2 rounded-[10px]",
                  fieldErrors.costScopeKey && invalidControlClass,
                )}
              >
                <ToggleChip
                  active={asCostScope === "land_only"}
                  disabled={saving}
                  onClick={() => chooseScope("land_only")}
                >
                  أرض فقط
                </ToggleChip>
                <ToggleChip
                  active={asCostScope === "building_only"}
                  disabled={saving || !buildingsAllowed}
                  onClick={() => chooseScope("building_only")}
                >
                  مباني فقط
                </ToggleChip>
                <ToggleChip
                  active={asCostScope === "land_and_building"}
                  disabled={saving || !buildingsAllowed}
                  onClick={() => chooseScope("land_and_building")}
                >
                  أرض مع المباني
                </ToggleChip>
              </div>
              {fieldErrors.costScopeKey ? (
                <p className="mb-0 mt-1.5 text-[11px] text-danger-text">
                  {fieldErrors.costScopeKey}
                </p>
              ) : null}
              <p className={SETTINGS_FIELD_HINT}>
                {!buildingsAllowed
                  ? "لا توجد مكونات محصورة لدى الأخصائي — التقييم أرض فقط."
                  : asCostScope === "land_only"
                    ? "مكونات العقار تُطبع في التقرير ولا تدخل في القيمة (مثل مبانٍ هالكة)."
                    : asCostScope === "building_only"
                      ? "تُقيَّم المباني وحدها دون تقدير الأرض — بأسلوب التكلفة، أو بأسلوب السوق للعقار ككل (كالشقة)."
                      : "تُقيَّم الأرض مع المكونات المحصورة."}
              </p>
            </div>
            <OwnershipInterestFields
              saving={saving}
              fieldErrors={fieldErrors}
              ownershipKey={asOwnership}
              onOwnershipKeyChange={setAsOwnership}
              leaseYearsText={asLeaseYears}
              onLeaseYearsTextChange={setAsLeaseYears}
            />
            <ValuationDateModeField
              saving={saving}
              invalid={Boolean(fieldErrors.valuationDateMode)}
              dateMode={asDateMode}
              onDateModeChange={setAsDateMode}
            />
          </div>
          {asDateMode === "retrospective" ? (
            <RetrospectiveFields
              saving={saving}
              fieldErrors={fieldErrors}
              retroKind={asRetroKind}
              onRetroKindChange={setAsRetroKind}
              retroDate={asRetroDate}
              onRetroDateChange={setAsRetroDate}
              retroDateEnd={asRetroDateEnd}
              onRetroDateEndChange={setAsRetroDateEnd}
              retroRationale={asRetroRationale}
              onRetroRationaleChange={setAsRetroRationale}
            />
          ) : null}

          {/* 2 — by which approach: market and cost side by side; the cost basis lives in the cost card. */}
          <div className="border-t border-border pt-4">
            <span className={SETTINGS_FIELD_LABEL}>أساليب التقييم</span>
            <div
              id="as-approaches"
              className={cn(
                // A narrow card (a phone, or the page with its rail): one approach card per line.
                SETTINGS_ROW_2,
                "rounded-[10px] !gap-3",
                approachesError && invalidControlClass,
              )}
            >
              <label
                className={cn(
                  APPROACH_CARD_HEAD,
                  "cursor-pointer rounded-[10px] border",
                  asMarketEnabled
                    ? "border-gold bg-gold-soft"
                    : "border-border-md bg-surface",
                )}
              >
                <input
                  type="checkbox"
                  checked={asMarketEnabled}
                  disabled={saving}
                  onChange={(e) => setAsMarketEnabled(e.target.checked)}
                  className="mt-0.5 size-[17px] accent-[var(--ink)]"
                />
                <div>
                  <div className="text-[12.5px] font-bold text-heading">
                    أسلوب السوق
                  </div>
                  <div className="mt-[3px] text-[11px] font-normal text-text-3">
                    طريقة المقارنة — يقارن العقار كوحدة غير مجزّأة بصفقات مشابهة
                  </div>
                </div>
              </label>

              {/* The tick and its text are the label; the basis below is outside it, so pressing
                  a basis chip or its hint never flips the tick. */}
              <div
                className={cn(
                  "overflow-hidden rounded-[10px] border",
                  costOn ? "border-gold" : "border-border-md",
                  !costAllowed && "opacity-55",
                )}
              >
                <label
                  className={cn(
                    APPROACH_CARD_HEAD,
                    costOn ? "bg-gold-soft" : "bg-surface",
                    costAllowed ? "cursor-pointer" : "cursor-not-allowed",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={costOn}
                    disabled={saving || !costAllowed}
                    onChange={(e) => setAsCostEnabled(e.target.checked)}
                    className="mt-0.5 size-[17px] accent-[var(--ink)]"
                  />
                  <div>
                    <div className="text-[12.5px] font-bold text-heading">
                      أسلوب التكلفة
                    </div>
                    <div className="mt-[3px] text-[11px] font-normal text-text-3">
                      {!costAllowed
                        ? isLandKind && !buildingsAllowed
                          ? "لا ينطبق: أرض بلا مكونات محصورة"
                          : "لا ينطبق: نطاق التقييم «أرض فقط»"
                        : asCostScope === "building_only"
                          ? `${costBasisWord} ناقصاً الإهلاك — دون تقدير الأرض بالمقارنات`
                          : `أسلوب مركّب: قيمة الأرض بمقارنات أراضٍ تُعتمد داخل قسمه + ${costBasisWord} ناقصاً الإهلاك`}
                    </div>
                  </div>
                </label>
                {costOn ? (
                  <div className="border-t border-border bg-surface px-3.5 pb-3 pt-2.5">
                    <FieldLabel>طريقة تقدير التكلفة</FieldLabel>
                    <div
                      id="as-cost-basis"
                      className={cn(
                        "mt-2 flex flex-wrap gap-2 rounded-[10px]",
                        fieldErrors.costBasisKey && invalidControlClass,
                      )}
                    >
                      <ToggleChip
                        active={asCostBasis === "replacement"}
                        disabled={saving}
                        onClick={() => setAsCostBasis("replacement")}
                      >
                        الإحلال
                      </ToggleChip>
                      <ToggleChip
                        active={asCostBasis === "reproduction"}
                        disabled={saving}
                        onClick={() => setAsCostBasis("reproduction")}
                      >
                        إعادة الإنتاج
                      </ToggleChip>
                    </div>
                    <p className={SETTINGS_FIELD_HINT}>
                      {asCostBasis === "reproduction"
                        ? "تكلفة إنتاج نسخة طبق الأصل بالمواد والتصميم نفسيهما — تُستخدم للمباني التراثية والخاصة."
                        : "تكلفة إنشاء بديل بمنفعة مكافئة بمواد وطرق اليوم."}
                    </p>
                    {asCostScope === "building_only" && asMarketEnabled ? (
                      <p className="mb-0 mt-1.5 text-[10.5px] leading-relaxed text-gold-d">
                        أسلوب السوق مفعّل، فتلزم مقارناته للعقار ككل — عطّله إن كان التقييم
                        بالتكلفة وحدها.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Not available yet: one grey line, so the appraiser sees the third approach exists. */}
            <label
              title="قيد الإنشاء — غير متاح بعد"
              className="mt-2.5 flex w-fit cursor-not-allowed items-center gap-2 text-[11.5px] opacity-55"
            >
              <input type="checkbox" checked={false} disabled className="size-[15px]" />
              <span className="font-bold text-heading">أسلوب الدخل</span>
              <span className="text-text-3">قيد الإنشاء — غير متاح بعد</span>
            </label>

            {approachesError ? (
              <p className="mb-0 mt-2 text-[11px] text-danger-text">{approachesError}</p>
            ) : null}
          </div>

          {/* 3 — save, with what saving does beside it. */}
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2.5">
            <PrimaryBtn disabled={saving} onClick={requestSave}>
              {settingsSaved ? "حفظ الأساليب" : "بدء التقييم"}
            </PrimaryBtn>
            {settingsSaved ? (
              <p className="m-0 min-w-[14rem] flex-1 text-[11.5px] leading-relaxed text-text-3">
                حدّد الأسلوب ليظهر قسم طريقته فوراً. احفظ ليثبت الاختيار في
                التقرير. إلغاء أسلوب يخفي قسمه دون حذف العمل.
              </p>
            ) : (
              <p className="m-0 min-w-[14rem] flex-1 rounded-[var(--radius)] bg-[var(--amber-light)] px-2.5 py-2 text-[11.5px] text-[var(--amber-text)]">
                حدّد أسلوب السوق أو التكلفة ليظهر قسم العمل، ثم ابدأ التقييم.
              </p>
            )}
          </div>
        </CardPad>
      </Card>
      <AppModal
        open={confirmDisableOpen}
        title="إخفاء قسم أسلوب"
        onClose={() => setConfirmDisableOpen(false)}
        footer={
          <>
            <Button type="button" onClick={() => setConfirmDisableOpen(false)}>
              البقاء
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                setConfirmDisableOpen(false);
                void saveApproachSettings();
              }}
            >
              متابعة الحفظ
            </Button>
          </>
        }
      >
        <p className="m-0 text-[13px] leading-6 text-text-2">{confirmCopy}</p>
      </AppModal>
    </>
  );
});
