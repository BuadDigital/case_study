"use client";

import { type ReactNode, type RefObject } from "react";

import {
  AppModal,
  Button,
  cn,
  formControlClassName,
  FormRow,
  GoogleMapPin,
  InlineLoadingSkeleton,
  Input,
  Label,
  Note,
  Select,
  Textarea,
} from "@platform/ui-kit";
import { InsDualCalendarDateField } from "../po-intake/PropertyDetailInspectionParts";
import { ReturnedForCorrectionNote } from "../ui/ReturnedForCorrectionNote";
import { RegField, RegTextarea} from "@platform/app-shared/registration/FormFields";
import type { PartyTaskPageDef } from "@platform/app-shared/app-data/party-task-pages";
import { JEDDAH_DEFAULT_LAT, JEDDAH_DEFAULT_LNG } from "@platform/app-shared/domain/jeddah-default-coords";
import { BuildingInventorySection } from "./BuildingInventorySection";
import { InspectionLimitsSection } from "./InspectionLimitsSection";
import { FieldComparableCaptureSection } from "./FieldComparableCaptureSection";
import { InspectorDefinedPhotosSection } from "./InspectorDefinedPhotosSection";
import { InspectorSubmitFooter } from "./InspectorSubmitFooter";
import { InspectorAccessContactFields } from "./InspectorAccessContactFields";
import { InspectorObservationsSection } from "./InspectorObservationsSection";
import { InspectorFeaturesSection } from "./InspectorFeaturesSection";
import { InspectorComponentsSection } from "./InspectorComponentsSection";
import {
  MobileChips,
  MobileFieldLabel,
  MobilePills,
  mobileControlClassName,
} from "./InspectMobileControls";
import {
  INSPECTOR_PHOTO_ACCEPT,
  filterInspectorPhotoFiles,
  useInspectorPhotoDropZone,
} from "../../lib/app-data/inspector-photo-drop";
import {
  approximatePropertyGeo,
  PROPERTY_BOUNDARY_ROWS,
  type PoPropertyIntake,
} from "../../lib/app-data/po-intake-data";
import { InspectorStepNav } from "./InspectorStepNav";
import {
  InspectorPropertyPhotosSection,
  inspectorPhotosLabel,
} from "./InspectorPropertyPhotosSection";
import { PartyCaseStudyFormTab } from "../case-study/PartyCaseStudyFormTab";
import {
  INSPECTOR_AMENITY_OPTIONS,
  INSPECTOR_SERVICE_OPTIONS,
  SITE_LOCATION_ACK_PENDING_MESSAGE,
  inspectorPhotoCoverageLabel,
  inspectorPhotoStampText,
  isCommercialShopInspectionContext,
  isLandInspectionContext,
  mapPinPatchForActor,
  visibleInspectorFeatureFields,
  type InspectorBoundaryKey,
  type InspectorWorkspaceDraft,
} from "../../lib/app-data/inspector-workspace-data";
import { INFATH_FIELD_LABELS } from "../../lib/app-data/infath-field-labels";
import type { WorkflowTask } from "../../lib/app-data/tasks-storage";

import {
  BOUNDARY_KEYS,
  BOUNDARY_ROW_MAP,
  EDIT_CONTROL_CLASS,
  InsBadge,
  FieldInspectionWorkHostRef,
  MobileInspectMap,
  InspectorCard,
} from "./FieldInspectionWorkParts";
export type { FieldInspectionWorkHostRef } from "./FieldInspectionWorkParts";

import { InspectorSaveChip } from "./InspectorSaveChip";
import { INSPECTOR_BUILDING_AREA_INPUTS } from "./field-inspection-work-state";
import { useFieldInspectionWorkflow } from "./useFieldInspectionWorkflow";

