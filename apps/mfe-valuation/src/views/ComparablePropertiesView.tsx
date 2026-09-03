"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createComparableProperty,
  deactivateComparableProperty,
  listComparableProperties,
  reactivateComparableProperty,
  setComparableQualityTags,
  type ComparablePropertyDto,
  type UpsertComparablePropertyRequest,
} from "@platform/api-client";
import { apiConfig } from "@platform/app-shared/auth/api-config";
import {
  cn,
  EmptyState,
  GoogleMapPin,
  googleMapsSearchUrl,
  InlineLoadingSkeleton,
  reverseGeocodeLocation,
  PageShell,
  Spinner,
  useToast,
  type GoogleMapContextPin,
  type GoogleMapLocationDetail,
} from "@platform/ui-kit";
import {
  opsBtnGhost,
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
  opsPpBadge,
  opsTfActions,
  opsTfLbl,
  opsToolbar,
} from "../lib/comparables-ops-tw";

// Q-3/5: closed lists aligned with subject-property lists — no free text.
const COMPARABLE_TYPE_OPTIONS = [
  "أرض",
  "شقة",
  "فيلا",
  "عمارة",
  "محل تجاري",
  "مستودع",
] as const;

const COMPARABLE_USAGE_OPTIONS = [
  "سكني",
  "تجاري",
  "صناعي",
  "زراعي",
  "مختلط",
] as const;

const SAR_FORMAT = new Intl.NumberFormat("ar-SA");

const PLUS_ICON = "M12 5v14M5 12h14";
const BANK_ICON =
  "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z";

