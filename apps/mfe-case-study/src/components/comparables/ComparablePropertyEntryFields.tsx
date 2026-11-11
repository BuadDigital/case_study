"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLatestRef } from "@platform/app-shared/hooks/use-latest-ref";
import {
  Button,
  GoogleMapPin,
  Input,
  Label,
  OpsInfoNote,
  Select,
  cn,
  reverseGeocodeLocation,
  useToast,
} from "@platform/ui-kit";
import {
  COMPARABLE_SOURCE_OPTIONS,
  LAND_COMPARABLE_TYPE,
  comparableAreaLabel,
  comparableLocationPinned,
  comparableRateLabel,
  comparablePlaceLine,
  computedPricePerSqm,
  contactNumbers,
  formatContactNumbersInput,
  type ComparableEntryDraft,
  type ComparableEntryFieldErrors,
  type ComparableKind,
  type ComparableSubjectPin,
} from "@platform/app-shared/app-data/comparable-entry";
import type { ComparableBankBrowse } from "@platform/app-shared/evaluator/comparable-entry-fields-slot";
import {
  haversineMeters,
  parseCoordinatePair,
  parseLatLng,
} from "@platform/app-shared/domain/geo";
import {
  ExistingComparableCard,
  useNearbyBankComparables,
} from "@platform/app-shared/comparables/NearbyBankComparables";
import {
  ADOPTED_COMPARABLE_PIN_COLOR,
  bankComparableMapPin,
  distanceLabelAr,
  mergeNearbyBankComparables,
  nearestBankComparable,
  subjectPropertyMapPin,
} from "@platform/app-shared/comparables/nearby-bank-comparables";
import { invalidControlClass } from "@platform/app-shared/form-ux";

const FIELD_LABEL = "mb-1 text-[11.5px] font-semibold text-text-2";

/**
 * How wide «وصف العقار» is in the four-column form: it takes what is left of the last row, so no
 * field is left alone on a row.
 *
 * How it works: `usedInLastRow` is how many columns the fields before it fill in their last row.
 * Edge cases: a full last row, or one column left (too narrow for free text), gives it a row of
 * its own. Narrower forms always give it the full row.
 */
function descriptionSpanClass(usedInLastRow: number): string {
  if (usedInLastRow === 1) return "col-span-full @[620px]:col-span-3";
  if (usedInLastRow === 2) return "col-span-full @[620px]:col-span-2";
  return "col-span-full";
}

