"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button, GoogleMapPin, Input, Label, Select, useToast } from "@platform/ui-kit";
import {
  COMPARABLE_SOURCE_OPTIONS,
  computedPricePerSqm,
  type ComparableEntryDraft,
} from "../../lib/comparable-entry";

const FIELD_LABEL = "mb-1.5 text-[12px] font-semibold text-text-2";

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <Label className={FIELD_LABEL}>{label}</Label>
      {children}
    </div>
  );
}

export function ComparablePropertyEntryFields({
  draft,
  disabled,
  showCoordinates,
  showDescription,
  onChange,
}: {
  draft: ComparableEntryDraft;
  disabled?: boolean;
  showCoordinates?: boolean;
  showDescription?: boolean;
  onChange: (next: ComparableEntryDraft) => void;
}) {
  const { showToast } = useToast();
  const [mapPinned, setMapPinned] = useState(false);
  const [mapEpoch, setMapEpoch] = useState(0);
  const [homePin, setHomePin] = useState<{
    lat: number;
    lng: number;
    city: string;
    district: string;
  } | null>(() => {
    const lat = Number.parseFloat(draft.latitude);
    const lng = Number.parseFloat(draft.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, city: draft.city, district: draft.district };
  });
  const patch = <K extends keyof ComparableEntryDraft>(
    key: K,
    value: ComparableEntryDraft[K],
  ) => onChange({ ...draft, [key]: value });

  const latNum = Number.parseFloat(draft.latitude);
  const lngNum = Number.parseFloat(draft.longitude);
  const mapPin =
    Number.isFinite(latNum) && Number.isFinite(lngNum)
      ? { lat: latNum, lng: lngNum }
      : null;
  const mapLocked = Boolean(disabled || mapPinned);

  useEffect(() => {
    if (homePin || !mapPin) return;
    setHomePin({
      lat: mapPin.lat,
      lng: mapPin.lng,
      city: draft.city,
      district: draft.district,
    });
  }, [homePin, mapPin, draft.city, draft.district]);

  function restoreHome() {
    if (!homePin) return;
    onChange({
      ...draft,
      latitude: homePin.lat.toFixed(6),
      longitude: homePin.lng.toFixed(6),
      city: homePin.city || draft.city,
      district: homePin.district || draft.district,
    });
    setMapEpoch((n) => n + 1);
    showToast("تم الرجوع إلى الموقع", "success");
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {showCoordinates !== false ? (
        <div className="sm:col-span-2">
          <Label className={FIELD_LABEL}>موقع العقار على الخريطة</Label>
          <div
            key={mapEpoch}
            className="relative mt-0.5 h-[240px] overflow-hidden rounded-[10px] border border-border sm:h-[280px]"
          >
            <GoogleMapPin
              lat={mapPin?.lat}
              lng={mapPin?.lng}
              title="خريطة موقع المقارن"
              interactive={!mapLocked}
              disabled={mapLocked}
              mapTypeControl
              resolvePlace={!mapLocked}
              pinLabel={
                [
                  draft.comparablePropertyType || null,
                  draft.district || null,
                  draft.price ? `${draft.price} ر.س` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "موقع المقارن"
              }
              onCoordsChange={
                mapLocked
                  ? undefined
                  : (lat, lng) =>
                      onChange({
                        ...draft,
                        latitude: lat.toFixed(6),
                        longitude: lng.toFixed(6),
                      })
              }
              onLocationDetail={
                mapLocked
                  ? undefined
                  : (detail) =>
                      onChange({
                        ...draft,
                        latitude: detail.lat.toFixed(6),
                        longitude: detail.lng.toFixed(6),
                        city: detail.city?.trim() || draft.city,
                        district: detail.district?.trim() || draft.district,
                      })
              }
            />
          </div>
          {!disabled ? (
            <div className="mt-2.5 flex flex-col gap-2">
              {mapPin && !mapPinned ? (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    className="min-w-0 flex-1"
                    onClick={() => {
                      setMapPinned(true);
                      showToast("تم تثبيت الموقع", "success");
                    }}
                  >
                    تثبيت الموقع
                  </Button>
                  <Button
                    type="button"
                    className="min-w-0 flex-1"
                    disabled={!homePin}
                    onClick={restoreHome}
                  >
                    الرجوع إلى الموقع
                  </Button>
                </div>
              ) : null}
              {mapPinned ? (
                <div className="flex gap-2">
                  <div className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-[9px] border border-[#B7E4C7] bg-[#F0FFF4] text-[13px] font-bold text-[#1B7A4A]">
                    الموقع مثبت
                  </div>
                  <Button type="button" onClick={() => setMapPinned(false)}>
                    تعديل
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
          <p className="mb-0 mt-1.5 text-center text-[11.5px] text-text-3">
            {mapLocked
              ? mapPin
                ? mapPinned
                  ? `الموقع مثبت — ${mapPin.lat.toFixed(6)}، ${mapPin.lng.toFixed(6)}`
                  : `${mapPin.lat.toFixed(6)}، ${mapPin.lng.toFixed(6)}`
                : "لا موقع محدد"
              : mapPin
                ? `اضغط أو اسحب الدبوس — ${mapPin.lat.toFixed(6)}، ${mapPin.lng.toFixed(6)}`
                : "اضغط على الخريطة لتحديد الموقع (يُعبَّأ الحي والمدينة تلقائياً عند الإمكان)"}
          </p>
        </div>
      ) : null}
      <Field label="العقار المقارن (نوعه)">
        <Input
          value={draft.comparablePropertyType}
          disabled={disabled}
          onChange={(e) => patch("comparablePropertyType", e.target.value)}
        />
      </Field>
      <Field label="نوع العملية">
        <Select
          value={draft.transactionKind}
          disabled={disabled}
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
            disabled={disabled}
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
          disabled={disabled}
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
          disabled={disabled}
          onChange={(e) => patch("listingNumber", e.target.value)}
        />
      </Field>
      <Field label="رقم التواصل">
        <Input
          dir="ltr"
          value={draft.advertiserPhone}
          disabled={disabled}
          onChange={(e) => patch("advertiserPhone", e.target.value)}
        />
      </Field>
      <Field label="المساحة (م²)">
        <Input
          inputMode="decimal"
          dir="ltr"
          value={draft.areaSqm}
          disabled={disabled}
          onChange={(e) => patch("areaSqm", e.target.value)}
        />
      </Field>
      <Field label="تاريخ العملية">
        <Input
          type="date"
          dir="ltr"
          value={draft.transactionDate}
          disabled={disabled}
          onChange={(e) => patch("transactionDate", e.target.value)}
        />
      </Field>
      <Field label="السعر (ر.س.)">
        <Input
          inputMode="decimal"
          dir="ltr"
          value={draft.price}
          disabled={disabled}
          onChange={(e) => patch("price", e.target.value)}
        />
      </Field>
      <Field label="سعر المتر (محسوب)">
        <Input
          readOnly
          dir="ltr"
          value={computedPricePerSqm(draft.price, draft.areaSqm)}
          className="bg-surface-2"
        />
      </Field>
      <Field label="المدينة">
        <Input
          value={draft.city}
          disabled={disabled}
          onChange={(e) => patch("city", e.target.value)}
        />
      </Field>
      <Field label="الحي">
        <Input
          value={draft.district}
          disabled={disabled}
          onChange={(e) => patch("district", e.target.value)}
        />
      </Field>
      <Field label="رقم المخطط">
        <Input
          value={draft.planNumber}
          disabled={disabled}
          onChange={(e) => patch("planNumber", e.target.value)}
        />
      </Field>
      <Field label="القطعة">
        <Input
          value={draft.plotNumber}
          disabled={disabled}
          onChange={(e) => patch("plotNumber", e.target.value)}
        />
      </Field>
      {showDescription !== false ? (
        <Field label="وصف العقار" className="sm:col-span-2">
          <Input
            value={draft.description}
            disabled={disabled}
            onChange={(e) => patch("description", e.target.value)}
          />
        </Field>
      ) : null}
    </div>
  );
}
