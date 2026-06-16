"use client";

import { Button, Input, Label, Note, cn } from "@platform/design-system";
import {
  RegField,
  RegSelect,
  RegTextarea,
} from "@platform/app-shared/registration/FormFields";
import {
  FIELD_INSPECTION_ACCESS_OPTIONS,
  FIELD_INSPECTION_CONDITION_OPTIONS,
  FIELD_INSPECTION_MARKET_ACTIVITY_OPTIONS,
  FIELD_INSPECTION_PHOTO_SLOTS,
  FIELD_INSPECTION_PROPERTY_TYPE_OPTIONS,
  FIELD_INSPECTION_SIGNATORY_ROLE_OPTIONS,
  type FieldInspectionAccess,
  type FieldInspectionCondition,
  type FieldInspectionMarketActivity,
  type FieldInspectionPropertyType,
  type FieldInspectionRentalStatus,
  type FieldInspectionSignatoryRole,
  type FieldInspectionSubmission,
} from "../lib/prototype/field-inspection-data";
import type { FieldInspectionFieldErrors } from "../lib/prototype/field-inspection-validation";
import { FieldInspectionInfathSection } from "../components/field-inspection/FieldInspectionInfathSection";

const FIELD_FORM =
  "mb-3 rounded-lg border border-border bg-surface-2 p-4";
const FIELD_SEC_TITLE =
  "mb-3 border-b border-border pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary";
const FORM_ROW =
  "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4";
const FORM_GROUP = "flex flex-col gap-1";
const RADIO_GROUP = "mt-1 flex flex-wrap gap-3";
const RADIO_OPT =
  "inline-flex cursor-pointer items-center gap-1.5 text-xs text-text-2";
const PHOTO_GRID = "mt-2 grid grid-cols-4 gap-2";
const PHOTO_PH =
  "flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded border-2 border-dashed border-border-md bg-surface-3 text-[10px] text-text-3 transition-colors hover:border-primary-light hover:text-primary-light disabled:cursor-not-allowed disabled:opacity-60";

export type FieldFormViewProps = {
  embedded?: boolean;
  value: FieldInspectionSubmission;
  onChange: (
    patch: Partial<
      Pick<
        FieldInspectionSubmission,
        | "propertyType"
        | "areaDistrict"
        | "actualAreaSqm"
        | "structuralCondition"
        | "hasMovableItems"
        | "isCurrentlyRented"
        | "accessDifficulty"
        | "avgPricePerSqm"
        | "marketActivityLevel"
        | "marketNotes"
        | "responsiblePersonName"
        | "responsiblePersonRole"
        | "signedDocumentPhotos"
        | "propertyPhotos"
        | "generalNotes"
        | "inspectionDate"
        | "facade"
        | "streetWidthM"
        | "builtAreaSqm"
        | "propertyUsage"
        | "streetName"
        | "mainStreetName"
        | "mapLatitude"
        | "mapLongitude"
        | "roomCount"
        | "hallCount"
        | "unitCount"
        | "bathroomCount"
        | "propertyAgeYears"
        | "showroomCount"
        | "towerCount"
        | "wellCount"
        | "hasKitchen"
        | "hasCarEntrance"
        | "hasBasement"
        | "hasElevator"
        | "hasPool"
        | "districtState"
        | "availableServices"
        | "surroundingAmenities"
        | "propertyDescription"
        | "districtProsCons"
        | "accessRouteDescription"
        | "assetNotes"
        | "buildingFloors"
        | "basementTotalSqm"
        | "annexTotalSqm"
        | "buildingsTotalSqm"
        | "exteriorPhotosPdf"
        | "interiorPhotosPdf"
      >
    >,
  ) => void;
  disabled?: boolean;
  fieldErrors?: FieldInspectionFieldErrors;
  saving?: boolean;
  onSaveDraft?: () => void;
  onSubmit?: () => void;
};

