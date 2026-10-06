"use client";

import { memo, useEffect, useRef, useState } from "react";
import {
  getValuationApproachSettings,
  isNoExternalSpecialistAssumption,
  saveValuationApproachSettings,
  type ValuationApproachSettingsDto,
} from "@platform/api-client";
import { invalidControlClass } from "@platform/app-shared/form-ux";
import { cn, opsFldControl, AppModal, Button, useToast } from "@platform/ui-kit";
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
 * Rehydrates from the server payload via hydrateKey — bumps on full load and every settings save
 * (so an old draft cannot overwrite what was saved from the cost screen).
 */
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
  const [asAssumptions, setAsAssumptions] = useState<string[]>([]);
  const [confirmDisableOpen, setConfirmDisableOpen] = useState(false);

  const hydratedKeyRef = useRef<number | null>(null);
  useEffect(() => {
    if (hydratedKeyRef.current === hydrateKey) return;
    hydratedKeyRef.current = hydrateKey;
    if (!settings) return;
    const toggles = initialApproachToggles(settings);
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
    settings?.costApproachAllowed,
    onDraftApproachesChange,
  ]);

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
    if (asDateMode === "retrospective") {
      if (!asRetroDate.trim()) {
        reportFieldError("retrospectiveDate", "تاريخ الأثر الرجعي إلزامي");
        return;
      }
      if (asRetroKind === "range") {
        if (!asRetroDateEnd.trim()) {
          reportFieldError("retrospectiveDateEnd", "حدّد تاريخ نهاية الفترة");
          return;
        }
        if (asRetroDateEnd < asRetroDate) {
          reportFieldError(
            "retrospectiveDateEnd",
            "تاريخ النهاية يجب ألا يسبق تاريخ البداية",
          );
          return;
        }
      }
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
      retrospectiveRationale: null,
      selectedAssumptions,
    });
    onSavingChange(false);
    if (!res.ok) {
      const fallback =
        res.kind === "auth"
          ? "انتهت صلاحية الجلسة — سجّل الدخول من جديد ثم أعد الحفظ."
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

  function chooseScope(next: "land_only" | "building_only" | "land_and_building") {
    setAsCostScope(next);
    // «أرض فقط» values no buildings; «مباني فقط» is valued by cost.
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
          <CardTitle>أساليب وطرق التقييم المستخدمة</CardTitle>
          <FieldLabel>نطاق التقييم</FieldLabel>
          <div
            id="as-scope"
            className={cn(
              "my-2 mb-1.5 flex flex-wrap gap-2 rounded-[10px]",
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
          <p className="mb-4 mt-0 text-[10.5px] text-text-3">
            {!buildingsAllowed
              ? "لا توجد مكونات محصورة لدى الأخصائي — التقييم أرض فقط."
              : asCostScope === "land_only"
                ? "مكونات العقار تُطبع في التقرير ولا تدخل في القيمة (مثل مبانٍ هالكة)."
                : asCostScope === "building_only"
                  ? "تُقيَّم المكونات المحصورة وحدها بأسلوب التكلفة، دون تقدير الأرض."
                  : "تُقيَّم الأرض مع المكونات المحصورة."}
          </p>
          <div
            id="as-approaches"
            className={cn(
              "mb-4 grid grid-cols-3 gap-3 rounded-[10px]",
              approachesError && invalidControlClass,
            )}
          >
            <label
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-[10px] border px-3.5 py-[13px]",
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
            <label
              className={cn(
                "flex items-start gap-2.5 rounded-[10px] border px-3.5 py-[13px]",
                asCostEnabled && costAllowed
                  ? "border-gold bg-gold-soft"
                  : "border-border-md bg-surface",
                costAllowed
                  ? "cursor-pointer"
                  : "cursor-not-allowed opacity-55",
              )}
            >
              <input
                type="checkbox"
                checked={asCostEnabled && costAllowed}
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
                      ? "تكلفة الإحلال ناقصاً الإهلاك — دون تقدير الأرض بالمقارنات"
                      : "أسلوب مركّب: قيمة الأرض بالمقارنات + تكلفة الإحلال ناقصاً الإهلاك"}
                </div>
              </div>
            </label>
            <label
              title="قيد الإنشاء — غير متاح بعد"
              className="flex cursor-not-allowed items-start gap-2.5 rounded-[10px] border border-border-md bg-surface px-3.5 py-[13px] opacity-55"
            >
              <input
                type="checkbox"
                checked={false}
                disabled
                className="mt-0.5 size-[17px]"
              />
              <div>
                <div className="text-[12.5px] font-bold text-heading">
                  أسلوب الدخل
                </div>
                <div className="mt-[3px] text-[11px] font-normal text-text-3">
                  قيد الإنشاء — غير متاح بعد
                </div>
              </div>
            </label>
          </div>

          {approachesError ? (
            <p className="mb-3 mt-[-8px] text-[11px] text-danger-text">
              {approachesError}
            </p>
          ) : null}
          {asCostEnabled && costAllowed && asCostScope !== "building_only" ? (
            <p className="mb-3 text-[11.5px] text-gold-d">
              طريقة المقاول تستلزم تقييم أرض المبنى بطريقة المقارنة.
            </p>
          ) : null}

          {asCostEnabled && costAllowed ? (
            <div className="mb-4 border-t border-border pt-4">
              <p className="mb-3.5 mt-0 text-[10.5px] text-text-3">
                {asCostScope === "building_only"
                  ? "«مباني فقط» لا يستلزم مقارنات أرض. إن بقي أسلوب السوق مفعّلاً فستلزم مقارناته للعقار ككل — عطّله إن كان التقييم بالتكلفة وحدها."
                  : "«أرض مع المباني» يستلزم تقدير الأرض بالمقارنات داخل أسلوب التكلفة."}
              </p>
              <FieldLabel>طريقة تقدير التكلفة</FieldLabel>
              <div
                id="as-cost-basis"
                className={cn(
                  "my-2 mb-1.5 flex flex-wrap gap-2 rounded-[10px]",
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
              <p className="mb-3.5 mt-0 text-[10.5px] text-text-3">
                {asCostBasis === "reproduction"
                  ? "تكلفة إنتاج نسخة طبق الأصل بالمواد والتصميم نفسيهما — تُستخدم للمباني التراثية والخاصة."
                  : "تكلفة إنشاء بديل بمنفعة مكافئة بمواد وطرق اليوم."}
              </p>
            </div>
          ) : null}

          <div className="mb-4 border-t border-border pt-4">
            <FieldLabel>تاريخ التقييم</FieldLabel>
            <div
              id="as-valuation-date"
              className={cn(
                "my-2 mb-1.5 grid grid-cols-2 gap-2.5 max-sm:grid-cols-1 rounded-[10px]",
                fieldErrors.valuationDateMode && invalidControlClass,
              )}
            >
              <button
                type="button"
                disabled={saving}
                onClick={() => setAsDateMode("issue")}
                className={cn(
                  "rounded-[var(--radius)] border px-3.5 py-3 text-start transition-[background,border-color] duration-150",
                  asDateMode !== "retrospective"
                    ? "border-gold bg-gold-soft"
                    : "border-border-md bg-surface",
                  saving ? "cursor-not-allowed opacity-55" : "cursor-pointer",
                )}
              >
                <div className="text-[12.5px] font-bold text-heading">
                  تاريخ إصدار القيمة
                </div>
                <div className="mt-1 text-[10.5px] leading-relaxed text-text-3">
                  القيمة كما في تاريخ إصدار التقرير
                </div>
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setAsDateMode("retrospective")}
                className={cn(
                  "rounded-[var(--radius)] border px-3.5 py-3 text-start transition-[background,border-color] duration-150",
                  asDateMode === "retrospective"
                    ? "border-gold bg-gold-soft"
                    : "border-border-md bg-surface",
                  saving ? "cursor-not-allowed opacity-55" : "cursor-pointer",
                )}
              >
                <div className="text-[12.5px] font-bold text-heading">
                  أثر رجعي
                </div>
                <div className="mt-1 text-[10.5px] leading-relaxed text-text-3">
                  قيمة في تاريخ أو فترة سابقة
                </div>
              </button>
            </div>

            {asDateMode === "retrospective" ? (
              <div className="mt-3 rounded-[var(--radius)] border border-border bg-surface-2 px-3.5 py-3.5">
                <FieldLabel>صيغة الأثر الرجعي</FieldLabel>
                <div className="my-2 mb-1.5 flex flex-wrap gap-2">
                  <ToggleChip
                    active={asRetroKind === "single"}
                    disabled={saving}
                    onClick={() => {
                      setAsRetroKind("single");
                      setAsRetroDateEnd("");
                    }}
                  >
                    تاريخ محدد
                  </ToggleChip>
                  <ToggleChip
                    active={asRetroKind === "range"}
                    disabled={saving}
                    onClick={() => setAsRetroKind("range")}
                  >
                    فترة بين تاريخين
                  </ToggleChip>
                </div>

                {asRetroKind === "single" ? (
                  <div className="mt-2.5 max-w-[14rem]">
                    <label
                      htmlFor="as-retro-date"
                      className="mb-1.5 block text-[11px] font-semibold text-text-2"
                    >
                      تاريخ الأثر الرجعي
                    </label>
                    <input
                      id="as-retro-date"
                      type="date"
                      dir="ltr"
                      value={asRetroDate}
                      onChange={(e) => setAsRetroDate(e.target.value)}
                      className={cn(
                        opsFldControl,
                        "font-semibold",
                        (fieldErrors.retrospective_date ||
                          fieldErrors.retrospectiveDate) &&
                          invalidControlClass,
                      )}
                    />
                  </div>
                ) : (
                  <div className="mt-2.5 grid grid-cols-2 gap-2.5 max-sm:grid-cols-1">
                    <div>
                      <label
                        htmlFor="as-retro-date-from"
                        className="mb-1.5 block text-[11px] font-semibold text-text-2"
                      >
                        من تاريخ
                      </label>
                        <input
                          id="as-retro-date-from"
                          type="date"
                          dir="ltr"
                          value={asRetroDate}
                          onChange={(e) => setAsRetroDate(e.target.value)}
                          className={cn(
                            opsFldControl,
                            "font-semibold",
                            (fieldErrors.retrospective_date_from ||
                              fieldErrors.retrospectiveDate) &&
                              invalidControlClass,
                          )}
                        />
                    </div>
                    <div>
                      <label
                        htmlFor="as-retro-date-to"
                        className="mb-1.5 block text-[11px] font-semibold text-text-2"
                      >
                        إلى تاريخ
                      </label>
                        <input
                          id="as-retro-date-to"
                          type="date"
                          dir="ltr"
                          value={asRetroDateEnd}
                          min={asRetroDate || undefined}
                          onChange={(e) => setAsRetroDateEnd(e.target.value)}
                          className={cn(
                            opsFldControl,
                            "font-semibold",
                            (fieldErrors.retrospective_date_to ||
                              fieldErrors.retrospectiveDateEnd) &&
                              invalidControlClass,
                          )}
                        />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="mb-0 mt-2 text-[10.5px] text-text-3">
                لا يلزم إدخال تاريخ إضافي — يُعتمد تاريخ إصدار القيمة.
              </p>
            )}
          </div>

          <div className="mt-6">
            <PrimaryBtn disabled={saving} onClick={requestSave}>
              {settingsSaved ? "حفظ الأساليب" : "بدء التقييم"}
            </PrimaryBtn>
          </div>
          {settingsSaved ? (
            <p className="mb-0 mt-3 text-[11.5px] text-text-3">
              حدّد الأسلوب ليظهر تبويب طريقته فوراً. احفظ ليثبت الاختيار في
              التقرير. إلغاء أسلوب يخفي تبويبه دون حذف العمل.
            </p>
          ) : (
            <p className="mt-3 rounded-[var(--radius)] bg-[var(--amber-light)] px-2.5 py-2 text-[11.5px] text-[var(--amber-text)]">
              حدّد أسلوب السوق أو التكلفة ليظهر تبويب العمل، ثم ابدأ التقييم.
            </p>
          )}
        </CardPad>
      </Card>
      <AppModal
        open={confirmDisableOpen}
        title="إخفاء تبويب أسلوب"
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
