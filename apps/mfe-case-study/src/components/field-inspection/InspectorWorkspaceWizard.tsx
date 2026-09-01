"use client";

/**
 * Field Inspection Workspace — source of truth:
 * `Field Inspection Workspace.dc.html`
 * Only the three wizard steps from that design.
 */

import { useMemo, useState } from "react";
import {
  Button,
  cn,
  GoogleMapPin,
  Select,
  useToast,
} from "@platform/ui-kit";
import { DetailBadge } from "../po-intake/PropertyDetailFields";
import {
  PROPERTY_BOUNDARY_ROWS,
  approximatePropertyGeo,
  boundariesMarkedUnavailable,
  type PoPropertyIntake,
} from "../../lib/prototype/po-intake-data";
import {
  SITE_LOCATION_ACK_PENDING_MESSAGE,
  INSPECTOR_AMENITY_OPTIONS,
  INSPECTOR_OBSERVATION_CATEGORIES,
  INSPECTOR_SERVICE_OPTIONS,
  isSpecialistProofService,
  isLandInspectionContext,
  isShopHiddenInspectorComponentKey,
  isCommercialShopInspectionContext,
  inspectorPhotoCoverageLabel,
  newObservationId,
  patchInspectorFeatureValues,
  visibleInspectorFeatureFields,
  type InspectorBoundaryKey,
  type InspectorWorkspaceDraft,
} from "../../lib/prototype/inspector-workspace-data";
import { InspectorStepNav, type InspectorStepId } from "./InspectorStepNav";
import { InspectorFeatureWizardFields } from "./InspectorFeatureWizardFields";
import { InspectorPropertyPhotosSection } from "./InspectorPropertyPhotosSection";
import { InspectorDefinedPhotosSection } from "./InspectorDefinedPhotosSection";
import { FieldComparableCaptureSection } from "./FieldComparableCaptureSection";
import { ComponentCountWithPhotoField, InsCard, InsDualCalendarDateField, InsEditField, InsEditTextarea, InsFieldsGrid, ChipRow, EDIT_CONTROL_CLASS } from "../po-intake/PropertyDetailInspectionParts";
import { INFATH_FIELD_LABELS } from "../../lib/prototype/infath-field-labels";
import { INS_LABEL_CLASS, INS_TH_CLASS, INS_TD_CLASS, INS_WIZARD_PIN_BUTTON_CLASS } from "./FieldInspectionWorkParts";
import { InspectorCaseStudyChips } from "./InspectorCaseStudyChips";
import { InspectorAccessContactFields } from "./InspectorAccessContactFields";
import {
  SpecialistServiceProofPhotoFields,
  withoutSpecialistProofSlots,
} from "./SpecialistServiceProofPhotoFields";
import type { PropertyDetailDocumentEntry } from "../../lib/prototype/property-detail-documents";
import { useFacadeOptions } from "../../query/use-facade-options";
import type { InspectorWorkspaceFieldErrors } from "../../lib/prototype/inspector-workspace-validation";
import type { PartyTaskPageDef } from "@platform/app-shared/prototype/party-task-pages";
import type { WorkflowTask } from "../../lib/prototype/tasks-storage";

const DESIGN_AMENITIES = [
  "مدارس",
  "مستشفيات",
  "مساجد",
  "أسواق تجارية",
  "طرق رئيسية",
  "حدائق",
] as const;

const COMPONENT_BOOL_KEYS = [
  "carEntrance",
  "hasBasement",
  "hasElevator",
  "hasPool",
  "kitchen",
] as const;

function boolPill(on: boolean, disabled = false) {
  return cn(
    "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-[7px] font-inherit text-xs font-semibold",
    disabled ? "cursor-default" : "cursor-pointer",
    on ? "border-ink bg-ink text-white" : "border-border-md bg-surface text-text-2",
  );
}