export function FieldFormView({
  embedded = false,
  value,
  onChange,
  disabled = false,
  fieldErrors = {},
  saving = false,
  onSaveDraft,
  onSubmit,
}: FieldFormViewProps) {
  const toggleSignedPhoto = (index: number) => {
    const next = [...value.signedDocumentPhotos];
    while (next.length < 3) next.push("");
    next[index] = next[index]?.trim()
      ? ""
      : `signed-doc-${index + 1}.jpg`;
    onChange({ signedDocumentPhotos: next });
  };

  const togglePropertyPhoto = (key: (typeof FIELD_INSPECTION_PHOTO_SLOTS)[number]["key"]) => {
    const current = value.propertyPhotos[key]?.trim() ?? "";
    onChange({
      propertyPhotos: {
        ...value.propertyPhotos,
        [key]: current ? "" : `${key}.jpg`,
      },
    });
  };

  return (
    <>
      {!embedded ? (
        <Note tone="info">
          هذا النموذج مُحسَّن للموبايل — يفتحه المعاين في الميدان بجانب برنامج
          مقياس
        </Note>
      ) : null}
      <fieldset disabled={disabled} className="contents">
      <div className={FIELD_FORM}>
        <div className={FIELD_SEC_TITLE}>١ — بيانات العقار الأساسية</div>
        <div className={FORM_ROW}>
          <div className={FORM_GROUP}>
            <Label htmlFor="ff-id" className="text-[11px] font-semibold text-text-2">
              رقم العقار
            </Label>
            <Input
              id="ff-id"
              readOnly
              value={value.propertyDisplayId}
              className="bg-surface-3 text-xs"
            />
          </div>
          <RegSelect
            id="ff-type"
            label="نوع العقار"
            value={value.propertyType}
            disabled={disabled}
            error={fieldErrors.propertyType}
            placeholder="— اختر —"
            options={FIELD_INSPECTION_PROPERTY_TYPE_OPTIONS}
            onChange={(v) =>
              onChange({
                propertyType: v as FieldInspectionPropertyType | "",
              })
            }
          />
          <RegField
            id="ff-area"
            label="المنطقة / الحي"
            value={value.areaDistrict}
            placeholder="مثال: حي النزهة، مكة المكرمة"
            onChange={(v) => onChange({ areaDistrict: v })}
          />
          <RegField
            id="ff-sqm"
            label="المساحة الفعلية (م²)"
            type="number"
            value={value.actualAreaSqm}
            placeholder="0.00"
            onChange={(v) => onChange({ actualAreaSqm: v })}
          />
        </div>
      </div>
      <div className={FIELD_FORM}>
        <div className={FIELD_SEC_TITLE}>٢ — حالة العقار</div>
        <div className={FORM_GROUP}>
          <span className="text-[11px] font-semibold text-text-2">الحالة الإنشائية</span>
          <div className={RADIO_GROUP}>
            {FIELD_INSPECTION_CONDITION_OPTIONS.map((o) => (
              <label key={o} className={RADIO_OPT}>
                <input
                  type="radio"
                  name="cond"
                  checked={value.structuralCondition === o}
                  disabled={disabled}
                  onChange={() =>
                    onChange({ structuralCondition: o as FieldInspectionCondition })
                  }
                />{" "}
                {o}
              </label>
            ))}
          </div>
        </div>
        <div className={FORM_GROUP}>
          <span className="text-[11px] font-semibold text-text-2">هل يوجد منقولات داخل العقار؟</span>
          <div className={RADIO_GROUP}>
            <label className={RADIO_OPT}>
              <input
                type="radio"
                name="items"
                checked={value.hasMovableItems === true}
                disabled={disabled}
                onChange={() => onChange({ hasMovableItems: true })}
              />{" "}
              نعم
            </label>
            <label className={RADIO_OPT}>
              <input
                type="radio"
                name="items"
                checked={value.hasMovableItems === false}
                disabled={disabled}
                onChange={() => onChange({ hasMovableItems: false })}
              />{" "}
              لا
            </label>
          </div>
        </div>
        <div className={FORM_GROUP}>
          <span className="text-[11px] font-semibold text-text-2">هل العقار مؤجر حالياً؟</span>
          <div className={RADIO_GROUP}>
            {(
              [
                ["yes", "نعم"],
                ["no", "لا"],
                ["unknown", "غير معروف"],
              ] as const
            ).map(([rentValue, label]) => (
              <label key={rentValue} className={RADIO_OPT}>
                <input
                  type="radio"
                  name="rent"
                  checked={value.isCurrentlyRented === rentValue}
                  disabled={disabled}
                  onChange={() =>
                    onChange({
                      isCurrentlyRented: rentValue as FieldInspectionRentalStatus,
                    })
                  }
                />{" "}
                {label}
              </label>
            ))}
          </div>
        </div>
        <div className={FORM_GROUP}>
          <span className="text-[11px] font-semibold text-text-2">إمكانية الوصول للعقار</span>
          <div className={RADIO_GROUP}>
            {FIELD_INSPECTION_ACCESS_OPTIONS.map((o) => (
              <label key={o} className={RADIO_OPT}>
                <input
                  type="radio"
                  name="acc"
                  checked={value.accessDifficulty === o}
                  disabled={disabled}
                  onChange={() =>
                    onChange({ accessDifficulty: o as FieldInspectionAccess })
                  }
                />{" "}
                {o}
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className={FIELD_FORM}>
        <div className={FIELD_SEC_TITLE}>٣ — البيانات السوقية</div>
        <div className={FORM_ROW}>
          <RegField
            id="ff-price"
            label="متوسط سعر م² في المنطقة"
            type="number"
            value={value.avgPricePerSqm}
            placeholder="ريال / م²"
            onChange={(v) => onChange({ avgPricePerSqm: v })}
          />
          <RegSelect
            id="ff-market"
            label="مستوى نشاط السوق"
            value={value.marketActivityLevel}
            disabled={disabled}
            placeholder="— اختر —"
            options={FIELD_INSPECTION_MARKET_ACTIVITY_OPTIONS}
            onChange={(v) =>
              onChange({
                marketActivityLevel: v as FieldInspectionMarketActivity | "",
              })
            }
          />
        </div>
        <RegTextarea
          id="ff-mkt-note"
          label="ملاحظات سوقية إضافية"
          rows={2}
          value={value.marketNotes}
          placeholder="أي معلومات إضافية عن السوق..."
          onChange={(v) => onChange({ marketNotes: v })}
        />
      </div>
      <div className={FIELD_FORM}>
        <div className={FIELD_SEC_TITLE}>٤ — المستندات الموقعة</div>
        <div className={FORM_ROW}>
          <RegField
            id="ff-sign-name"
            label="اسم الشخص المسؤول"
            value={value.responsiblePersonName}
            placeholder="الاسم الكامل"
            onChange={(v) => onChange({ responsiblePersonName: v })}
          />
          <RegSelect
            id="ff-sign-title"
            label="صفته"
            value={value.responsiblePersonRole}
            disabled={disabled}
            placeholder="— اختر —"
            options={FIELD_INSPECTION_SIGNATORY_ROLE_OPTIONS}
            onChange={(v) =>
              onChange({
                responsiblePersonRole: v as FieldInspectionSignatoryRole | "",
              })
            }
          />
        </div>
        <div className={FORM_GROUP}>
          <span className="text-[11px] font-semibold text-text-2">صور المستندات الموقعة</span>
          <div className={PHOTO_GRID}>
            {value.signedDocumentPhotos.slice(0, 3).map((fileName, n) => (
              <button
                key={n}
                type="button"
                className={cn(
                  PHOTO_PH,
                  fileName.trim() && "border-primary bg-info-bg text-primary",
                )}
                disabled={disabled}
                onClick={() => toggleSignedPhoto(n)}
              >
                📷
                <span>{fileName.trim() || "إضافة صورة"}</span>
              </button>
            ))}
            <button type="button" className={PHOTO_PH} disabled={disabled}>
              +<span>المزيد</span>
            </button>
          </div>
        </div>
      </div>
      <div className={FIELD_FORM}>
        <div className={FIELD_SEC_TITLE}>٥ — صور العقار</div>
        <div className={PHOTO_GRID}>
          {FIELD_INSPECTION_PHOTO_SLOTS.map(({ key, label }) => {
            const fileName = value.propertyPhotos[key]?.trim() ?? "";
            return (
              <button
                key={key}
                type="button"
                className={cn(
                  PHOTO_PH,
                  fileName && "border-primary bg-info-bg text-primary",
                )}
                disabled={disabled}
                onClick={() => togglePropertyPhoto(key)}
              >
                📷<span>{fileName || label}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3">
          <RegTextarea
            id="ff-gen"
            label="ملاحظات عامة"
            rows={2}
            value={value.generalNotes}
            placeholder="أي ملاحظات إضافية..."
            onChange={(v) => onChange({ generalNotes: v })}
          />
        </div>
      </div>
      <FieldInspectionInfathSection
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
      </fieldset>
      {!embedded ? (
        <div className="flex gap-2.5">
          <Button
            type="button"
            variant="primary"
            disabled={disabled || saving}
            onClick={onSubmit}
          >
            {saving ? "جاري الإرسال…" : "حفظ وإرسال"}
          </Button>
          <Button
            type="button"
            variant="default"
            disabled={disabled || saving}
            onClick={onSaveDraft}
          >
            حفظ مسودة
          </Button>
        </div>
      ) : null}
    </>
  );
}
