"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button, GoogleMapPin, Input, Label, Select, cn, useToast } from "@platform/ui-kit";
import {
  COMPARABLE_SOURCE_OPTIONS,
  LAND_COMPARABLE_TYPE,
  comparableLocationPinned,
  comparablePlaceLine,
  computedPricePerSqm,
  parseComparableCoords,
  type ComparableEntryDraft,
  type ComparableKind,
  type ComparableSubjectPin,
} from "../../lib/comparable-entry";

const FIELD_LABEL = "mb-1.5 text-[12px] font-semibold text-text-2";

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <Label className={FIELD_LABEL}>
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </Label>
      {children}
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
        "min-h-11 min-w-0 flex-1 rounded-[9px] border px-3 text-[13px] font-bold",
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
  onChange,
  onLocationConfirmedChange,
}: {
  draft: ComparableEntryDraft;
  disabled?: boolean;
  showCoordinates?: boolean;
  showDescription?: boolean;
  /** Subject property under study — reference pin, not the comparable. */
  subjectPin?: ComparableSubjectPin | null;
  onChange: (next: ComparableEntryDraft) => void;
  onLocationConfirmedChange?: (confirmed: boolean) => void;
}) {
  const { showToast } = useToast();
  const [mapPinned, setMapPinned] = useState(false);
  const [viewEpoch, setViewEpoch] = useState(0);
  const [placeLookup, setPlaceLookup] = useState<"idle" | "loading" | "done">(
    "idle",
  );
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const patch = <K extends keyof ComparableEntryDraft>(
    key: K,
    value: ComparableEntryDraft[K],
  ) => onChange({ ...draft, [key]: value });

  const comparablePin = parseComparableCoords(draft.latitude, draft.longitude);
  const fieldsLocked = Boolean(disabled || !mapPinned);
  const mapInteractive = !disabled && !mapPinned;
  const placeLine = comparablePlaceLine(draft);
  const contextPins = useMemo(
    () =>
      subjectPin
        ? [
            {
              lat: subjectPin.lat,
              lng: subjectPin.lng,
              title: "العقار موضوع التقييم",
              label: "ع",
            },
          ]
        : [],
    [subjectPin],
  );

  useEffect(() => {
    if (!comparableLocationPinned(draft)) {
      setMapPinned(false);
      setPlaceLookup("idle");
    }
  }, [draft.latitude, draft.longitude]);

  useEffect(() => {
    onLocationConfirmedChange?.(mapPinned && comparableLocationPinned(draft));
  }, [mapPinned, draft.latitude, draft.longitude, onLocationConfirmedChange]);

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

  function restoreSubjectView() {
    if (!subjectPin) return;
    setViewEpoch((n) => n + 1);
    showToast("تم الرجوع إلى موقع العقار", "success");
  }

  const areaLabel =
    draft.kind === "building"
      ? "مساحة المباني (م²)"
      : draft.kind === "land"
        ? "مساحة الأرض (م²)"
        : "المساحة (م²)";
  const priceLabel =
    draft.kind === "land" ? "سعر الأرض (ر.س.)" : "السعر (ر.س.)";

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {showCoordinates !== false ? (
        <div className="sm:col-span-2">
          <Label className={FIELD_LABEL}>موقع المقارن على الخريطة</Label>
          <p className="mb-1.5 mt-0 text-[11.5px] leading-relaxed text-text-3">
            الدبوس الأزرق = العقار موضوع التقييم. حدّد موقع المقارن ثم ثبّته قبل
            تعبئة الحقول.
          </p>
          <div className="relative mt-0.5 h-[240px] overflow-hidden rounded-[10px] border border-border sm:h-[280px]">
            <GoogleMapPin
              lat={comparablePin?.lat}
              lng={comparablePin?.lng}
              title="خريطة موقع المقارن"
              interactive={mapInteractive}
              disabled={!mapInteractive}
              mapTypeControl
              resolvePlace={!disabled}
              initialCenter={subjectPin}
              viewCenter={subjectPin}
              viewEpoch={viewEpoch}
              contextPins={contextPins}
              pinLabel={
                [
                  draft.kind === "land"
                    ? "أرض"
                    : draft.comparablePropertyType || "موقع المقارن",
                  draft.district || null,
                ]
                  .filter(Boolean)
                  .join(" · ")
              }
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
              onLocationDetail={
                disabled
                  ? undefined
                  : (detail) => {
                      const current = draftRef.current;
                      const pin = parseComparableCoords(
                        current.latitude,
                        current.longitude,
                      );
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
              }
            />
          </div>
          {!disabled ? (
            <div className="mt-2.5 flex flex-col gap-2">
              {comparablePin && !mapPinned ? (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    className="min-w-0 flex-1"
                    onClick={() => {
                      setMapPinned(true);
                      showToast("تم تثبيت موقع المقارن", "success");
                    }}
                  >
                    تثبيت الموقع
                  </Button>
                  <Button
                    type="button"
                    className="min-w-0 flex-1"
                    disabled={!subjectPin}
                    onClick={restoreSubjectView}
                  >
                    الرجوع إلى الموقع
                  </Button>
                </div>
              ) : null}
              {mapPinned ? (
                <div className="flex gap-2">
                  <div className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[9px] border border-[#B7E4C7] bg-[#F0FFF4] text-[13px] font-bold text-[#1B7A4A]">
                    موقع المقارن مثبت
                  </div>
                  <Button
                    type="button"
                    disabled={!subjectPin}
                    onClick={restoreSubjectView}
                  >
                    الرجوع إلى الموقع
                  </Button>
                  <Button type="button" onClick={() => setMapPinned(false)}>
                    تعديل
                  </Button>
                </div>
              ) : null}
              {!comparablePin ? (
                <Button
                  type="button"
                  className="w-full"
                  disabled={!subjectPin}
                  onClick={restoreSubjectView}
                >
                  الرجوع إلى موقع العقار
                </Button>
              ) : null}
            </div>
          ) : null}
          <p className="mb-0 mt-1.5 text-center text-[11.5px] text-text-3">
            {mapPinned && comparablePin
              ? `الموقع مثبت — ${comparablePin.lat.toFixed(6)}، ${comparablePin.lng.toFixed(6)}`
              : comparablePin
                ? `اضغط تثبيت بعد وضع الدبوس — ${comparablePin.lat.toFixed(6)}، ${comparablePin.lng.toFixed(6)}`
                : "اضغط على الخريطة لتحديد موقع المقارن"}
          </p>
          <p className="mb-0 mt-1 text-center text-[11.5px] font-semibold text-heading">
            {placeLine ||
              (placeLookup === "loading"
                ? "جاري تحديد الحي…"
                : comparablePin
                  ? "تعذّر تحديد الحي — حرّك الدبوس ثم ثبّت مجدداً"
                  : "المدينة والحي يُستخرجان من موقع الدبوس")}
          </p>
        </div>
      ) : null}

      <div className="sm:col-span-2">
        <Label className={FIELD_LABEL}>
          نوع المقارن
          <span className="text-danger"> *</span>
        </Label>
        <div className="flex gap-2">
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
        {fieldsLocked ? (
          <p className="mb-0 mt-1.5 text-[11.5px] text-text-3">
            ثبّت موقع المقارن أولاً لتعبئة البيانات.
          </p>
        ) : draft.kind === "building" ? (
          <p className="mb-0 mt-1.5 text-[11.5px] text-text-3">
            السعر يشمل الأرض ضمن المبنى — لا تُفصل قيمة الأرض. للمقارنة مبنى
            بمبنى (أسلوب السوق).
          </p>
        ) : draft.kind === "land" ? (
          <p className="mb-0 mt-1.5 text-[11.5px] text-text-3">
            لمكوّن الأرض في أسلوب التكلفة، حتى إذا كان موضوع التقييم فيلا.
          </p>
        ) : (
          <p className="mb-0 mt-1.5 text-[11.5px] text-text-3">
            اختر أرضاً أو مبنى.
          </p>
        )}
      </div>

      <Field label={priceLabel} required>
        <Input
          inputMode="decimal"
          dir="ltr"
          value={draft.price}
          disabled={fieldsLocked}
          onChange={(e) => patch("price", e.target.value)}
        />
      </Field>
      <Field label={areaLabel} required>
        <Input
          inputMode="decimal"
          dir="ltr"
          value={draft.areaSqm}
          disabled={fieldsLocked}
          onChange={(e) => patch("areaSqm", e.target.value)}
        />
      </Field>
      <Field label="تاريخ العملية" required>
        <Input
          type="date"
          dir="ltr"
          value={draft.transactionDate}
          disabled={fieldsLocked}
          onChange={(e) => patch("transactionDate", e.target.value)}
        />
      </Field>
      <Field
        label={
          draft.kind === "building"
            ? "سعر متر المباني (محسوب)"
            : draft.kind === "land"
              ? "سعر متر الأرض (محسوب)"
              : "سعر المتر (محسوب)"
        }
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
        <Field label="وصف السعر">
          <Select
            value={draft.priceDescription}
            disabled={fieldsLocked}
            onChange={(e) =>
              patch("priceDescription", e.target.value === "som" ? "som" : "asking")
            }
          >
            <option value="asking">حد</option>
            <option value="som">سوم</option>
          </Select>
        </Field>
      ) : null}
      <Field label="مصدر المعلومة">
        <Select
          value={draft.source}
          disabled={fieldsLocked}
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
      <Field label="رقم التواصل">
        <Input
          dir="ltr"
          value={draft.advertiserPhone}
          disabled={fieldsLocked}
          onChange={(e) => patch("advertiserPhone", e.target.value)}
        />
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
        <Field label="وصف العقار" className="sm:col-span-2">
          <Input
            value={draft.description}
            disabled={fieldsLocked}
            onChange={(e) => patch("description", e.target.value)}
          />
        </Field>
      ) : null}
    </div>
  );
}