export function InspectorWorkspaceWizard({
  property,
  draft,
  inspectionTask,
  caseStudyDef,
  includeRetiredFeatureKeys,
  serviceProofFromTransactionPhotos = false,
  transactionPhotos = [],
  locked,
  saving,
  fieldErrors = {},
  onPatch,
  onSubmit,
  onCancel,
  onMapMove,
  mapPinned,
  onPin,
  mapPinEpoch,
  /** Property-detail review: show all design sections at once (no step filter). */
  flat = false,
}: {
  property: PoPropertyIntake;
  draft: InspectorWorkspaceDraft;
  inspectionTask: WorkflowTask;
  caseStudyDef?: PartyTaskPageDef;
  includeRetiredFeatureKeys?: readonly string[];
  /** Case-study specialist: proof photos for كهرباء/ماء from transaction images. */
  serviceProofFromTransactionPhotos?: boolean;
  transactionPhotos?: PropertyDetailDocumentEntry[];
  locked: boolean;
  saving: boolean;
  fieldErrors?: InspectorWorkspaceFieldErrors;
  onPatch: (patch: Partial<InspectorWorkspaceDraft>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  onMapMove: (lat: number, lng: number) => void;
  mapPinned: boolean;
  onPin: () => void;
  mapPinEpoch: number;
  flat?: boolean;
}) {
  const [activeStep, setActiveStep] = useState<InspectorStepId>(1);
  const [doneSteps, setDoneSteps] = useState<Set<InspectorStepId>>(
    () => new Set(flat ? ([1, 2, 3] as InspectorStepId[]) : []),
  );
  const editable = !locked;
  const showStep = (step: InspectorStepId) => flat || activeStep === step;
  const { showToast } = useToast();
  const catalogFacadeOptions = useFacadeOptions();
  const facadeTypeOptions =
    catalogFacadeOptions ??
    ["دهان", "حجر", "رخام", "زجاج", "طوب", "بدون تشطيب", "أخرى"];

  const mapGeo = useMemo(() => {
    const lat = Number(draft.mapLatitude);
    const lng = Number(draft.mapLongitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    return approximatePropertyGeo(property);
  }, [draft.mapLatitude, draft.mapLongitude, property]);

  const isLand = isLandInspectionContext({
    vacantLand: draft.vacantLand,
    assetSubject: draft.featureValues.assetSubject,
    classification: property.classification,
    propertyType: property.propertyType,
  });
  const isShop = isCommercialShopInspectionContext({
    vacantLand: draft.vacantLand,
    assetSubject: draft.featureValues.assetSubject,
    classification: property.classification,
    propertyType: property.propertyType,
  });
  const showShop = (key: string) =>
    !isShop || !isShopHiddenInspectorComponentKey(key);

  const featureFields = useMemo(
    () =>
      visibleInspectorFeatureFields(isLand, {
        includeRetiredKeys: includeRetiredFeatureKeys,
      }).filter(
        (f) =>
          !COMPONENT_BOOL_KEYS.includes(
            f.key as (typeof COMPONENT_BOOL_KEYS)[number],
          ),
      ),
    [isLand, includeRetiredFeatureKeys],
  );

  const coordsValue =
    draft.mapLatitude.trim() && draft.mapLongitude.trim()
      ? `${draft.mapLatitude.trim()}, ${draft.mapLongitude.trim()}`
      : "";

  const photoCoverage = inspectorPhotoCoverageLabel(draft);

  function advance() {
    setDoneSteps((prev) => {
      const next = new Set(prev);
      next.add(activeStep);
      return next;
    });
    setActiveStep((prev) => (prev === 3 ? prev : ((prev + 1) as InspectorStepId)));
  }

  return (
    <div>
      {!flat ? (
        <InspectorStepNav
          activeStep={activeStep}
          doneSteps={doneSteps}
          onSelect={setActiveStep}
        />
      ) : null}

      {showStep(1) ? (
        <>
          <InsCard title="تحديد موقع العقار" step={1}>
            <div
              key={`${draft.mapLatitude},${draft.mapLongitude},${mapPinEpoch}`}
              className="relative h-[280px] overflow-hidden rounded-lg border border-border"
            >
              {mapGeo || editable ? (
                <GoogleMapPin
                  lat={mapGeo?.lat}
                  lng={mapGeo?.lng}
                  title="خريطة المعاينة"
                  interactive={editable && !mapPinned}
                  onCoordsChange={
                    editable && !mapPinned
                      ? (lat, lng) => onMapMove(lat, lng)
                      : undefined
                  }
                />
              ) : (
                <div className="grid h-full place-items-center bg-surface-2 text-xs text-text-3">
                  لا تتوفر إحداثيات بعد
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-2.5">
              <div className="min-w-[240px] flex-1">
                <span className={INS_LABEL_CLASS}>
                  الإحداثيات
                </span>
                {editable ? (
                  <input
                    className={cn(EDIT_CONTROL_CLASS, "tabular-nums")}
                    dir="ltr"
                    placeholder="21.523339, 39.187743"
                    value={coordsValue}
                    onChange={(e) => {
                      const parts = e.target.value.split(/[,،]/);
                      onPatch({
                        mapLatitude: (parts[0] || "").trim(),
                        mapLongitude: (parts[1] || "").trim(),
                      });
                    }}
                  />
                ) : (
                  <div className="py-0.5 text-[13px] font-semibold tabular-nums text-heading [direction:ltr]">
                    {coordsValue || "—"}
                  </div>
                )}
              </div>
              {editable ? (
                <button
                  type="button"
                  className={INS_WIZARD_PIN_BUTTON_CLASS}
                  onClick={onPin}
                >
                  تثبيت الموقع
                </button>
              ) : null}
            </div>
          </InsCard>

          <InsCard title="بيانات الموقع والوصول" step={2}>
            <InsFieldsGrid min={150}>
              <InsEditField
                label="اسم الشارع"
                value={draft.streetName}
                
                onChange={(v) => onPatch({ streetName: v })}
              disabled={!editable} />
              <InsEditField
                label="أقرب شارع رئيسي"
                value={draft.mainStreetName}
                
                onChange={(v) => onPatch({ mainStreetName: v })}
              disabled={!editable} />
              <InsEditField
                label="عرض الشارع الرئيسي (م)"
                value={draft.streetWidthM}
                ltr
                inputMode="decimal"
                
                onChange={(v) => onPatch({ streetWidthM: v })}
              disabled={!editable} />
            </InsFieldsGrid>
            <InspectorAccessContactFields
              draft={draft}
              contacts={property.contacts}
              editable={editable}
              fieldErrors={fieldErrors}
              onPatch={onPatch}
              onAckClick={() =>
                showToast(SITE_LOCATION_ACK_PENDING_MESSAGE, "info")
              }
            />
          </InsCard>

          <InsCard title="تصوير العقار" step={3}>
            <InspectorPropertyPhotosSection
              draft={draft}
              disabled={!editable}
              onPatch={onPatch}
            />
          </InsCard>

          {editable && !flat ? (
            <StepContinue onContinue={advance} />
          ) : null}
        </>
      ) : null}

      {showStep(2) ? (
        <>
          <InsCard title="خصائص العقار">
            <InspectorFeatureWizardFields
              fields={featureFields}
              draft={draft}
              deedNumber={property.deedNumber}
              emptyFeatureKeys={fieldErrors.emptyFeatureKeys}
              missingFeaturePhotoKey={fieldErrors.missingFeaturePhotoKey}
              movablesDescriptionError={fieldErrors.movablesDescription}
              occupancyDescriptionError={fieldErrors.occupancyDescription}
              hidePhotos
              disabled={!editable}
              onPatch={onPatch}
            />
          </InsCard>

          {!isLand ? (
            <InsCard title="مكوّنات العقار">
              <InsFieldsGrid min={130} centered>
                {showShop("roomCount") ? (
                  <InsEditField
                    label="عدد الغرف"
                    value={draft.roomCount}
                    ltr
                    
                    onChange={(v) => onPatch({ roomCount: v })}
                  disabled={!editable} />
                ) : null}
                {showShop("hallCount") ? (
                  <InsEditField
                    label="عدد الصالات"
                    value={draft.hallCount}
                    ltr
                    
                    onChange={(v) => onPatch({ hallCount: v })}
                  disabled={!editable} />
                ) : null}
                {showShop("unitCount") ? (
                  <InsEditField
                    label="عدد الشقق"
                    value={draft.unitCount}
                    ltr
                    
                    onChange={(v) => onPatch({ unitCount: v })}
                  disabled={!editable} />
                ) : null}
                <InsEditField
                  label="دورات المياه"
                  value={draft.bathroomCount}
                  ltr
                  
                  onChange={(v) => onPatch({ bathroomCount: v })}
                disabled={!editable} />
                <ComponentCountWithPhotoField
                  label="المعارض"
                  countValue={draft.showroomCount}
                  photoKey="showroom"
                  photoLabel="إرفاق صورة للمعرض التجاري"
                  attachment={draft.componentPhotoAttachments.showroom}
                  taskId={draft.taskId}
                  stamp=""
                  deedNumber={property.deedNumber}
                  draft={draft}
                  editMode={editable}
                  disabled={locked}
                  onPatch={onPatch}
                />
                {showShop("wellCount") ? (
                  <ComponentCountWithPhotoField
                    label="الآبار"
                    countValue={draft.wellCount}
                    photoKey="well"
                    photoLabel="إرفاق صورة البئر"
                    attachment={draft.componentPhotoAttachments.well}
                    taskId={draft.taskId}
                    stamp=""
                    deedNumber={property.deedNumber}
                    draft={draft}
                    editMode={editable}
                    disabled={locked}
                    onPatch={onPatch}
                  />
                ) : null}
                {showShop("towerCount") ? (
                  <InsEditField
                    label="الأبراج"
                    value={draft.towerCount}
                    ltr
                    
                    onChange={(v) => onPatch({ towerCount: v })}
                  disabled={!editable} />
                ) : null}
              </InsFieldsGrid>
              <div className="mt-3.5 flex flex-wrap gap-2 border-t border-border pt-3">
                <button
                  type="button"
                  disabled={!editable}
                  className={boolPill(draft.hasAnnex === "نعم", !editable)}
                  onClick={() =>
                    editable &&
                    onPatch({
                      hasAnnex: draft.hasAnnex === "نعم" ? "لا" : "نعم",
                    })
                  }
                >
                  يوجد ملحق
                </button>
                {COMPONENT_BOOL_KEYS.map((key) => {
                  const field = visibleInspectorFeatureFields(false).find(
                    (f) => f.key === key,
                  );
                  if (!field || isLand) return null;
                  const on = (draft.featureValues[key] ?? "") === "نعم";
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={!editable}
                      className={boolPill(on, !editable)}
                      onClick={() =>
                        editable &&
                        onPatch({
                          featureValues: patchInspectorFeatureValues(
                            draft.featureValues,
                            key,
                            on ? "لا" : "نعم",
                          ),
                        })
                      }
                    >
                      {field.label}
                    </button>
                  );
                })}
              </div>
              {draft.hasAnnex === "نعم" ? (
                <div className="mt-2.5 flex flex-wrap gap-4 rounded-lg bg-surface-2 px-3 py-2.5">
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-text-2">
                    <input
                      type="checkbox"
                      className="size-[15px] accent-ink"
                      checked={Boolean(draft.annexUpperCount.trim())}
                      
                      onChange={(e) =>
                        onPatch({
                          annexUpperCount: e.target.checked ? "1" : "",
                        })
                      }
                    />
                    ملحق علوي
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5 text-xs text-text-2">
                    <input
                      type="checkbox"
                      className="size-[15px] accent-ink"
                      checked={Boolean(draft.annexGroundCount.trim())}
                      
                      onChange={(e) =>
                        onPatch({
                          annexGroundCount: e.target.checked ? "1" : "",
                        })
                      }
                    />
                    ملحق سفلي
                  </label>
                </div>
              ) : null}
            </InsCard>
          ) : null}

          {!isLand ? (
            <InsCard title="مساحات المباني">
              <InsFieldsGrid min={140} centered>
                <InsEditField
                  label="مساحة البناء (م²)"
                  value={draft.builtArea}
                  ltr
                  onChange={(v) => editable && onPatch({ builtArea: v })}
                disabled={!editable} />
                <InsEditField
                  label="عدد أدوار المباني"
                  value={draft.buildingFloors}
                  ltr
                  onChange={(v) => editable && onPatch({ buildingFloors: v })}
                disabled={!editable} />
                <InsEditField
                  label="إجمالي مساحة القبو (م²)"
                  value={draft.basementTotal}
                  ltr
                  onChange={(v) => editable && onPatch({ basementTotal: v })}
                disabled={!editable} />
                <InsEditField
                  label="إجمالي مساحة الملاحق (م²)"
                  value={draft.annexTotal}
                  ltr
                  onChange={(v) => editable && onPatch({ annexTotal: v })}
                disabled={!editable} />
                <InsEditField
                  label={INFATH_FIELD_LABELS.buildingsTotal}
                  value={draft.buildingsTotal}
                  ltr
                  disabled
                  onChange={() => {}}
                />
                <InsEditField
                  label="رقم رخصة البناء"
                  value={draft.buildLicenseNumber}
                  ltr
                  onChange={(v) =>
                    editable && onPatch({ buildLicenseNumber: v })
                  }
                disabled={!editable} />
                <InsDualCalendarDateField
                  id="ins-build-license-date"
                  label="تاريخ رخصة البناء"
                  value={draft.buildLicenseDate}
                  disabled={!editable}
                  onChange={(v) =>
                    editable && onPatch({ buildLicenseDate: v })
                  }
                />
              </InsFieldsGrid>
            </InsCard>
          ) : null}

          {!boundariesMarkedUnavailable(property.boundariesAvailability) ? (
            <InsCard
              title="الحدود والأطوال"
              badge={
                <DetailBadge tone="teal">
                  للمطابقة — المصدر: الأخصائي (البورصة)
                </DetailBadge>
              }
            >
              <p className="mb-2.5 text-[11.5px] leading-relaxed text-text-3">
                دور المعاين هنا مطابقة بيانات البورصة واكتشاف الخطأ — يؤكد المطابقة أو
                يعلّق بعدم المطابقة.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-xs">
                  <thead>
                    <tr>
                      {(
                        [
                          "الجهة",
                          "نوع الواجهة",
                          "الحد حسب الصك",
                          "الطول (م)",
                          "مطابق للواقع",
                          "ملاحظة عدم التطابق",
                        ] as const
                      ).map((h) => (
                        <th
                          key={h}
                          className={INS_TH_CLASS}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PROPERTY_BOUNDARY_ROWS.map((row) => {
                      const matchKey = row.descKey.replace(
                        "Boundary",
                        "",
                      ) as InspectorBoundaryKey;
                      const match = draft.boundaryMatches[matchKey];
                      const ok = match?.matches !== false;
                      const facadeKey = `boundaryFacade:${matchKey}`;
                      return (
                        <tr key={row.descKey}>
                          <td className={cn(INS_TD_CLASS, "font-bold text-heading")}>
                            {row.label}
                          </td>
                          <td className={INS_TD_CLASS}>
                            <Select
                              className="text-[11.5px]"
                              disabled={!editable}
                              value={draft.featureValues[facadeKey] ?? ""}
                              onChange={(e) =>
                                editable &&
                                onPatch({
                                  featureValues: {
                                    ...draft.featureValues,
                                    [facadeKey]: e.target.value,
                                  },
                                })
                              }
                            >
                              <option value="">— اختر —</option>
                              {facadeTypeOptions.map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </Select>
                          </td>
                          <td className={INS_TD_CLASS}>
                            {property[row.descKey].trim() || "—"}
                          </td>
                          <td
                            className={cn(INS_TD_CLASS, "text-center tabular-nums")}
                            dir="ltr"
                          >
                            {property[row.lenKey].trim()
                              ? `${property[row.lenKey].trim()} م`
                              : "—"}
                          </td>
                          <td className={cn(INS_TD_CLASS, "text-center")}>
                            <div className="inline-flex gap-1.5">
                              <button
                                type="button"
                                disabled={!editable}
                                className={cn(
                                  "rounded-md border px-2.5 py-1 text-[11px] font-semibold",
                                  !editable && "cursor-default",
                                  ok
                                    ? "border-[color-mix(in_srgb,#1f6f6f_35%,transparent)] bg-[color-mix(in_srgb,#2a8f8f_12%,transparent)] text-[#1f6f6f]"
                                    : "border-border bg-surface-2 text-text-3",
                                )}
                                onClick={() =>
                                  editable &&
                                  onPatch({
                                    boundaryMatches: {
                                      ...draft.boundaryMatches,
                                      [matchKey]: {
                                        ...match,
                                        matches: true,
                                        mismatchNote: "",
                                      },
                                    },
                                  })
                                }
                              >
                                مطابق
                              </button>
                              <button
                                type="button"
                                disabled={!editable}
                                className={cn(
                                  "rounded-md border px-2.5 py-1 text-[11px] font-semibold",
                                  !editable && "cursor-default",
                                  !ok
                                    ? "border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-danger-bg text-danger-text"
                                    : "border-border bg-surface-2 text-text-3",
                                )}
                                onClick={() =>
                                  editable &&
                                  onPatch({
                                    boundaryMatches: {
                                      ...draft.boundaryMatches,
                                      [matchKey]: {
                                        ...match,
                                        matches: false,
                                      },
                                    },
                                  })
                                }
                              >
                                غير مطابق
                              </button>
                            </div>
                          </td>
                          <td className={INS_TD_CLASS}>
                            {!ok ? (
                              editable ? (
                              <input
                                className={cn(EDIT_CONTROL_CLASS, "text-[11.5px]")}
                                placeholder="ملاحظة عدم التطابق…"
                                value={match?.mismatchNote ?? ""}
                                onChange={(e) =>
                                  onPatch({
                                    boundaryMatches: {
                                      ...draft.boundaryMatches,
                                      [matchKey]: {
                                        ...match,
                                        mismatchNote: e.target.value,
                                      },
                                    },
                                  })
                                }
                              />
                              ) : (
                                <span className="text-[11.5px] text-text">
                                  {match?.mismatchNote?.trim() || "—"}
                                </span>
                              )
                            ) : (
                              <span className="text-text-3">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </InsCard>
          ) : null}

          <InsCard
            title="الخدمات والمرافق المحيطة"
            badge={<DetailBadge tone="gray">اختيار متعدد</DetailBadge>}
          >
            <span className={INS_LABEL_CLASS}>
              الخدمات المتوفرة
            </span>
            <ChipRow
              items={[...INSPECTOR_SERVICE_OPTIONS]}
              selected={draft.services}
              onToggle={
                editable
                  ? (item) => {
                      const removing = draft.services.includes(item);
                      const nextServices = removing
                        ? draft.services.filter((s) => s !== item)
                        : [...draft.services, item];
                      const patch: Partial<InspectorWorkspaceDraft> = {
                        services: nextServices,
                      };
                      if (
                        serviceProofFromTransactionPhotos &&
                        removing &&
                        isSpecialistProofService(item)
                      ) {
                        patch.definedPhotos = withoutSpecialistProofSlots(
                          draft,
                          [item],
                        );
                      }
                      onPatch(patch);
                    }
                  : undefined
              }
            />
            {serviceProofFromTransactionPhotos ? (
              <SpecialistServiceProofPhotoFields
                draft={draft}
                transactionPhotos={transactionPhotos}
                disabled={!editable}
                invalid={Boolean(fieldErrors.definedPhotos)}
                onPatch={onPatch}
              />
            ) : null}
            <div className="mt-3">
              <span className={INS_LABEL_CLASS}>
                المرافق المحيطة
              </span>
              <ChipRow
                items={[...DESIGN_AMENITIES]}
                selected={draft.amenities.filter((a) =>
                  (DESIGN_AMENITIES as readonly string[]).includes(a),
                )}
                onToggle={
                  editable
                    ? (item) => {
                        const extras = draft.amenities.filter(
                          (a) =>
                            !(DESIGN_AMENITIES as readonly string[]).includes(a),
                        );
                        const current = draft.amenities.filter((a) =>
                          (DESIGN_AMENITIES as readonly string[]).includes(a),
                        );
                        const next = current.includes(item)
                          ? current.filter((a) => a !== item)
                          : [...current, item];
                        onPatch({ amenities: [...next, ...extras] });
                      }
                    : undefined
                }
              />
            </div>
          </InsCard>

          {editable && !flat ? <StepContinue onContinue={advance} /> : null}
        </>
      ) : null}

      {showStep(3) ? (
        <>
          <div id="ins-defined-photos">
            <InsCard
              title="توثيق الخدمات والمرافق"
              badge={<DetailBadge tone="gray">{photoCoverage}</DetailBadge>}
            >
              <InspectorDefinedPhotosSection
                draft={draft}
                disabled={!editable}
                onPatch={onPatch}
                layout="desktop"
              />
              {fieldErrors.definedPhotos ? (
                <p
                  className="mt-2 mb-0 text-[11px] font-semibold text-danger-text"
                  role="alert"
                >
                  {fieldErrors.definedPhotos}
                </p>
              ) : null}
            </InsCard>
          </div>

          <InsCard title="العقارات المقارنة">
            <FieldComparableCaptureSection
              latitude={draft.mapLatitude}
              longitude={draft.mapLongitude}
              city={property.city}
              district={property.district}
              propertyType={property.propertyType}
              poNumber={inspectionTask.poNumber}
              propertyId={property.id}
              disabled={!editable}
            />
          </InsCard>

          <InsCard
            title="الوصف والملاحظات"
            badge={<DetailBadge tone="gray">نص حر</DetailBadge>}
          >
            <InsEditTextarea
              label="وصف العقار"
              value={draft.propertyDescription}
              
              onChange={(v) => onPatch({ propertyDescription: v })}
            disabled={!editable} />
            <div className="mt-3">
              <InsEditTextarea
                label="الإيجابيات والعيوب الظاهرة على الحي"
                value={draft.districtProsCons}
                
                onChange={(v) => onPatch({ districtProsCons: v })}
              disabled={!editable} />
            </div>
            <div className="mt-3">
              <InsEditTextarea
                label="ملاحظات على الأصل"
                value={draft.assetNotes}
                
                onChange={(v) => onPatch({ assetNotes: v })}
              disabled={!editable} />
            </div>
          </InsCard>

          <InsCard
            title="الملاحظات الميدانية"
            badge={
              <DetailBadge tone="gray">شرح + صورة لكل ملاحظة</DetailBadge>
            }
          >
            {draft.observations.length === 0 ? (
              <p className="m-0 mt-2 text-[11.5px] text-text-3">
                لا توجد ملاحظات ميدانية مسجّلة.
              </p>
            ) : null}
            <div className="mt-2 flex flex-col gap-2">
              {draft.observations.map((obs, index) => (
                <div
                  key={obs.id}
                  className="grid grid-cols-[150px_minmax(0,1fr)_auto_auto] items-center gap-2 rounded-lg border border-border bg-surface-2 p-2.5"
                >
                  <Select
                    
                    value={obs.category}
                    onChange={(e) => {
                      const next = [...draft.observations];
                      next[index] = { ...obs, category: e.target.value };
                      onPatch({ observations: next });
                    }}
                  >
                    {INSPECTOR_OBSERVATION_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                  <input
                    className={EDIT_CONTROL_CLASS}
                    
                    placeholder="اشرح الملاحظة…"
                    value={obs.text}
                    onChange={(e) => {
                      const next = [...draft.observations];
                      next[index] = { ...obs, text: e.target.value };
                      onPatch({ observations: next });
                    }}
                  />
                  <span className="text-[11px] text-text-3">
                    {obs.photo?.fileName ? "صورة مرفقة" : "بدون صورة"}
                  </span>
                  {editable ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      onClick={() =>
                        onPatch({
                          observations: draft.observations.filter(
                            (o) => o.id !== obs.id,
                          ),
                        })
                      }
                    >
                      حذف
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
            {editable ? (
              <Button
                type="button"
                size="sm"
                variant="default"
                className="mt-2.5"
                onClick={() =>
                  onPatch({
                    observations: [
                      ...draft.observations,
                      {
                        id: newObservationId(),
                        category: INSPECTOR_OBSERVATION_CATEGORIES[0],
                        text: "",
                        photo: null,
                      },
                    ],
                  })
                }
              >
                إضافة ملاحظة موثّقة
              </Button>
            ) : null}
          </InsCard>

          {caseStudyDef ? (
            <InsCard title="أسئلة دراسة الحالة — المعاين">
              <InspectorCaseStudyChips
                def={caseStudyDef}
                childTask={inspectionTask}
                forceReadOnly={!editable}
              />
            </InsCard>
          ) : null}

          {editable ? (
            <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border bg-surface px-4 py-3">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-text-2">
                <input
                  type="checkbox"
                  className="size-[15px] accent-ink"
                  checked={draft.inspectionConfirmed}
                  onChange={(e) =>
                    onPatch({ inspectionConfirmed: e.target.checked })
                  }
                />
                أقر بأن بيانات المعاينة صحيحة ومطابقة للواقع الميداني
              </label>
              <span className="flex-1" />
              <Button
                type="button"
                size="sm"
                variant="primary"
                loading={saving}
                disabled={saving || !draft.inspectionConfirmed}
                onClick={onSubmit}
              >
                حفظ وإرسال
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={onCancel}
              >
                رجوع
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function StepContinue({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2.5 rounded-xl border border-border bg-surface px-4 py-3">
      <span className="text-[11.5px] text-text-3">
        كل بطاقة تُحفظ تلقائياً عند الإدخال — «حفظ ومتابعة» يعتمد المرحلة وينتقل
        للتالية.
      </span>
      <span className="flex-1" />
      <Button type="button" variant="primary" size="sm" onClick={onContinue}>
        حفظ ومتابعة
      </Button>
    </div>
  );
}