export function FieldInspectionWorkBody({
  def,
  task,
  hostRef,
  submitting = false,
  beforeSubmitFooter,
  onRegisterFailure,
  layout = "desktop",
  hideSubmitFooter = false,
}: {
  def: PartyTaskPageDef;
  task: WorkflowTask;
  hostRef: RefObject<FieldInspectionWorkHostRef | null>;
  submitting?: boolean;
  beforeSubmitFooter?: ReactNode;
  onRegisterFailure?: () => void;
  layout?: "desktop" | "mobile";
  hideSubmitFooter?: boolean;
}) {
  const mobile = layout === "mobile";
  const {
    activeStep,
    boundariesUnavailable,
    cancelPendingMapMove,
    captureDeviceGps,
    confirmPendingMapMove,
    draft,
    errorLinks,
    facadeTypeOptions,
    fieldErrors,
    formError,
    keyAvailability,
    locked,
    mapBackup,
    mapPinEpoch,
    mapPinned,
    markDirty,
    pendingMapMove,
    persist,
    property,
    propertyId,
    requestMapMove,
    role,
    saveDraft,
    saveState,
    scrollToErrorTarget,
    setActiveStep,
    setMapPinned,
    showToast,
    submit,
    undoMapMove,
    workLocked,
  } = useFieldInspectionWorkflow({ task, hostRef });

  if (!draft) {
    return <InlineLoadingSkeleton />;
  }

  const liveDraft = draft;
  const photoStamp = inspectorPhotoStampText(liveDraft);
  const photoCoverage = inspectorPhotoCoverageLabel(liveDraft);
  const cardLayout = layout;
  const isLandInspection = isLandInspectionContext({
    vacantLand: liveDraft.vacantLand,
    assetSubject: liveDraft.featureValues.assetSubject,
    classification: property?.classification,
    propertyType: property?.propertyType,
  });
  const isShopInspection = isCommercialShopInspectionContext({
    vacantLand: liveDraft.vacantLand,
    assetSubject: liveDraft.featureValues.assetSubject,
    classification: property?.classification,
    propertyType: property?.propertyType,
  });
  const featureFields = visibleInspectorFeatureFields(isLandInspection);
  return (
    <div className={cn(mobile ? "min-h-full bg-[var(--bg)] pb-2" : "pb-4")}>
      {locked ? (
        <Note tone="success" className={cn("mb-4", mobile && "mx-4 mt-3")}>
          تم إرسال المعاينة — النموذج للقراءة فقط.
        </Note>
      ) : null}

      {draft.status === "reopened" && draft.returnNote?.trim() ? (
        <ReturnedForCorrectionNote
          note={draft.returnNote}
          className={cn("mb-4", mobile && "mx-4 mt-3")}
        />
      ) : null}

      {formError ? (
        <Note tone="warn" role="alert" className={cn("mb-4", mobile && "mx-4 mt-3")}>
          <div className="flex flex-col gap-2">
            <p className="m-0 font-semibold">{formError}</p>
            <p className="m-0 text-[11px] text-text-2">
              تم توجيهك لأول حقل ناقص — الحقول باللون الأحمر مطلوبة.
            </p>
            {errorLinks.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] text-text-2">
                  أو اضغط على الخطأ للانتقال مباشرة:
                </span>
                <div className="flex flex-col gap-2">
                  {errorLinks.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className="flex w-full items-start justify-between gap-3 rounded-xl border border-[#F5C2C7] bg-white px-3 py-2 text-right text-[11px] text-danger-text transition-colors hover:bg-[#FFF5F5]"
                      onClick={() => scrollToErrorTarget(item.targetId)}
                    >
                      <span className="min-w-0 flex-1 leading-5 break-words">
                        {item.message}
                      </span>
                      <span className="shrink-0 text-[10px] text-text-3">
                        فتح
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Note>
      ) : null}

      <InspectorStepNav
        activeStep={activeStep}
        onSelect={setActiveStep}
        className={cn(mobile && "mx-4")}
      />

      <fieldset
        disabled={workLocked}
        className={cn(
          "m-0 min-w-0 border-0 p-0 [&_*]:min-w-0",
          workLocked &&
            "pointer-events-none select-none rounded-[10px] bg-[#F1F5F9] p-3 opacity-70 grayscale-[0.35]",
        )}
      >
        <div id="ins-map-section">
        <InspectorCard
          title="بيانات المعاينة"
          hidden={activeStep !== 1}
          icon="ti-clipboard-check"
          badge={
            <span className="flex items-center gap-2">
              <InspectorSaveChip state={saveState.location} />
              {mobile ? null : <InsBadge label="إلزامي" tone="danger" />}
            </span>
          }
          layout={cardLayout}
          step={1}
          subtitle={mobile ? "موقع GPS للعقار" : undefined}
          defaultOpen
        >
          {mobile ? (
            <div className="mb-2 text-[13px] font-bold text-heading">
              موقع العقار (GPS)
            </div>
          ) : (
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-text-2">
                موقع العقار على الخريطة (GPS)
              </span>
              <InsBadge label="مشترك" tone="purple" />
              <span className="text-[10.5px] text-text-3">
                — إثبات النزول الميداني
              </span>
            </div>
          )}
          <button
            type="button"
            disabled={locked}
            className={cn(
              "mb-2.5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-ink bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] font-inherit text-[14px] font-bold text-ink",
              !mobile && "min-h-10 text-[13px]",
            )}
            onClick={captureDeviceGps}
          >
            <i className="ti ti-current-location text-base" aria-hidden />
            تحديد موقعي الحالي
          </button>
          {!mobile ? (
            <div className="mb-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <div className="mb-1 text-[11px] font-semibold text-text-2">
                  خط العرض
                </div>
                <Input
                  id="ins-lat"
                  dir="ltr"
                  className={EDIT_CONTROL_CLASS}
                  disabled={locked}
                  value={draft.mapLatitude}
                  placeholder={JEDDAH_DEFAULT_LAT}
                  onChange={(e) =>
                    persist(
                      mapPinPatchForActor(
                        draft,
                        e.target.value,
                        draft.mapLongitude,
                        "inspector",
                      ),
                    )
                  }
                />
              </div>
              <div className="min-w-0">
                <div className="mb-1 text-[11px] font-semibold text-text-2">
                  خط الطول
                </div>
                <Input
                  id="ins-lng"
                  dir="ltr"
                  className={EDIT_CONTROL_CLASS}
                  disabled={locked}
                  value={draft.mapLongitude}
                  placeholder={JEDDAH_DEFAULT_LNG}
                  onChange={(e) =>
                    persist(
                      mapPinPatchForActor(
                        draft,
                        draft.mapLatitude,
                        e.target.value,
                        "inspector",
                      ),
                    )
                  }
                />
              </div>
            </div>
          ) : null}
          {fieldErrors.mapLatitude ? (
            <p className="mb-3 text-[11px] font-semibold text-danger-text" role="alert">
              {fieldErrors.mapLatitude}
            </p>
          ) : null}
          {!mobile ? (
            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <div className="mb-1 text-[11px] font-semibold text-text-2">
                  تاريخ المعاينة
                </div>
                <p
                  id="ins-date"
                  dir="ltr"
                  className="m-0 text-[13px] font-semibold text-heading"
                >
                  {draft.inspectionDate || "—"}
                </p>
              </div>
              <div className="min-w-0">
                <div className="mb-1 text-[11px] font-semibold text-text-2">
                  وقت المعاينة
                </div>
                <p
                  id="ins-time"
                  dir="ltr"
                  className="m-0 text-[13px] font-semibold text-heading"
                >
                  {draft.inspectionTime || "—"}
                </p>
              </div>
            </div>
          ) : (
            <div className="mb-2.5 grid grid-cols-2 gap-2">
              <div>
                <div className="mb-1 text-[11px] text-text-2">التاريخ</div>
                <p
                  id="ins-date"
                  dir="ltr"
                  className="m-0 text-[13px] font-semibold text-heading"
                >
                  {draft.inspectionDate || "—"}
                </p>
              </div>
              <div>
                <div className="mb-1 text-[11px] text-text-2">الوقت</div>
                <p
                  id="ins-time"
                  dir="ltr"
                  className="m-0 text-[13px] font-semibold text-heading"
                >
                  {draft.inspectionTime || "—"}
                </p>
              </div>
            </div>
          )}
          <MobileInspectMap
            key={`${draft.mapLatitude},${draft.mapLongitude},${mapPinEpoch}`}
            latitude={draft.mapLatitude}
            longitude={draft.mapLongitude}
            property={property}
            heightClass={mobile ? "h-[180px] rounded-xl" : "h-[200px]"}
            interactive={!locked && !mapPinned}
            onCoordsChange={
              locked || mapPinned
                ? undefined
                : (lat, lng) => requestMapMove(lat, lng)
            }
          />
          {!locked ? (
            <div className="mt-2 flex flex-col gap-2">
              {draft.mapLatitude.trim() && draft.mapLongitude.trim() && !mapPinned ? (
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-ink bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] font-inherit font-bold text-ink",
                    mobile ? "min-h-12 text-[14px]" : "min-h-11 text-[13px]",
                  )}
                  onClick={() => {
                    setMapPinned(true);
                    showToast("تم تثبيت الموقع", "success");
                  }}
                >
                  <i className="ti ti-pin text-base" aria-hidden />
                  تثبيت الموقع
                </button>
              ) : null}
              {mapPinned ? (
                <div className="flex gap-2">
                  <div className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[#B7E4C7] bg-[#F0FFF4] text-[13px] font-bold text-[#1B7A4A]">
                    <i className="ti ti-pin-filled text-base" aria-hidden />
                    الموقع مثبت
                  </div>
                  <button
                    type="button"
                    className="flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface px-3 font-inherit text-[13px] font-bold text-heading"
                    onClick={() => setMapPinned(false)}
                  >
                    تعديل
                  </button>
                </div>
              ) : null}
              {mapBackup ? (
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface font-inherit text-[13px] font-bold text-heading"
                  onClick={undoMapMove}
                >
                  <i className="ti ti-arrow-back-up text-base" aria-hidden />
                  رجوع للموقع السابق
                </button>
              ) : null}
            </div>
          ) : null}
          {mobile ? (
            <div className="mt-1.5 text-center text-[12px] text-text-3" dir="ltr">
              {draft.mapLatitude && draft.mapLongitude
                ? `${draft.mapLatitude}, ${draft.mapLongitude}`
                : "—"}
            </div>
          ) : null}
        </InspectorCard>
        </div>

        <InspectorFeaturesSection
          activeStep={activeStep}
          cardLayout={cardLayout}
          draft={liveDraft}
          featureFields={featureFields}
          fieldErrors={fieldErrors}
          isLandInspection={isLandInspection}
          layout={layout}
          locked={locked}
          mobile={mobile}
          persist={persist}
          photoStamp={photoStamp}
          property={property}
          role={role}
        />

        <InspectorCard
          title="الموقع والوصول"
          hidden={activeStep !== 1}
          icon="ti-road"
          badge={
            <span className="flex items-center gap-2">
              <InspectorSaveChip state={saveState.access} />
              {mobile ? null : <InsBadge label="إدخال ميداني" tone="danger" />}
            </span>
          }
          layout={cardLayout}
          step={2}
          subtitle={mobile ? "الشارع وطريقة الوصول" : undefined}
        >
          {mobile ? (
            <div className="grid gap-3.5">
              <div>
                <MobileFieldLabel>اسم الشارع</MobileFieldLabel>
                <Input
                  id="ins-street"
                  value={draft.streetName}
                  disabled={locked}
                  onChange={(e) => persist({ streetName: e.target.value })}
                  className={mobileControlClassName}
                />
              </div>
              <div>
                <MobileFieldLabel>أقرب شارع رئيسي</MobileFieldLabel>
                <Input
                  id="ins-main-street"
                  value={draft.mainStreetName}
                  disabled={locked}
                  onChange={(e) => persist({ mainStreetName: e.target.value })}
                  className={mobileControlClassName}
                />
              </div>
              <div>
                <MobileFieldLabel>عرض الشارع الرئيسي (م)</MobileFieldLabel>
                <Input
                  id="ins-street-width"
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  value={draft.streetWidthM}
                  disabled={locked}
                  onChange={(e) => persist({ streetWidthM: e.target.value })}
                  className={mobileControlClassName}
                />
              </div>
              <InspectorAccessContactFields
                draft={draft}
                contacts={property?.contacts}
                editable={!locked}
                fieldErrors={fieldErrors}
                layout={mobile ? "mobile" : "desktop"}
                onPatch={(patch) => persist(patch)}
                onAckClick={() =>
                  showToast(SITE_LOCATION_ACK_PENDING_MESSAGE, "info")
                }
              />
            </div>
          ) : (
            <>
              <FormRow className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                <RegField
                  id="ins-street"
                  label="اسم الشارع"
                  value={draft.streetName}
                  onChange={(v) => persist({ streetName: v })}
                />
                <RegField
                  id="ins-main-street"
                  label="أقرب شارع رئيسي"
                  value={draft.mainStreetName}
                  onChange={(v) => persist({ mainStreetName: v })}
                />
                <RegField
                  id="ins-street-width"
                  label="عرض الشارع (م)"
                  type="text"
                  inputMode="decimal"
                  dir="ltr"
                  value={draft.streetWidthM}
                  onChange={(v) => persist({ streetWidthM: v })}
                />
              </FormRow>
              <InspectorAccessContactFields
                draft={draft}
                contacts={property?.contacts}
                editable={!locked}
                fieldErrors={fieldErrors}
                onPatch={(patch) => persist(patch)}
                onAckClick={() =>
                  showToast(SITE_LOCATION_ACK_PENDING_MESSAGE, "info")
                }
              />
            </>
          )}
        </InspectorCard>
        <InspectorCard
          title="تصوير العقار"
          hidden={activeStep !== 1}
          icon="ti-camera"
          badge={<InspectorSaveChip state={saveState.photos} />}
          layout={cardLayout}
          step={3}
          subtitle={mobile ? inspectorPhotosLabel(draft.freePhotos.length) : undefined}
        >
          <InspectorPropertyPhotosSection
            draft={liveDraft}
            disabled={locked}
            actor="inspector"
            mobile={mobile}
            onPatch={(patch) => persist(patch)}
            onDirty={() => markDirty("photos")}
          />
        </InspectorCard>


        {!isLandInspection ? (
        <InspectorComponentsSection
          activeStep={activeStep}
          cardLayout={cardLayout}
          draft={liveDraft}
          fieldErrors={fieldErrors}
          isShopInspection={isShopInspection}
          layout={layout}
          locked={locked}
          mobile={mobile}
          persist={persist}
          photoStamp={photoStamp}
          property={property}
          role={role}
        />
        ) : null}

        <InspectorCard
          title={mobile ? "مساحات المباني" : "مساحات المباني"}
          hidden={activeStep !== 2}
          icon="ti-ruler-measure"
          badge={mobile ? undefined : <InsBadge label="إدخال ميداني" tone="danger" />}
          layout={cardLayout}
          step={3}
          subtitle={mobile ? "م²" : undefined}
        >
          {!isLandInspection ? (
          <>
          {mobile ? (
            <div className="grid gap-3.5">
              {INSPECTOR_BUILDING_AREA_INPUTS.map(([key, label]) => (
                <div key={key}>
                  <MobileFieldLabel>{label}</MobileFieldLabel>
                  <Input
                    id={`ins-${key}`}
                    type="number"
                    value={draft[key]}
                    disabled={locked}
                    onChange={(e) => persist({ [key]: e.target.value })}
                    className={mobileControlClassName}
                  />
                </div>
              ))}
              <div>
                <MobileFieldLabel>{INFATH_FIELD_LABELS.buildingsTotal}</MobileFieldLabel>
                <Input
                  id="ins-buildingsTotal"
                  type="number"
                  value={draft.buildingsTotal}
                  disabled
                  readOnly
                  className={cn(mobileControlClassName, "text-center [direction:ltr] [unicode-bidi:isolate]")}
                />
              </div>
              <div>
                <MobileFieldLabel>رقم رخصة البناء</MobileFieldLabel>
                <Input
                  id="ins-build-license"
                  value={draft.buildLicenseNumber}
                  disabled={locked}
                  onChange={(e) =>
                    persist({ buildLicenseNumber: e.target.value })
                  }
                  className={mobileControlClassName}
                />
              </div>
              <InsDualCalendarDateField
                id="ins-build-license-date"
                label="تاريخ رخصة البناء"
                value={draft.buildLicenseDate}
                disabled={locked}
                onChange={(v) => persist({ buildLicenseDate: v })}
              />
            </div>
          ) : (
            <FormRow className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {INSPECTOR_BUILDING_AREA_INPUTS.map(([key, label]) => (
                <RegField
                  key={key}
                  id={`ins-${key}`}
                  label={label}
                  type="number"
                  value={draft[key]}
                  onChange={(v) => persist({ [key]: v })}
                />
              ))}
              <RegField
                id="ins-buildingsTotal"
                label={INFATH_FIELD_LABELS.buildingsTotal}
                type="number"
                value={draft.buildingsTotal}
                dir="ltr"
                readOnly
                className="[&_input]:text-center"
                onChange={() => {}}
              />
              <RegField
                id="ins-build-license"
                label="رقم رخصة البناء"
                value={draft.buildLicenseNumber}
                onChange={(v) => persist({ buildLicenseNumber: v })}
              />
              <InsDualCalendarDateField
                id="ins-build-license-date-desktop"
                label="تاريخ رخصة البناء"
                value={draft.buildLicenseDate}
                disabled={locked}
                onChange={(v) => persist({ buildLicenseDate: v })}
              />
            </FormRow>
          )}
          <BuildingInventorySection
            poNumber={task.poNumber}
            propertyId={propertyId}
            disabled={workLocked}
            mobile={mobile}
          />
          </>
          ) : null}
          <InspectionLimitsSection
            poNumber={task.poNumber}
            propertyId={propertyId}
            disabled={workLocked}
            mobile={mobile}
          />
        </InspectorCard>

        {!boundariesUnavailable && property ? (
          <InspectorCard
            title="الحدود والأطوال"
            hidden={activeStep !== 2}
            icon="ti-vector"
            badge={
              mobile ? undefined : (
                <InsBadge
                  label="للمطابقة — المصدر: الأخصائي (البورصة)"
                  tone="info"
                />
              )
            }
            layout={cardLayout}
            step={4}
            subtitle={mobile ? "مطابقة الصك" : undefined}
          >
            {mobile ? null : (
              <p className="mb-3 text-[11px] text-text-3">
                الحدود والأطوال يُدخلها الأخصائي عند الاستعلام عن الصك من البورصة.
                دور المعاين هنا <strong>المطابقة واكتشاف الخطأ</strong> فقط — ويطابقها
                أيضاً المكتب الهندسي.
              </p>
            )}
            {BOUNDARY_KEYS.map((key) => {
              const row = BOUNDARY_ROW_MAP[key];
              const desc = property[row.descKey]?.trim() || "—";
              const len = property[row.lenKey]?.trim() || "—";
              const match = draft.boundaryMatches[key];
              if (mobile) {
                return (
                  <div
                    key={key}
                    className="border-b border-border py-3.5 last:border-b-0"
                  >
                    <div className="mb-2.5 flex items-start justify-between gap-2">
                      <span className="text-[14px] font-bold text-heading">
                        {row.label}
                      </span>
                      <span className="shrink-0 text-[13px] text-text-3">
                        {desc} · {len !== "—" ? `${len} م` : "—"}
                      </span>
                    </div>
                    <MobileFieldLabel>نوع الواجهة</MobileFieldLabel>
                    <Select
                      aria-label={`نوع الواجهة — ${row.label}`}
                      value={match.facade}
                      disabled={locked}
                      className={cn(mobileControlClassName, "mb-2.5")}
                      onChange={(e) =>
                        persist({
                          boundaryMatches: {
                            ...draft.boundaryMatches,
                            [key]: { ...match, facade: e.target.value },
                          },
                        })
                      }
                    >
                      <option value="">— اختر —</option>
                      {facadeTypeOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </Select>
                    <MobilePills
                      options={["مطابق", "عدم تطابق"]}
                      value={match.matches ? "مطابق" : "عدم تطابق"}
                      disabled={locked}
                      onChange={(next) =>
                        persist({
                          boundaryMatches: {
                            ...draft.boundaryMatches,
                            [key]: {
                              ...match,
                              matches: next === "مطابق",
                            },
                          },
                        })
                      }
                    />
                    {!match.matches ? (
                      <Input
                        placeholder="ملاحظة عدم التطابق"
                        value={match.mismatchNote}
                        disabled={locked}
                        onChange={(e) =>
                          persist({
                            boundaryMatches: {
                              ...draft.boundaryMatches,
                              [key]: {
                                ...match,
                                mismatchNote: e.target.value,
                              },
                            },
                          })
                        }
                        className={cn(mobileControlClassName, "mt-2")}
                      />
                    ) : null}
                  </div>
                );
              }
              return (
                <div
                  key={key}
                  className="grid grid-cols-1 items-start gap-3 border-b border-border py-2.5 last:border-b-0 md:grid-cols-[90px_150px_1fr_90px_minmax(200px,250px)]"
                >
                  <span className="text-xs font-semibold text-text-2">
                    {row.label}
                  </span>
                  <Select
                    aria-label={`نوع الواجهة — ${row.label}`}
                    value={match.facade}
                    disabled={locked}
                    className="text-[11.5px]"
                    onChange={(e) =>
                      persist({
                        boundaryMatches: {
                          ...draft.boundaryMatches,
                          [key]: { ...match, facade: e.target.value },
                        },
                      })
                    }
                  >
                    <option value="">— اختر —</option>
                    {facadeTypeOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </Select>
                  <span className="text-xs">{desc}</span>
                  <span className="text-xs font-semibold">
                    {len !== "—" ? `${len} م` : "—"}
                  </span>
                  <div>
                    <label className="flex min-h-9 cursor-pointer items-center gap-2.5">
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={match.matches}
                        onChange={(e) =>
                          persist({
                            boundaryMatches: {
                              ...draft.boundaryMatches,
                              [key]: {
                                ...match,
                                matches: e.target.checked,
                              },
                            },
                          })
                        }
                      />
                      <span
                        className={cn(
                          "text-xs font-bold",
                          match.matches ? "text-teal-text" : "text-danger-text",
                        )}
                      >
                        {match.matches ? "مطابق" : "عدم تطابق"}
                      </span>
                    </label>
                    {!match.matches ? (
                      <Textarea
                        rows={2}
                        placeholder="ملاحظة عدم التطابق..."
                        value={match.mismatchNote}
                        onChange={(e) =>
                          persist({
                            boundaryMatches: {
                              ...draft.boundaryMatches,
                              [key]: {
                                ...match,
                                mismatchNote: e.target.value,
                              },
                            },
                          })
                        }
                        className={cn(formControlClassName, "mt-2 min-h-12 text-xs")}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </InspectorCard>
        ) : null}

        <InspectorCard
          title={mobile ? "الخدمات والمرافق" : "الخدمات والمرافق المحيطة"}
          hidden={activeStep !== 2}
          icon="ti-plug"
          badge={mobile ? undefined : <InsBadge label="اختيار متعدد" />}
          layout={cardLayout}
          step={5}
          subtitle={mobile ? "اختيار متعدد" : undefined}
        >
          {mobile ? (
            <>
              <MobileFieldLabel>الخدمات المتوفرة</MobileFieldLabel>
              <MobileChips
                options={INSPECTOR_SERVICE_OPTIONS}
                selected={draft.services}
                disabled={locked}
                onChange={(services) => persist({ services })}
              />
              <div className="h-4" />
              <MobileFieldLabel>المرافق المحيطة</MobileFieldLabel>
              <MobileChips
                options={INSPECTOR_AMENITY_OPTIONS}
                selected={draft.amenities}
                disabled={locked}
                onChange={(amenities) => persist({ amenities })}
              />
            </>
          ) : (
            <>
              <p className="mb-2 text-[11px] font-semibold text-text-2">
                الخدمات المتوفرة
              </p>
              <MobileChips
                options={INSPECTOR_SERVICE_OPTIONS}
                selected={draft.services}
                disabled={locked}
                onChange={(services) => persist({ services })}
              />
              <p className="mb-2 mt-3.5 text-[11px] font-semibold text-text-2">
                المرافق المحيطة
              </p>
              <MobileChips
                options={INSPECTOR_AMENITY_OPTIONS}
                selected={draft.amenities}
                disabled={locked}
                onChange={(amenities) => persist({ amenities })}
              />
            </>
          )}
        </InspectorCard>

        {draft.services.includes("كهرباء") || draft.services.includes("ماء") ? (
          <InspectorCard
            title="عدادات الخدمات"
            hidden={activeStep !== 2}
            icon="ti-hash"
            layout={cardLayout}
          >
            <FormRow className="grid-cols-1 sm:grid-cols-2">
              {draft.services.includes("كهرباء") ? (
                <>
                  <RegField
                    id="ins-elec-meter-count"
                    label="عدد عدادات الكهرباء"
                    type="number"
                    value={draft.electricityMeterCount}
                    onChange={(v) => persist({ electricityMeterCount: v })}
                  />
                  <RegField
                    id="ins-elec-meter-nos"
                    label="أرقام عدادات الكهرباء"
                    value={draft.electricityMeterNumbers}
                    onChange={(v) => persist({ electricityMeterNumbers: v })}
                  />
                </>
              ) : null}
              {draft.services.includes("ماء") ? (
                <>
                  <RegField
                    id="ins-water-meter-count"
                    label="عدد عدادات الماء"
                    type="number"
                    value={draft.waterMeterCount}
                    onChange={(v) => persist({ waterMeterCount: v })}
                  />
                  <RegField
                    id="ins-water-meter-nos"
                    label="أرقام عدادات الماء"
                    value={draft.waterMeterNumbers}
                    onChange={(v) => persist({ waterMeterNumbers: v })}
                  />
                </>
              ) : null}
            </FormRow>
          </InspectorCard>
        ) : null}

        <InspectorCard
          title="الوصف والملاحظات"
          hidden={activeStep !== 3}
          icon="ti-notes"
          badge={mobile ? undefined : <InsBadge label="نص حر" />}
          layout={cardLayout}
          step={1}
          subtitle={mobile ? "نص حر" : undefined}
        >
          {mobile ? (
            <div className="grid gap-3.5">
              <div>
                <MobileFieldLabel>وصف العقار</MobileFieldLabel>
                <Textarea
                  id="ins-desc"
                  rows={3}
                  value={draft.propertyDescription}
                  disabled={locked}
                  onChange={(e) =>
                    persist({ propertyDescription: e.target.value })
                  }
                  className={cn(mobileControlClassName, "min-h-[88px] resize-y")}
                />
              </div>
            </div>
          ) : (
            <>
              <RegTextarea
                id="ins-desc"
                label="وصف العقار"
                rows={3}
                value={draft.propertyDescription}
                onChange={(v) => persist({ propertyDescription: v })}
              />
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="ins-has-violations"
                    className="mb-1 block text-[11px] font-semibold text-text-2"
                  >
                    هل توجد مخالفات ظاهرة؟
                  </label>
                  <Select
                    id="ins-has-violations"
                    value={draft.hasViolations}
                    onChange={(e) =>
                      persist({
                        hasViolations: e.target.value as InspectorWorkspaceDraft["hasViolations"],
                      })
                    }
                    className={cn(formControlClassName, "text-xs")}
                  >
                    <option value="">— اختر —</option>
                    <option value="نعم">نعم</option>
                    <option value="لا">لا</option>
                  </Select>
                </div>
                {draft.hasViolations === "نعم" ? (
                  <RegField
                    id="ins-violations-count"
                    label="عدد المخالفات"
                    type="number"
                    value={draft.violationsCount}
                    onChange={(v) => persist({ violationsCount: v })}
                  />
                ) : null}
              </div>
              {draft.hasViolations === "نعم" ? (
                <RegTextarea
                  id="ins-violations-desc"
                  label="وصف المخالفات"
                  rows={2}
                  className="mt-3"
                  value={draft.violationsDescription}
                  onChange={(v) => persist({ violationsDescription: v })}
                />
              ) : null}
            </>
          )}
        </InspectorCard>

        <div id="ins-defined-photos">
          <InspectorCard
            title={mobile ? "توثيق الخدمات" : "توثيق الخدمات والمرافق"}
            hidden={activeStep !== 3}
            icon="ti-photo"
            layout={cardLayout}
            step={2}
            subtitle={mobile ? photoCoverage : undefined}
            badge={
              mobile ? undefined : (
                <InsBadge label={photoCoverage} tone="info" />
              )
            }
          >
            <InspectorDefinedPhotosSection
              draft={draft}
              disabled={locked}
              onPatch={(patch) => persist(patch)}
              layout={mobile ? "mobile" : "desktop"}
            />
          </InspectorCard>
          {fieldErrors.definedPhotos ? (
            <p className="-mt-2 mb-4 px-4 text-[10px] text-danger-text" role="alert">
              {fieldErrors.definedPhotos}
            </p>
          ) : null}
        </div>

        <InspectorObservationsSection
          activeStep={activeStep}
          cardLayout={cardLayout}
          draft={liveDraft}
          fieldErrors={fieldErrors}
          keyAvailability={keyAvailability}
          layout={layout}
          locked={locked}
          mobile={mobile}
          onRegisterFailure={onRegisterFailure}
          persist={persist}
          photoStamp={photoStamp}
          property={property}
          role={role}
          showToast={showToast}
        />

        <InspectorCard
          title="العقارات المقارنة"
          hidden={activeStep !== 3}
          icon="ti-building-estate"
          layout={cardLayout}
          step={4}
          subtitle={mobile ? "إضافة مقارن" : undefined}
          badge={
            mobile ? undefined : (
              <InsBadge label="من حقول قوائم التقييم" tone="info" />
            )
          }
        >
          <FieldComparableCaptureSection
            latitude={draft.mapLatitude}
            longitude={draft.mapLongitude}
            city={property?.city}
            district={property?.district}
            propertyType={property?.propertyType}
            poNumber={task.poNumber}
            propertyId={propertyId}
            disabled={workLocked}
          />
        </InspectorCard>
        <InspectorCard
          title="أسئلة دراسة الحالة — المعاين"
          hidden={activeStep !== 3}
          icon="ti-list-check"
          layout={cardLayout}
          step={5}
          subtitle={mobile ? "أسئلة الطرف" : undefined}
        >
          <PartyCaseStudyFormTab def={def} childTask={task} forceReadOnly={locked} />
        </InspectorCard>


        {beforeSubmitFooter}

        {!mobile && !locked ? (
          <div className="mt-3.5 flex flex-col gap-3 rounded-lg border border-[color-mix(in_srgb,var(--gold)_35%,transparent)] bg-[color-mix(in_srgb,var(--gold)_10%,transparent)] px-3.5 py-[11px] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2.5">
            <div className="text-xs leading-relaxed text-text-2">
              <strong className="text-gold-d">وضع الإدخال</strong> — تُدخل
              بيانات المعاينة الميدانية وتُرسل بعد اكتمالها.
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="primary"
                loading={submitting}
                disabled={submitting || workLocked}
                onClick={() => void hostRef.current?.submit?.()}
              >
                حفظ وإرسال
              </Button>
              {onRegisterFailure ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={submitting || workLocked}
                  onClick={onRegisterFailure}
                >
                  تسجيل تعذر
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={submitting || workLocked}
                onClick={() => void saveDraft()}
              >
                حفظ مسودة
              </Button>
            </div>
          </div>
        ) : null}

        {!hideSubmitFooter ? (
          <InspectorSubmitFooter
            disabled={workLocked}
            saving={submitting}
            locked={workLocked}
            onRegisterFailure={onRegisterFailure}
            onSaveDraft={() => void saveDraft()}
            onSubmit={() => void hostRef.current?.submit?.()}
          />
        ) : null}
      </fieldset>
      <AppModal
        open={Boolean(pendingMapMove)}
        title="تأكيد تحريك الموقع"
        onClose={cancelPendingMapMove}
        footer={
          <>
            <Button type="button" onClick={cancelPendingMapMove}>
              إلغاء
            </Button>
            <Button
              type="button"
              variant="primary"
              showActionToast={false}
              onClick={confirmPendingMapMove}
            >
              تثبيت الموقع الجديد
            </Button>
          </>
        }
      >
        <p className="m-0 text-[13px] leading-6 text-text-2">
          هل تريد اعتماد هذا الموقع بدل الموقع الحالي؟ يمكنك الرجوع للموقع السابق
          بعد التثبيت.
        </p>
      </AppModal>
    </div>
  );
}