function OpsIcon({ path, size = 20 }: { path: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}

/** Sentinel: no pin yet — user must pick on the map. */
const UNSET_COORD = Number.NaN;

function emptyForm(): UpsertComparablePropertyRequest {
  return {
    comparablePropertyType: "",
    usage: "",
    transactionKind: "offer",
    priceDescription: "asking",
    source: "listing_platform",
    listingNumber: "",
    transactionReference: "",
    advertiserPhone: "",
    latitude: UNSET_COORD,
    longitude: UNSET_COORD,
    areaSqm: 0,
    transactionDate: "",
    price: 0,
    city: "",
    district: "",
    description: "",
    intakeChannel: "office",
    isActive: true,
  };
}

function hasMapPin(form: UpsertComparablePropertyRequest): boolean {
  return Number.isFinite(form.latitude) && Number.isFinite(form.longitude);
}

function parseLatLngPair(
  raw: string,
): { lat: number; lng: number } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = trimmed.match(
    /^(-?\d+(?:\.\d+)?)\s*[,،]\s*(-?\d+(?:\.\d+)?)$/,
  );
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

function formatLatLngPair(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function bankContextPins(rows: ComparablePropertyDto[]): GoogleMapContextPin[] {
  return rows
    .filter(
      (r) =>
        r.isActive !== false &&
        Number.isFinite(r.latitude) &&
        Number.isFinite(r.longitude),
    )
    .slice(0, 40)
    .map((r) => ({
      lat: r.latitude,
      lng: r.longitude,
      label: r.comparablePropertyType?.slice(0, 1) || "م",
      title: [
        r.referenceCode,
        r.comparablePropertyType,
        r.district,
        r.price != null ? `${SAR_FORMAT.format(r.price)} ر.س` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    }));
}

function AddComparableForm({
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

function TagEditorRow({
  row,
  onSaved,
}: {
  row: ComparablePropertyDto;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [tagDraft, setTagDraft] = useState(() => ({
    reliabilityTag: row.reliabilityTag || "normal",
    isDuplicateTagged: row.isDuplicateTagged,
    tagRationale: row.tagRationale ?? "",
  }));

  async function saveTags() {
    const config = apiConfig();
    if (!config) return;
    setSaving(true);
    const res = await setComparableQualityTags(config, row.id, {
      reliabilityTag: tagDraft.reliabilityTag,
      isDuplicateTagged: tagDraft.isDuplicateTagged,
      tagRationale: tagDraft.tagRationale.trim() || null,
    });
    setSaving(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ الوسم", "error");
      return;
    }
    showToast("حُفظ الوسم — السجل يبقى موسوماً لا يُحذف", "success");
    onSaved();
  }

  return (
    <div className="mt-3 grid gap-3 rounded-[10px] border border-border bg-surface-2 p-3 min-[561px]:grid-cols-2">
      <div className={opsFld}>
        <label className={opsTfLbl}>وسم الموثوقية</label>
        <select
          className={opsFldControl}
          value={tagDraft.reliabilityTag}
          disabled={saving}
          onChange={(e) =>
            setTagDraft((d) => ({
              ...d,
              reliabilityTag: e.target.value,
            }))
          }
        >
          <option value="normal">عادي</option>
          <option value="anomalous">شاذ</option>
          <option value="unreliable">غير موثوق</option>
        </select>
      </div>
      <label className="flex items-center gap-1.5 self-end pb-2 text-[12.5px] text-text-2">
        <input
          type="checkbox"
          className="size-4 accent-[var(--gold-d)]"
          checked={tagDraft.isDuplicateTagged}
          disabled={saving}
          onChange={(e) =>
            setTagDraft((d) => ({
              ...d,
              isDuplicateTagged: e.target.checked,
            }))
          }
        />
        مكرر (نفس العملية سُجّلت مرتين)
      </label>
      <div className={opsFldFull}>
        <label className={opsTfLbl}>مبرر الوسم (إلزامي عند أي وسم)</label>
        <input
          className={opsFldControl}
          value={tagDraft.tagRationale}
          disabled={saving}
          onChange={(e) =>
            setTagDraft((d) => ({
              ...d,
              tagRationale: e.target.value,
            }))
          }
        />
      </div>
      <div className="col-span-full">
        <button
          type="button"
          className={opsBtnPrimary}
          disabled={saving}
          aria-busy={saving || undefined}
          onClick={() => void saveTags()}
        >
          {saving ? <Spinner /> : null}
          <span>حفظ الوسم</span>
        </button>
      </div>
    </div>
  );
}

/**
 * Company-wide comparable bank CRUD.
 * Selection / adopt into a valuation request lives on the appraiser workspace (Comparables tab).
 */
export function ComparablePropertiesView() {
  const { showToast } = useToast();
  const [rows, setRows] = useState<ComparablePropertyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [tagEditId, setTagEditId] = useState<string | null>(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 280);
    return () => clearTimeout(t);
  }, [q]);

  const reload = useCallback(async () => {
    const config = apiConfig();
    if (!config) {
      setLoading(false);
      setError("يلزم تسجيل الدخول");
      return;
    }
    const seq = ++requestSeqRef.current;
    setLoading(true);
    const res = await listComparableProperties(config, {
      q: debouncedQ || undefined,
      take: 100,
      includeInactive: showInactive,
    });
    if (seq !== requestSeqRef.current) return;
    setLoading(false);
    if (!res.ok) {
      setError("تعذّر تحميل بنك المقارنات");
      return;
    }
    setError(null);
    setRows(res.data);
  }, [debouncedQ, showInactive]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onDeactivate(id: string) {
    const config = apiConfig();
    if (!config) return;
    const res = await deactivateComparableProperty(config, id);
    if (!res.ok) {
      showToast("تعذّر التعطيل", "error");
      return;
    }
    showToast(
      "عُطّل المقارن (بدون حذف) — فعّل «إظهار المعطّلة» لمراجعته",
      "success",
    );
    await reload();
  }

  async function onReactivate(id: string) {
    const config = apiConfig();
    if (!config) return;
    const res = await reactivateComparableProperty(config, id);
    if (!res.ok) {
      showToast("تعذّر التفعيل", "error");
      return;
    }
    showToast("أُعيد تفعيل المقارن", "success");
    await reload();
  }

  const inactiveCount = rows.filter((row) => !row.isActive).length;
  const activeCount = rows.length - inactiveCount;

  return (
    <PageShell
      variant="canvas"
      className={cn(
        "gap-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6",
        loading && rows.length === 0 && "opacity-55",
      )}
      dir="rtl"
    >
      {loading && rows.length === 0 ? (
        <InlineLoadingSkeleton className="mb-3" />
      ) : null}

      <div className={opsToolbar}>
        <div className="flex min-w-0 flex-1 flex-wrap items-end gap-2.5">
          <div className={cn(opsFld, "min-w-[12rem] flex-1")}>
            <label htmlFor="comparables_bank_q" className={opsTfLbl}>
              بحث
            </label>
            <input
              id="comparables_bank_q"
              className={opsFldControl}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="مرجع / نوع / حي / إعلان…"
            />
          </div>
          <label className="flex items-center gap-1.5 self-end pb-2 text-[12.5px] text-text-2">
            <input
              type="checkbox"
              className="size-4 accent-[var(--gold-d)]"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            إظهار المعطّلة
          </label>
          <button
            type="button"
            className={opsBtnGhost}
            onClick={() => void reload()}
          >
            تحديث
          </button>
          <button
            type="button"
            className={opsBtnPrimary}
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? "إخفاء النموذج" : "إضافة مقارن"}
          </button>
        </div>
      </div>

      {showForm ? (
        <AddComparableForm
          bankRows={rows}
          onCreated={() => {
            setShowForm(false);
            void reload();
          }}
        />
      ) : null}

      {error ? (
        <p className="mb-3.5 m-0 rounded-[10px] border border-danger/30 bg-danger-bg px-3.5 py-3 text-[12.5px] text-danger-text">
          {error}
        </p>
      ) : null}

      <section className={opsLetterCard}>
        <div className={opsLetterHead}>
          <div className="flex items-center gap-[11px]">
            <span className={opsIconBoxGold}>
              <OpsIcon path={BANK_ICON} />
            </span>
            <div>
              <div className={opsLetterTitle}>سجل المقارنات</div>
              <div className={opsLetterSub}>
                {rows.length === 0
                  ? showInactive
                    ? "لا مقارنات"
                    : "لا مقارنات نشطة — جرّب إظهار المعطّلة"
                  : showInactive && inactiveCount > 0
                    ? `${activeCount} نشط · ${inactiveCount} معطّل`
                    : `${rows.length} ${rows.length === 1 ? "مقارن" : "مقارنًا"}`}
              </div>
            </div>
          </div>
          <span className={opsPpBadge}>{rows.length}</span>
        </div>
        <div className="px-4 pb-2 sm:px-[18px]">
          {rows.length === 0 ? (
            <EmptyState
              line={
                loading
                  ? "جاري التحميل…"
                  : showInactive
                    ? "لا مقارنات."
                    : "لا مقارنات نشطة — فعّل «إظهار المعطّلة» لرؤية المعطّلة سابقاً."
              }
            />
          ) : (
            <div className={cn(loading && "opacity-60")}>
              {rows.map((row) => (
                <div
                  key={row.id}
                  className={cn(
                    "border-b border-border py-3 last:border-b-0",
                    "[content-visibility:auto] [contain-intrinsic-size:auto_88px]",
                    !row.isActive && "opacity-60",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13.5px] font-bold text-heading">
                          {row.referenceCode} · {row.comparablePropertyType}
                          {row.usage ? ` (${row.usage})` : ""}
                        </span>
                        {row.reliabilityTag !== "normal" ? (
                          <span className="inline-flex items-center rounded-full bg-gold-soft px-2 py-0.5 text-[10.5px] font-bold text-gold-d">
                            {row.reliabilityTagLabelAr}
                          </span>
                        ) : null}
                        {row.isDuplicateTagged ? (
                          <span className="inline-flex items-center rounded-full bg-gold-soft px-2 py-0.5 text-[10.5px] font-bold text-gold-d">
                            مكرر
                          </span>
                        ) : null}
                        {row.duplicateSuspect && !row.isDuplicateTagged ? (
                          <span className="inline-flex items-center rounded-full border border-border-md px-2 py-0.5 text-[10.5px] font-semibold text-text-2">
                            اشتباه تكرار
                          </span>
                        ) : null}
                        {!row.isActive ? (
                          <span className="inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] font-semibold text-text-3">
                            معطّل
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-[11.5px] leading-relaxed text-text-3">
                        {row.transactionKindLabelAr}
                        {row.priceDescriptionLabelAr
                          ? ` / ${row.priceDescriptionLabelAr}`
                          : ""}{" "}
                        · {row.district}
                        {row.city ? ` · ${row.city}` : ""} ·{" "}
                        {row.transactionDate} · {row.areaSqm} م² ·{" "}
                        {SAR_FORMAT.format(row.price)} ر.س ·{" "}
                        {SAR_FORMAT.format(row.pricePerSqm)} ر.س/م²
                      </div>
                      <div className="mt-0.5 text-[11px] text-text-3">
                        المصدر: {row.sourceCard.intakeChannelLabelAr} ·{" "}
                        {row.sourceCard.freshnessLabelAr}
                        {row.sourceCard.fromPriorDeal
                          ? ` · من معاملة سابقة${
                              row.sourceCard.sourceWorkOrderNumber
                                ? ` (${row.sourceCard.sourceWorkOrderNumber})`
                                : ""
                            }`
                          : ""}
                      </div>
                      {row.tagRationale ? (
                        <div className="mt-0.5 text-[11px] text-text-3">
                          مبرر الوسم: {row.tagRationale}
                          {row.taggedByUserId
                            ? ` — بواسطة ${row.taggedByUserId}`
                            : ""}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      <button
                        type="button"
                        className={opsBtnGhost}
                        onClick={() =>
                          setTagEditId((cur) =>
                            cur === row.id ? null : row.id,
                          )
                        }
                      >
                        {tagEditId === row.id ? "إغلاق الوسم" : "وسم الجودة"}
                      </button>
                      {row.isActive ? (
                        <button
                          type="button"
                          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[9px] border border-border-md bg-surface px-3.5 py-2 font-[inherit] text-[12.5px] font-semibold text-[#d9694f] transition-colors enabled:hover:border-[#d9694f]/40 enabled:hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => void onDeactivate(row.id)}
                        >
                          تعطيل
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-[9px] border border-border-md bg-surface px-3.5 py-2 font-[inherit] text-[12.5px] font-semibold text-gold-d transition-colors enabled:hover:border-gold/40 enabled:hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={() => void onReactivate(row.id)}
                        >
                          تفعيل
                        </button>
                      )}
                    </div>
                  </div>
                  {tagEditId === row.id ? (
                    <TagEditorRow
                      key={row.id}
                      row={row}
                      onSaved={() => {
                        setTagEditId(null);
                        void reload();
                      }}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </PageShell>
  );
}