function Field({
  label,
  required,
  className,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <Label className={FIELD_LABEL}>
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </Label>
      {children}
      {error ? (
        <p className="mb-0 mt-1 text-[11px] font-semibold text-danger-text" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function KindChip({
  label,
  on,
  disabled,
  onClick,
}: {
  label: string;
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "min-h-11 min-w-0 flex-1 rounded-[9px] border px-3 text-[13px] font-bold @[620px]:min-h-[38px]",
        on
          ? "border-ink bg-ink text-white"
          : "border-border-md bg-surface text-heading",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {label}
    </button>
  );
}

export function ComparablePropertyEntryFields({
  draft,
  disabled,
  showCoordinates,
  showDescription,
  subjectPin,
  fieldErrors,
  onChange,
  onLocationConfirmedChange,
  bankBrowse,
}: {
  draft: ComparableEntryDraft;
  disabled?: boolean;
  showCoordinates?: boolean;
  showDescription?: boolean;
  /** Subject property under study — reference pin, not the comparable. */
  subjectPin?: ComparableSubjectPin | null;
  fieldErrors?: ComparableEntryFieldErrors;
  onChange: (next: ComparableEntryDraft) => void;
  onLocationConfirmedChange?: (confirmed: boolean) => void;
  /**
   * The host browses the bank on this map: its search and filters sit above the map, its
   * comparables are the ones drawn (green when chosen for the transaction), and the pressed
   * pin's details carry the host's action. Without it the map shows the comparables around the
   * subject, to look at only.
   */
  bankBrowse?: ComparableBankBrowse;
}) {
  const { showToast } = useToast();
  const [mapPinned, setMapPinned] = useState(false);
  const [viewEpoch, setViewEpoch] = useState(0);
  const [placeLookup, setPlaceLookup] = useState<"idle" | "loading" | "done">(
    "idle",
  );
  const [coordsText, setCoordsText] = useState("");
  const [coordsError, setCoordsError] = useState<string | null>(null);
  const draftRef = useLatestRef(draft);
  const patch = <K extends keyof ComparableEntryDraft>(
    key: K,
    value: ComparableEntryDraft[K],
  ) => onChange({ ...draft, [key]: value });

  const comparablePin = parseLatLng(draft.latitude, draft.longitude);
  const fieldsLocked = Boolean(disabled || !mapPinned);
  const mapInteractive = !disabled && !mapPinned;
  const placeLine = comparablePlaceLine(draft);
  // Comparables already in the bank, drawn on the map so the same one is not entered twice.
  const bankNearby = useNearbyBankComparables(
    showCoordinates !== false ? (subjectPin ?? null) : null,
    showCoordinates !== false ? comparablePin : null,
  );
  // What the map draws: the host's comparables when it browses the bank, else the nearby ones.
  const drawnBank = bankBrowse?.comparables ?? bankNearby;
  const adoptedIds = bankBrowse?.adoptedIds;
  const [shownBankId, setShownBankId] = useState<string | null>(null);
  // A search with one hit opens its details by itself, once per hit.
  const autoOpenId = bankBrowse?.autoOpenId ?? null;
  const [prevAutoOpenId, setPrevAutoOpenId] = useState<string | null>(null);
  if (prevAutoOpenId !== autoOpenId) {
    setPrevAutoOpenId(autoOpenId);
    if (autoOpenId) setShownBankId(autoOpenId);
  }
  // The nearby ones stay known too: the same-spot warning below may name one the host's
  // search left out.
  const shownBank =
    mergeNearbyBankComparables(drawnBank, bankNearby).find((c) => c.id === shownBankId) ?? null;
  const shownBankPin = shownBank ? parseLatLng(shownBank.latitude, shownBank.longitude) : null;
  const shownAction = shownBank && bankBrowse && !disabled ? bankBrowse.action(shownBank) : null;
  const sameSpot = nearestBankComparable(bankNearby, comparablePin);
  const contextPins = useMemo(
    () => [
      ...(subjectPin ? [subjectPropertyMapPin(subjectPin)] : []),
      ...drawnBank
        .filter((c) => parseLatLng(c.latitude, c.longitude) != null)
        .map((c) =>
          bankComparableMapPin(c, adoptedIds?.has(c.id) ? ADOPTED_COMPARABLE_PIN_COLOR : undefined),
        ),
    ],
    [subjectPin, drawnBank, adoptedIds],
  );

  // Clearing the coordinates drops the pin and any place lookup with it.
  const coordinateKey = `${draft.latitude}|${draft.longitude}`;
  const [prevCoordinateKey, setPrevCoordinateKey] = useState(coordinateKey);
  if (prevCoordinateKey !== coordinateKey) {
    setPrevCoordinateKey(coordinateKey);
    if (!comparableLocationPinned(draft)) {
      setMapPinned(false);
      setPlaceLookup("idle");
    }
  }

  const locationConfirmed = mapPinned && comparableLocationPinned(draft);
  useEffect(() => {
    onLocationConfirmedChange?.(locationConfirmed);
  }, [locationConfirmed, onLocationConfirmedChange]);

  function setKind(kind: ComparableKind) {
    onChange({
      ...draft,
      kind,
      comparablePropertyType:
        kind === "land"
          ? LAND_COMPARABLE_TYPE
          : draft.kind === "land"
            ? ""
            : draft.comparablePropertyType,
    });
  }

  function applyLocationDetail(detail: {
    lat: number;
    lng: number;
    city?: string;
    district?: string;
  }) {
    const current = draftRef.current;
    const pin = parseLatLng(current.latitude, current.longitude);
    if (
      pin &&
      (Math.abs(pin.lat - detail.lat) > 0.0002 ||
        Math.abs(pin.lng - detail.lng) > 0.0002)
    ) {
      return;
    }
    onChange({
      ...current,
      latitude: detail.lat.toFixed(6),
      longitude: detail.lng.toFixed(6),
      city: detail.city?.trim() || current.city,
      district: detail.district?.trim() || current.district,
    });
    setPlaceLookup("done");
  }

  /** Returns true when the text was a valid pair and the pin moved. */
  function applyTypedCoords(text: string, { reportInvalid = true } = {}): boolean {
    if (!text.trim()) return false;
    const pin = parseCoordinatePair(text);
    if (!pin) {
      if (reportInvalid) {
        setCoordsError("إحداثيات غير صحيحة — اكتب خط العرض ثم خط الطول، مثل 24.7136, 46.6753");
      }
      return false;
    }
    setCoordsText("");
    setCoordsError(null);
    setPlaceLookup("loading");
    onChange({
      ...draftRef.current,
      latitude: pin.lat.toFixed(6),
      longitude: pin.lng.toFixed(6),
      city: "",
      district: "",
    });
    void reverseGeocodeLocation(pin.lat, pin.lng).then(applyLocationDetail);
    return true;
  }

  function restoreSubjectView() {
    if (!subjectPin) return;
    setViewEpoch((n) => n + 1);
    showToast("تم الرجوع إلى موقع العقار", "success");
  }

  // Omar 2026-11-11: the entry fields appear only once the comparable's location is chosen and
  // pinned. A form without a map has no location step, so its fields show at once.
  const fieldsShown = mapPinned || showCoordinates === false;
  // Fields between «نوع المقارن» and «وصف العقار»; المدينة and الحي fill the first row beside
  // «نوع المقارن» when the location is pinned, otherwise two of these fields do.
  const fieldCount =
    10 + (draft.kind === "building" ? 1 : 0) + (draft.transactionKind === "offer" ? 1 : 0);
  const descriptionSpan = descriptionSpanClass((fieldCount + (mapPinned ? 0 : 2)) % 4);
  const areaLabel = `${comparableAreaLabel(draft.kind)} (م²)`;
  const priceLabel =
    draft.kind === "land" ? "سعر الأرض (ر.س.)" : "السعر (ر.س.)";

  /*
    Omar 2026-11-11: the form was too tall — four fields a row where the window is wide enough (the
    «إضافة مقارن» window), two in a mid-width panel, one on a phone. The columns follow the form's
    own width, not the screen's, because the same form sits in a window and in the inspector's page.
  */
  return (
    <div className="@container">
    <div className="grid gap-x-3 gap-y-2.5 @[440px]:grid-cols-2 @[620px]:grid-cols-4">
      {showCoordinates !== false ? (
        <div className="col-span-full" id="cmp-location">
          {/* No heading or legend above the map (Omar 2026-11-11): the map and its pins say it. */}
          {bankBrowse?.toolbar}
          <div
            className={cn(
              "relative h-[240px] overflow-hidden rounded-lg border",
              // A map the bank is browsed on gets more room than one a pin is only placed on.
              bankBrowse ? "sm:h-[340px]" : "sm:h-[280px]",
              fieldErrors?.location || fieldErrors?.district
                ? "border-danger"
                : "border-border",
            )}
          >
            <GoogleMapPin
              lat={comparablePin?.lat}
              lng={comparablePin?.lng}
              title="خريطة موقع المقارن"
              interactive={mapInteractive}
              disabled={!mapInteractive}
              mapTypeControl
              quietPlaces
              resolvePlace={!disabled}
              initialCenter={subjectPin}
              viewCenter={subjectPin}
              viewEpoch={viewEpoch}
              contextPins={contextPins}
              // Omar 2026-11-11: the note over the spot being chosen says what it is for.
              pinLabel="أضف مقارن جديد"
              onCoordsChange={
                mapInteractive
                  ? (lat, lng) => {
                      setPlaceLookup("loading");
                      onChange({
                        ...draftRef.current,
                        latitude: lat.toFixed(6),
                        longitude: lng.toFixed(6),
                        city: "",
                        district: "",
                      });
                    }
                  : undefined
              }
              onLocationDetail={disabled ? undefined : applyLocationDetail}
              onContextPinClick={setShownBankId}
              freePan={Boolean(bankBrowse)}
              fitPinsKey={bankBrowse?.fitPinsKey}
              onCenterChange={bankBrowse?.onCenterChange}
            />
          </div>
          {sameSpot && sameSpot.comparable.id !== shownBankId ? (
            <OpsInfoNote variant="amber" className="mt-2.5">
              <div role="status" className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  يوجد مقارن مسجّل{" "}
                  <bdi dir="ltr" className="whitespace-nowrap font-bold">
                    {sameSpot.comparable.referenceCode}
                  </bdi>{" "}
                  على بُعد {distanceLabelAr(sameSpot.meters)} من هذا الموقع — تأكد أنه ليس
                  المقارن نفسه قبل إدخاله.
                </span>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setShownBankId(sameSpot.comparable.id)}
                >
                  عرض تفاصيله
                </Button>
              </div>
            </OpsInfoNote>
          ) : null}
          {shownBank ? (
            <ExistingComparableCard
              comparable={shownBank}
              metersFromSubject={
                subjectPin && shownBankPin ? haversineMeters(subjectPin, shownBankPin) : null
              }
              onUse={shownAction?.run}
              useLabel={shownAction?.label}
              useBusy={shownAction?.busy}
              onClose={() => setShownBankId(null)}
            />
          ) : null}
          {/* The location tools in one row: typed coordinates, pinning, back to the subject. */}
          {!disabled ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {mapInteractive ? (
                <>
                  <Label
                    htmlFor="cmp-coords"
                    className="mb-0 shrink-0 text-[11.5px] font-semibold text-text-2"
                  >
                    الإحداثيات
                  </Label>
                  <Input
                    id="cmp-coords"
                    dir="ltr"
                    inputMode="decimal"
                    value={coordsText}
                    placeholder="24.713600, 46.675300"
                    className={cn("min-w-[170px] flex-1", coordsError && invalidControlClass)}
                    onChange={(e) => {
                      setCoordsText(e.target.value);
                      setCoordsError(null);
                    }}
                    onPaste={(e) => {
                      const pasted = e.clipboardData.getData("text");
                      if (applyTypedCoords(pasted, { reportInvalid: false })) {
                        e.preventDefault();
                      }
                    }}
                    onBlur={() => applyTypedCoords(coordsText)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      applyTypedCoords(coordsText);
                    }}
                  />
                </>
              ) : null}
              {comparablePin && !mapPinned ? (
                <Button
                  type="button"
                  variant="primary"
                  className="max-sm:min-w-0 max-sm:flex-1"
                  onClick={() => {
                    setMapPinned(true);
                    showToast("تم تثبيت موقع المقارن", "success");
                  }}
                >
                  تثبيت الموقع
                </Button>
              ) : null}
              {mapPinned ? (
                <>
                  <div className="flex min-h-[38px] flex-1 items-center justify-center rounded-[9px] border border-[color-mix(in_srgb,var(--heading)_35%,var(--border))] bg-success-bg px-3 text-[12.5px] font-bold text-heading">
                    موقع المقارن مثبت
                  </div>
                  <Button type="button" onClick={() => setMapPinned(false)}>
                    تعديل
                  </Button>
                </>
              ) : null}
              <Button
                type="button"
                className="max-sm:min-w-0 max-sm:flex-1"
                disabled={!subjectPin}
                onClick={restoreSubjectView}
              >
                الرجوع إلى موقع العقار
              </Button>
            </div>
          ) : null}
          {coordsError ? (
            <p className="mb-0 mt-1 text-[11px] font-semibold text-danger-text" role="alert">
              {coordsError}
            </p>
          ) : null}
          <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[11.5px]">
            <span className="text-text-3">
              {mapPinned && comparablePin
                ? `الموقع مثبت — ${comparablePin.lat.toFixed(6)}، ${comparablePin.lng.toFixed(6)}`
                : comparablePin
                  ? `اضغط تثبيت بعد وضع الدبوس — ${comparablePin.lat.toFixed(6)}، ${comparablePin.lng.toFixed(6)}`
                  : "اضغط على الخريطة لتحديد موقع المقارن"}
            </span>
            {placeLine || comparablePin ? (
              <span className="font-semibold text-heading">
                {placeLine ||
                  (placeLookup === "loading"
                    ? "جاري تحديد الحي…"
                    : "تعذّر استخراج الحي تلقائياً — أدخله يدوياً بعد التثبيت")}
              </span>
            ) : null}
          </div>
          {fieldErrors?.location ? (
            <p className="mb-0 mt-1 text-[11px] font-semibold text-danger-text" role="alert">
              {fieldErrors.location}
            </p>
          ) : null}
        </div>
      ) : null}

      {mapPinned ? (
        <>
          <Field label="المدينة">
            <Input
              id="cmp-city"
              value={draft.city}
              disabled={disabled}
              placeholder="إن وُجدت"
              onChange={(e) => patch("city", e.target.value)}
            />
          </Field>
          <Field label="الحي" required error={fieldErrors?.district}>
            <Input
              id="cmp-district"
              value={draft.district}
              disabled={disabled}
              placeholder="اكتب اسم الحي إن لم يُستخرج من الخريطة"
              className={cn(fieldErrors?.district && invalidControlClass)}
              onChange={(e) => patch("district", e.target.value)}
            />
          </Field>
        </>
      ) : null}

      {fieldsShown ? (
        <>
      <div className="col-span-full @[620px]:col-span-2" id="cmp-kind">
        <Label className={FIELD_LABEL}>
          نوع المقارن
          <span className="text-danger"> *</span>
        </Label>
        <div
          className={cn(
            "flex gap-2 rounded-[9px]",
            fieldErrors?.kind && "ring-2 ring-danger/40",
          )}
        >
          <KindChip
            label="أرض"
            on={draft.kind === "land"}
            disabled={fieldsLocked}
            onClick={() => setKind("land")}
          />
          <KindChip
            label="مبنى"
            on={draft.kind === "building"}
            disabled={fieldsLocked}
            onClick={() => setKind("building")}
          />
        </div>
        {fieldErrors?.kind ? (
          <p className="mb-0 mt-1 text-[11px] font-semibold text-danger-text" role="alert">
            {fieldErrors.kind}
          </p>
        ) : !mapPinned ? (
          <p className="mb-0 mt-1 text-[11px] leading-snug text-text-3">
            ثبّت موقع المقارن أولاً لتعبئة البيانات.
          </p>
        ) : draft.kind === "building" ? (
          <p className="mb-0 mt-1 text-[11px] leading-snug text-text-3">
            السعر يشمل الأرض ضمن المبنى — لا تُفصل قيمة الأرض. للمقارنة مبنى
            بمبنى (أسلوب السوق).
          </p>
        ) : draft.kind === "land" ? (
          <p className="mb-0 mt-1 text-[11px] leading-snug text-text-3">
            لتقييم الأرض بأسلوب السوق أو لمكوّن الأرض في أسلوب التكلفة، حتى إذا
            كان موضوع التقييم فيلا.
          </p>
        ) : (
          <p className="mb-0 mt-1 text-[11px] leading-snug text-text-3">
            اختر أرضاً أو مبنى.
          </p>
        )}
      </div>

      <Field label={priceLabel} required error={fieldErrors?.price}>
        <Input
          id="cmp-price"
          inputMode="decimal"
          dir="ltr"
          value={draft.price}
          disabled={fieldsLocked}
          className={cn(fieldErrors?.price && invalidControlClass)}
          onChange={(e) => patch("price", e.target.value)}
        />
      </Field>
      <Field label={areaLabel} required error={fieldErrors?.areaSqm}>
        <Input
          id="cmp-area"
          inputMode="decimal"
          dir="ltr"
          value={draft.areaSqm}
          disabled={fieldsLocked}
          className={cn(fieldErrors?.areaSqm && invalidControlClass)}
          onChange={(e) => patch("areaSqm", e.target.value)}
        />
      </Field>
      <Field label="تاريخ العملية" required error={fieldErrors?.transactionDate}>
        <Input
          id="cmp-date"
          type="date"
          dir="ltr"
          value={draft.transactionDate}
          disabled={fieldsLocked}
          className={cn(fieldErrors?.transactionDate && invalidControlClass)}
          onChange={(e) => patch("transactionDate", e.target.value)}
        />
      </Field>
      <Field
        label={`${comparableRateLabel(draft.kind)} (محسوب)`}
      >
        <Input
          readOnly
          dir="ltr"
          value={computedPricePerSqm(draft.price, draft.areaSqm)}
          className="bg-surface-2"
        />
      </Field>
      {draft.kind === "building" ? (
        <Field label="نوع المبنى (فيلا، شقة، …)">
          <Input
            value={draft.comparablePropertyType}
            disabled={fieldsLocked}
            onChange={(e) => patch("comparablePropertyType", e.target.value)}
          />
        </Field>
      ) : null}
      <Field label="نوع العملية">
        <Select
          value={draft.transactionKind}
          disabled={fieldsLocked}
          onChange={(e) =>
            patch("transactionKind", e.target.value === "executed" ? "executed" : "offer")
          }
        >
          <option value="offer">عرض</option>
          <option value="executed">صفقة منفّذة</option>
        </Select>
      </Field>
      {draft.transactionKind === "offer" ? (
        <Field
          label="وصف السعر"
          required
          error={fieldErrors?.priceDescription}
        >
          <Select
            id="cmp-price-description"
            value={draft.priceDescription}
            disabled={fieldsLocked}
            hasError={Boolean(fieldErrors?.priceDescription)}
            onChange={(e) =>
              patch("priceDescription", e.target.value === "som" ? "som" : "asking")
            }
          >
            <option value="asking">حد</option>
            <option value="som">سوم</option>
          </Select>
        </Field>
      ) : null}
      <Field label="مصدر المعلومة" required error={fieldErrors?.source}>
        <Select
          id="cmp-source"
          value={draft.source}
          disabled={fieldsLocked}
          hasError={Boolean(fieldErrors?.source)}
          onChange={(e) => patch("source", e.target.value)}
        >
          {COMPARABLE_SOURCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label={
          draft.transactionKind === "executed"
            ? "رقم المعلومة / الصفقة"
            : "رقم الإعلان / المعلومة"
        }
      >
        <Input
          value={draft.listingNumber}
          disabled={fieldsLocked}
          onChange={(e) => patch("listingNumber", e.target.value)}
        />
      </Field>
      <Field label="رقم التواصل" error={fieldErrors?.advertiserPhone}>
        <Input
          id="cmp-phone"
          dir="ltr"
          inputMode="numeric"
          placeholder="0500000000"
          value={draft.advertiserPhone}
          disabled={fieldsLocked}
          className={cn(fieldErrors?.advertiserPhone && invalidControlClass)}
          onChange={(e) =>
            patch("advertiserPhone", formatContactNumbersInput(e.target.value))
          }
        />
        {draft.advertiserPhone.trim() ? (
          <p className="mb-0 mt-1 text-[11px] leading-snug text-text-3">
            {contactNumbers(draft.advertiserPhone).length} رقم — كل 10 أرقام رقم مستقل
          </p>
        ) : null}
      </Field>
      <Field label="رقم المخطط">
        <Input
          value={draft.planNumber}
          disabled={fieldsLocked}
          onChange={(e) => patch("planNumber", e.target.value)}
        />
      </Field>
      <Field label="القطعة">
        <Input
          value={draft.plotNumber}
          disabled={fieldsLocked}
          onChange={(e) => patch("plotNumber", e.target.value)}
        />
      </Field>
      {showDescription !== false ? (
        <Field label="وصف العقار" className={descriptionSpan}>
          <Input
            value={draft.description}
            disabled={fieldsLocked}
            onChange={(e) => patch("description", e.target.value)}
          />
        </Field>
      ) : null}
        </>
      ) : null}
    </div>
    </div>
  );
}
