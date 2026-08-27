"use client";

import { memo, useEffect, useRef, useState } from "react";
import {
  getValuationApproachSettings,
  isNoExternalSpecialistAssumption,
  saveValuationApproachSettings,
  type ValuationApproachSettingsDto,
} from "@platform/api-client";
import { cn, useToast } from "@platform/ui-kit";
import { valuationPurposeKeyForAssignment } from "@platform/app-shared/prototype/assignment-valuation-defaults";
import {
  Card,
  CardPad,
  CardTitle,
  FieldLabel,
  PrimaryBtn,
  ToggleChip,
  vwInputClassName,
} from "./atoms";
import { apiConfig } from "./lib/shell-utils";

/**
 * شاشة البيانات الأساسية — تملك مسودات إعدادات التقييم (الأساليب، النطاق، الأساس،
 * تاريخ التقييم، الأخصائي الخارجي) محلياً: الكتابة هنا لا تعيد رسم صدفة التقييم.
 * تترطب من دفعة الخادم عبر hydrateKey — يزداد مع كل تحميل كامل وكل حفظ إعدادات
 * (حتى لا تكتب مسودة قديمة فوق ما حُفظ من شاشة التكلفة).
 */
export const ApproachSettingsSection = memo(function ApproachSettingsSection({
  valuationRequestId,
  assignmentType,
  settings,
  hydrateKey,
  saving,
  onSavingChange,
  onSettingsSaved,
}: {
  valuationRequestId: string | null;
  assignmentType?: string;
  settings: ValuationApproachSettingsDto | null;
  hydrateKey: number;
  saving: boolean;
  onSavingChange: (saving: boolean) => void;
  onSettingsSaved: (dto: ValuationApproachSettingsDto) => void;
}) {
  const { showToast } = useToast();
  const [asMarketEnabled, setAsMarketEnabled] = useState(true);
  const [asCostEnabled, setAsCostEnabled] = useState(true);
  const [asCostBasis, setAsCostBasis] = useState("replacement");
  /** نطاق التقييم بالتكلفة: land_and_building | building_only (مواصفة النموذج التفاعلي). */
  const [asCostScope, setAsCostScope] = useState("land_and_building");
  const [asCostUnit, setAsCostUnit] = useState("comparison_unit");
  const [asPurpose, setAsPurpose] = useState(() =>
    valuationPurposeKeyForAssignment(assignmentType),
  );
  const [asPurposeNote, setAsPurposeNote] = useState("");
  const [asSpecialistUsed, setAsSpecialistUsed] = useState(false);
  const [asSpecialistDetails, setAsSpecialistDetails] = useState("");
  const [asDateMode, setAsDateMode] = useState("issue");
  const [asRetroKind, setAsRetroKind] = useState<"single" | "range">("single");
  const [asRetroDate, setAsRetroDate] = useState("");
  const [asRetroDateEnd, setAsRetroDateEnd] = useState("");
  const [asAssumptions, setAsAssumptions] = useState<string[]>([]);

  const hydratedKeyRef = useRef<number | null>(null);
  useEffect(() => {
    if (hydratedKeyRef.current === hydrateKey) return;
    hydratedKeyRef.current = hydrateKey;
    if (!settings) return;
    setAsMarketEnabled(settings.marketApproachEnabled);
    setAsCostEnabled(settings.costApproachEnabled);
    setAsCostBasis(settings.costBasisKey || "replacement");
    setAsCostScope(settings.costScopeKey || "land_and_building");
    setAsCostUnit(settings.costMeasurementUnitKey || "comparison_unit");
    setAsPurpose(
      settings.valuationPurposeKey ||
        valuationPurposeKeyForAssignment(assignmentType),
    );
    setAsPurposeNote(settings.valuationPurposeNote ?? "");
    setAsSpecialistUsed(settings.externalSpecialistUsed);
    setAsSpecialistDetails(settings.externalSpecialistDetails ?? "");
    setAsDateMode(settings.valuationDateMode || "issue");
    setAsRetroDate(settings.retrospectiveDate ?? "");
    setAsRetroDateEnd(settings.retrospectiveDateEnd ?? "");
    setAsRetroKind(settings.retrospectiveDateEnd?.trim() ? "range" : "single");
    const loadedAssumptions = settings.selectedAssumptions ?? [];
    const library = settings.assumptionLibrary ?? [];
    const visibleLibrary = library.filter(
      (clause) =>
        !settings.externalSpecialistUsed ||
        !isNoExternalSpecialistAssumption(clause),
    );
    // عند غياب اختيار محفوظ: كل بنود الافتراضات الخاصة مختارة افتراضياً.
    const useAllByDefault = loadedAssumptions.length === 0;
    setAsAssumptions(
      useAllByDefault
        ? visibleLibrary
        : settings.externalSpecialistUsed
          ? loadedAssumptions.filter((x) => !isNoExternalSpecialistAssumption(x))
          : loadedAssumptions,
    );
  }, [hydrateKey, settings, assignmentType]);

  async function saveApproachSettings() {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    if (asDateMode === "retrospective") {
      if (!asRetroDate.trim()) {
        showToast("تاريخ الأثر الرجعي إلزامي", "error");
        return;
      }
      if (asRetroKind === "range") {
        if (!asRetroDateEnd.trim()) {
          showToast("حدّد تاريخ نهاية الفترة", "error");
          return;
        }
        if (asRetroDateEnd < asRetroDate) {
          showToast("تاريخ النهاية يجب ألا يسبق تاريخ البداية", "error");
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
    if (asSpecialistUsed) {
      selectedAssumptions = selectedAssumptions.filter(
        (x) => !isNoExternalSpecialistAssumption(x),
      );
    } else {
      const clause = library.find(isNoExternalSpecialistAssumption);
      if (clause && !selectedAssumptions.includes(clause)) {
        selectedAssumptions = [...selectedAssumptions, clause];
      }
    }
    // عند غياب اختيار محفوظ بعد الجلب: كل البنود الظاهرة افتراضياً.
    if (selectedAssumptions.length === 0 && library.length > 0) {
      selectedAssumptions = library.filter(
        (clause) =>
          !asSpecialistUsed || !isNoExternalSpecialistAssumption(clause),
      );
    }
    const res = await saveValuationApproachSettings(config, valuationRequestId, {
      marketApproachEnabled: asMarketEnabled,
      costApproachEnabled: asCostEnabled && (settings?.costApproachAllowed ?? true),
      incomeApproachEnabled: false,
      costBasisKey: asCostBasis,
      costScopeKey: asCostScope,
      costMeasurementUnitKey: asCostUnit,
      adjustmentsEditUnlocked: true,
      valuationPurposeKey:
        valuationPurposeKeyForAssignment(assignmentType) || asPurpose || null,
      valuationPurposeNote: asPurposeNote.trim() || null,
      externalSpecialistUsed: asSpecialistUsed,
      externalSpecialistDetails: asSpecialistDetails.trim() || null,
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
      showToast(res.message ?? "تعذّر حفظ إعدادات التقييم", "error");
      return;
    }
    showToast("تم حفظ إعدادات التقييم", "success");
    onSettingsSaved(res.data);
  }

  const settingsSaved = settings?.isSaved ?? false;
  const isLandKind = settings?.isLandPropertyType ?? false;

  return (
    <>
      <Card>
        <CardPad>
          <CardTitle>أساليب وطرق التقييم المستخدمة</CardTitle>
          {!settings?.costApproachAllowed ? (
            <p className="mb-3 text-[11.5px] text-gold-d">
              ق-3: أرض بلا إنشاءات — أسلوب التكلفة لا ينطبق.
            </p>
          ) : null}
          <div className="mb-4 grid grid-cols-3 gap-3">
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
                asCostEnabled && settings?.costApproachAllowed
                  ? "border-gold bg-gold-soft"
                  : "border-border-md bg-surface",
                settings?.costApproachAllowed
                  ? "cursor-pointer"
                  : "cursor-not-allowed opacity-55",
              )}
            >
              <input
                type="checkbox"
                checked={asCostEnabled && !!settings?.costApproachAllowed}
                disabled={saving || !settings?.costApproachAllowed}
                onChange={(e) => setAsCostEnabled(e.target.checked)}
                className="mt-0.5 size-[17px] accent-[var(--ink)]"
              />
              <div>
                <div className="text-[12.5px] font-bold text-heading">
                  أسلوب التكلفة
                </div>
                <div className="mt-[3px] text-[11px] font-normal text-text-3">
                  {isLandKind && !settings?.costApproachAllowed
                    ? "لا ينطبق: الأرض لا تُقيَّم بالتكلفة"
                    : "أسلوب مركّب إلزامياً: قيمة الأرض بالمقارنات + تكلفة الإحلال ناقصاً الإهلاك — لا يُلغى أحد المكوّنين منفرداً"}
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

          {asCostEnabled && settings?.costApproachAllowed ? (
            <p className="mb-3 text-[11.5px] text-gold-d">
              طريقة المقاول تستلزم تقييم أرض المبنى بطريقة المقارنة.
            </p>
          ) : null}

          {asCostEnabled && settings?.costApproachAllowed ? (
            <div className="mb-4 border-t border-border pt-4">
              <FieldLabel>نطاق التقييم بالتكلفة</FieldLabel>
              <div className="my-2 mb-1.5 flex flex-wrap gap-2">
                <ToggleChip
                  active={asCostScope !== "building_only"}
                  disabled={saving}
                  onClick={() => setAsCostScope("land_and_building")}
                >
                  أرض ومبنى
                </ToggleChip>
                <ToggleChip
                  active={asCostScope === "building_only"}
                  disabled={saving}
                  onClick={() => setAsCostScope("building_only")}
                >
                  مبنى فقط
                </ToggleChip>
              </div>
              <p className="mb-3.5 mt-0 text-[10.5px] text-text-3">
                {asCostScope === "building_only"
                  ? "«مبنى فقط» يخفي قسم تقدير الأرض ويجعل مؤشر الأسلوب = تكلفة الإحلال ناقصاً الإهلاك."
                  : "«أرض ومبنى» يستلزم تقدير الأرض بالمقارنات داخل أسلوب التكلفة."}
              </p>
              <FieldLabel>طريقة تقدير التكلفة</FieldLabel>
              <div className="my-2 mb-1.5 flex flex-wrap gap-2">
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

          <div className="mb-3.5">
            <FieldLabel>تاريخ التقييم — نوعان</FieldLabel>
            <div className="mt-2 flex flex-wrap gap-4">
              <label className="flex items-center gap-1.5 text-[12.5px]">
                <input
                  type="radio"
                  checked={asDateMode !== "retrospective"}
                  onChange={() => setAsDateMode("issue")}
                />
                تاريخ إصدار القيمة
              </label>
              <label className="flex items-center gap-1.5 text-[12.5px]">
                <input
                  type="radio"
                  checked={asDateMode === "retrospective"}
                  onChange={() => setAsDateMode("retrospective")}
                />
                أثر رجعي
              </label>
            </div>
            {asDateMode === "retrospective" ? (
              <div className="mt-2.5 flex flex-col gap-2.5">
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-1.5 text-[12.5px]">
                    <input
                      type="radio"
                      checked={asRetroKind === "single"}
                      onChange={() => {
                        setAsRetroKind("single");
                        setAsRetroDateEnd("");
                      }}
                    />
                    تاريخ محدد
                  </label>
                  <label className="flex items-center gap-1.5 text-[12.5px]">
                    <input
                      type="radio"
                      checked={asRetroKind === "range"}
                      onChange={() => setAsRetroKind("range")}
                    />
                    فترة بين تاريخين
                  </label>
                </div>
                {asRetroKind === "single" ? (
                  <input
                    type="date"
                    dir="ltr"
                    value={asRetroDate}
                    onChange={(e) => setAsRetroDate(e.target.value)}
                    className={cn(vwInputClassName, "max-w-[11rem]")}
                  />
                ) : (
                  <div className="grid grid-cols-[11rem_11rem] gap-2.5 max-sm:grid-cols-1">
                    <input
                      type="date"
                      dir="ltr"
                      aria-label="من تاريخ"
                      value={asRetroDate}
                      onChange={(e) => setAsRetroDate(e.target.value)}
                      className={vwInputClassName}
                    />
                    <input
                      type="date"
                      dir="ltr"
                      aria-label="إلى تاريخ"
                      value={asRetroDateEnd}
                      min={asRetroDate || undefined}
                      onChange={(e) => setAsRetroDateEnd(e.target.value)}
                      className={vwInputClassName}
                    />
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <label className="mb-2 flex items-center gap-2 text-[12.5px]">
            <input
              type="checkbox"
              className="size-4 shrink-0 cursor-pointer accent-[var(--ink)]"
              checked={asSpecialistUsed}
              onChange={(e) => {
                const used = e.target.checked;
                setAsSpecialistUsed(used);
              }}
            />
            استُعين بأخصائي خارجي (IVS 101)
          </label>
          {asSpecialistUsed ? (
            <input
              placeholder="الأخصائي، دوره، ونتيجته"
              value={asSpecialistDetails}
              onChange={(e) => setAsSpecialistDetails(e.target.value)}
              className={cn(vwInputClassName, "mb-3.5 font-medium")}
            />
          ) : null}

          <PrimaryBtn disabled={saving} onClick={() => void saveApproachSettings()}>
            حفظ إعدادات التقييم
          </PrimaryBtn>
          {!settingsSaved ? (
            <p className="mt-3 rounded-[var(--radius)] bg-[var(--amber-light)] px-2.5 py-2 text-[11.5px] text-[var(--amber-text)]">
              احفظ إعدادات التقييم أولاً لفتح شاشات العمل (السوق، التكلفة، الترجيح).
            </p>
          ) : null}
        </CardPad>
      </Card>
    </>
  );
});
