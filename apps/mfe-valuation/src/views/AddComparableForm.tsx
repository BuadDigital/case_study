"use client";

/**
 * Intake form of `ComparablePropertiesView` — map pin plus the comparable
 * fields, saved straight into the company-wide bank.
 */

import { useMemo, useState } from "react";
import {
  createComparableProperty,
  type ComparablePropertyDto,
  type UpsertComparablePropertyRequest,
} from "@platform/api-client";
import { apiConfig } from "@platform/app-shared/auth/api-config";
import {
  cn,
  googleMapsSearchUrl,
  GoogleMapPin,
  reverseGeocodeLocation,
  Spinner,
  useToast,
  type GoogleMapLocationDetail,
} from "@platform/ui-kit";
import {
  opsBtnPrimary,
  opsFld,
  opsFldControl,
  opsFldFull,
  opsFormGrid,
  opsIconBoxGold,
  opsLetterCard,
  opsLetterHead,
  opsLetterSub,
  opsLetterTitle,
  opsTfActions,
  opsTfLbl,
} from "../lib/comparables-ops-tw";
import {
  bankContextPins,
  COMPARABLE_TYPE_OPTIONS,
  COMPARABLE_USAGE_OPTIONS,
  emptyForm,
  formatLatLngPair,
  hasMapPin,
  parseLatLngPair,
  SAR_FORMAT,
} from "./comparable-properties-state";
import { OpsIcon, PLUS_ICON } from "./ComparablesOpsIcon";

export function AddComparableForm({
  onCreated,
  bankRows,
}: {
  onCreated: () => void;
  bankRows: ComparablePropertyDto[];
}) {
  const { showToast } = useToast();
  const [form, setForm] = useState<UpsertComparablePropertyRequest>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [placeLabel, setPlaceLabel] = useState<string | null>(null);
  const [coordInput, setCoordInput] = useState("");
  const [areaText, setAreaText] = useState("");
  const [priceText, setPriceText] = useState("");
  const mapPin = hasMapPin(form);
  const contextPins = useMemo(() => bankContextPins(bankRows), [bankRows]);

  const mapPinLabel = useMemo(() => {
    const parts = [
      form.comparablePropertyType || null,
      form.district || null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : "موقع المقارن الجديد";
  }, [form.comparablePropertyType, form.district]);

  const pinCaption = useMemo(() => {
    const parts = [
      form.comparablePropertyType || null,
      form.district || null,
      form.price > 0 ? `${SAR_FORMAT.format(form.price)} ر.س` : null,
      form.areaSqm > 0 ? `${form.areaSqm} م²` : null,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(" · ") : "موقع المقارن الجديد";
  }, [
    form.areaSqm,
    form.comparablePropertyType,
    form.district,
    form.price,
  ]);

  function applyPlaceDetail(detail: GoogleMapLocationDetail) {
    setPlaceLabel(detail.formattedAddress ?? null);
    setForm((f) => ({
      ...f,
      latitude: Number(detail.lat.toFixed(6)),
      longitude: Number(detail.lng.toFixed(6)),
      city: detail.city?.trim() || f.city,
      district: detail.district?.trim() || f.district,
    }));
    setCoordInput(formatLatLngPair(detail.lat, detail.lng));
  }

  function setCoords(lat: number, lng: number) {
    const latVal = Number(lat.toFixed(6));
    const lngVal = Number(lng.toFixed(6));
    setForm((f) => ({
      ...f,
      latitude: latVal,
      longitude: lngVal,
    }));
    setCoordInput(formatLatLngPair(latVal, lngVal));
  }

  function applyCoordsFromInput(lat: number, lng: number) {
    setCoords(lat, lng);
    void reverseGeocodeLocation(lat, lng).then(applyPlaceDetail);
  }

  function onCoordInputChange(raw: string) {
    setCoordInput(raw);
    const parsed = parseLatLngPair(raw);
    if (parsed) applyCoordsFromInput(parsed.lat, parsed.lng);
  }

  function onCoordInputBlur() {
    const trimmed = coordInput.trim();
    if (!trimmed) return;
    const parsed = parseLatLngPair(trimmed);
    if (!parsed) {
      showToast(
        "صيغة الإحداثيات غير صحيحة — استخدم: خط العرض، خط الطول",
        "error",
      );
      return;
    }
    applyCoordsFromInput(parsed.lat, parsed.lng);
  }

  async function onCreate() {
    const config = apiConfig();
    if (!config) return;
    if (!hasMapPin(form)) {
      showToast("حدّد موقع العقار على الخريطة", "error");
      return;
    }
    setSaving(true);
    const res = await createComparableProperty(config, {
      ...form,
      priceDescription:
        form.transactionKind === "offer" ? form.priceDescription : null,
    });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر الحفظ", "error");
      return;
    }
    const anomaly = res.data.pricePerSqmAnomalyNoteAr;
    showToast(
      anomaly ? `أُضيف المقارن إلى البنك — ${anomaly}` : "أُضيف المقارن إلى البنك",
      anomaly ? "error" : "success",
    );
    setPlaceLabel(null);
    setCoordInput("");
    setAreaText("");
    setPriceText("");
    setForm(emptyForm());
    onCreated();
  }

  return (
    <section className={cn(opsLetterCard, "mb-3.5")}>
      <div className={opsLetterHead}>
        <div className="flex items-center gap-[11px]">
          <span className={opsIconBoxGold}>
            <OpsIcon path={PLUS_ICON} />
          </span>
          <div>
            <div className={opsLetterTitle}>إضافة مقارن</div>
            <div className={opsLetterSub}>
              يُحفظ في البنك المشترك ويظهر فوراً في قائمة المقارنات
            </div>
          </div>
        </div>
      </div>
      <div className="px-4 pb-[18px] pt-4 sm:px-[18px]">
        <div className={opsFormGrid}>
          <div className={opsFld}>
            <label className={opsTfLbl}>نوع العقار المقارن *</label>
            <select
              className={opsFldControl}
              value={form.comparablePropertyType}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  comparablePropertyType: e.target.value,
                }))
              }
            >
              <option value="">— اختر —</option>
              {COMPARABLE_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              {form.comparablePropertyType &&
              !COMPARABLE_TYPE_OPTIONS.includes(
                form.comparablePropertyType as (typeof COMPARABLE_TYPE_OPTIONS)[number],
              ) ? (
                <option value={form.comparablePropertyType}>
                  {form.comparablePropertyType} (قديم)
                </option>
              ) : null}
            </select>
          </div>
          <div className={opsFld}>
            <label className={opsTfLbl}>استخدام المقارن *</label>
            <select
              className={opsFldControl}
              value={form.usage ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, usage: e.target.value }))
              }
            >
              <option value="">— اختر —</option>
              {COMPARABLE_USAGE_OPTIONS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div className={opsFld}>
            <label className={opsTfLbl}>نوع العملية *</label>
            <select
              className={opsFldControl}
              value={form.transactionKind}
              onChange={(e) =>
                setForm((f) => ({ ...f, transactionKind: e.target.value }))
              }
            >
              <option value="offer">عرض</option>
              <option value="executed">تنفيذ</option>
            </select>
          </div>
          {form.transactionKind === "offer" ? (
            <div className={opsFld}>
              <label className={opsTfLbl}>وصف السعر *</label>
              <select
                className={opsFldControl}
                value={form.priceDescription ?? "asking"}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    priceDescription: e.target.value,
                  }))
                }
              >
                <option value="asking">حد</option>
                <option value="som">سوم</option>
                {form.priceDescription === "negotiable" ? (
                  <option value="negotiable">تفاوض (قديم)</option>
                ) : null}
              </select>
            </div>
          ) : null}
          <div className={opsFld}>
            <label className={opsTfLbl}>المصدر</label>
            <select
              className={opsFldControl}
              value={form.source}
              onChange={(e) =>
                setForm((f) => ({ ...f, source: e.target.value }))
              }
            >
              <option value="listing_platform">منصة إعلان</option>
              <option value="bourse">بورصة</option>
              <option value="field">ميدان</option>
              <option value="prior_valuation">معاملة سابقة</option>
              <option value="other">أخرى</option>
            </select>
          </div>
          <div className={opsFld}>
            <label className={opsTfLbl}>رافد الإدخال</label>
            <select
              className={opsFldControl}
              value={form.intakeChannel}
              onChange={(e) =>
                setForm((f) => ({ ...f, intakeChannel: e.target.value }))
              }
            >
              <option value="office">مكتبي</option>
              <option value="field">ميداني</option>
              <option value="system">اقتراح النظام</option>
            </select>
          </div>
          <div className={opsFld}>
            <label className={opsTfLbl}>تاريخ العملية *</label>
            <input
              type="date"
              dir="ltr"
              className={opsFldControl}
              value={form.transactionDate}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  transactionDate: e.target.value,
                }))
              }
            />
          </div>
          <div className={opsFld}>
            <label className={opsTfLbl}>المساحة م² *</label>
            <input
              inputMode="decimal"
              dir="ltr"
              className={opsFldControl}
              value={areaText}
              onChange={(e) => {
                const next = e.target.value;
                setAreaText(next);
                setForm((f) => ({
                  ...f,
                  areaSqm: Number(next) || 0,
                }));
              }}
            />
          </div>
          <div className={opsFld}>
            <label className={opsTfLbl}>السعر *</label>
            <input
              inputMode="decimal"
              dir="ltr"
              className={opsFldControl}
              value={priceText}
              onChange={(e) => {
                const next = e.target.value;
                setPriceText(next);
                setForm((f) => ({
                  ...f,
                  price: Number(next) || 0,
                }));
              }}
            />
          </div>
          <div className={opsFld}>
            <label className={opsTfLbl}>الحي *</label>
            <input
              className={opsFldControl}
              value={form.district}
              onChange={(e) =>
                setForm((f) => ({ ...f, district: e.target.value }))
              }
            />
          </div>
          <div className={opsFldFull}>
            <div className="grid grid-cols-1 gap-3.5 min-[561px]:grid-cols-2">
              <div className={opsFld}>
                <label className={opsTfLbl}>المدينة</label>
                <input
                  className={opsFldControl}
                  value={form.city ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, city: e.target.value }))
                  }
                />
              </div>
              {form.transactionKind === "offer" ? (
                <div className={opsFld}>
                  <label className={opsTfLbl}>رقم الإعلان</label>
                  <input
                    dir="ltr"
                    className={opsFldControl}
                    value={form.listingNumber ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        listingNumber: e.target.value,
                      }))
                    }
                  />
                </div>
              ) : (
                <div className={opsFld}>
                  <label className={opsTfLbl}>مرجع صفقة البورصة</label>
                  <input
                    dir="ltr"
                    className={opsFldControl}
                    value={form.transactionReference ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        transactionReference: e.target.value,
                      }))
                    }
                  />
                </div>
              )}
            </div>
          </div>
          <div className={opsFldFull}>
            <label className={opsTfLbl}>موقع العقار على الخريطة *</label>
            <div className="mb-2">
              <label className={opsTfLbl} htmlFor="comparable_coords_pair">
                الإحداثيات (خط العرض، خط الطول)
              </label>
              <input
                id="comparable_coords_pair"
                dir="ltr"
                className={opsFldControl}
                placeholder="21.581000, 39.154300"
                value={coordInput}
                onChange={(e) => onCoordInputChange(e.target.value)}
                onBlur={onCoordInputBlur}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    onCoordInputBlur();
                  }
                }}
              />
            </div>
            <div className="relative h-[320px] overflow-hidden rounded-[9px] border border-border-md sm:h-[380px]">
              <GoogleMapPin
                lat={mapPin ? form.latitude : null}
                lng={mapPin ? form.longitude : null}
                title="خريطة موقع المقارن"
                interactive
                mapTypeControl
                resolvePlace
                pinLabel={mapPinLabel}
                contextPins={contextPins}
                onCoordsChange={(lat, lng) => setCoords(lat, lng)}
                onLocationDetail={applyPlaceDetail}
              />
              {mapPin ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 via-ink/55 to-transparent px-3 pb-3 pt-10 text-white">
                  <div className="text-[12.5px] font-bold leading-snug">
                    {pinCaption}
                  </div>
                  {placeLabel ? (
                    <div className="mt-0.5 text-[11px] leading-relaxed opacity-90">
                      {placeLabel}
                    </div>
                  ) : null}
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10.5px] opacity-80" dir="ltr">
                    <span>
                      {form.latitude.toFixed(6)}, {form.longitude.toFixed(6)}
                    </span>
                    {form.city ? <span dir="rtl">{form.city}</span> : null}
                    {form.district ? <span dir="rtl">{form.district}</span> : null}
                  </div>
                </div>
              ) : null}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
              <p className="m-0 text-[11.5px] text-text-3">
                {mapPin
                  ? "يمكنك سحب الدبوس أو النقر لتعديل الموقع — النقاط الذهبية مقارنات موجودة في البنك"
                  : "اضغط على الخريطة أو أدخل الإحداثيات (مثل: 21.581000, 39.154300) — النقاط الذهبية = مقارنات البنك"}
              </p>
              {mapPin ? (
                <a
                  className="text-[11.5px] font-semibold text-gold-d underline-offset-2 hover:underline"
                  href={googleMapsSearchUrl(form.latitude, form.longitude)}
                  target="_blank"
                  rel="noreferrer"
                >
                  فتح في خرائط Google
                </a>
              ) : null}
            </div>
          </div>
          <div className={opsFldFull}>
            <label className={opsTfLbl}>الوصف</label>
            <input
              className={opsFldControl}
              value={form.description ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>
        </div>
        <div className={opsTfActions}>
          <button
            type="button"
            className={opsBtnPrimary}
            disabled={saving}
            aria-busy={saving || undefined}
            onClick={() => void onCreate()}
          >
            {saving ? <Spinner /> : null}
            <span>✓ حفظ في البنك</span>
          </button>
        </div>
      </div>
    </section>
  );
}
