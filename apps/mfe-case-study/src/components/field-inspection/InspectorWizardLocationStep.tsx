"use client";

/**
 * Wizard step 1 of `InspectorWorkspaceWizard` - map pin, site access data, and
 * property photos. Owns the map/coords derivations that only this step needs.
 */

import { useMemo } from "react";
import { Button, cn, GoogleMapPin, useToast } from "@platform/ui-kit";
import type { PoPropertyIntake } from "../../lib/app-data/po-intake-data";
import {
  mapPinPatchForActor,
  type InspectorMapActor,
  type InspectorWorkspaceDraft,
} from "../../lib/app-data/inspector-workspace-data";
import {
  SITE_LOCATION_ACK_REQUIRES_PIN_MESSAGE,
  canPrintSiteLocationAck,
} from "../../lib/app-data/site-location-ack-letter";
import {
  engineeringOfficeContextPins,
  inspectorReferenceMapPins,
  inspectorWizardCoordsValue,
  inspectorWizardMapGeo,
} from "./inspector-wizard-state";
import { InspectorPropertyPhotosSection } from "./InspectorPropertyPhotosSection";
import { InspectorAccessContactFields } from "./InspectorAccessContactFields";
import { handleSiteLocationAckClick } from "./site-location-ack-action";
import {
  InsCard,
  InsEditField,
  InsFieldsGrid,
} from "../po-intake/PropertyDetailInspectionParts";
import {
  EDIT_CONTROL_CLASS,
  INS_LABEL_CLASS,
  INS_WIZARD_PIN_BUTTON_CLASS,
  INSPECTOR_LOCKED_CONTROL_CLASS,
} from "./FieldInspectionWorkParts";
import { invalidControlClass } from "@platform/app-shared/form-ux";
import type { InspectorWorkspaceFieldErrors } from "../../lib/app-data/inspector-workspace-validation";

export function InspectorWizardLocationStep({
  property,
  draft,
  editable,
  fieldErrors,
  serviceProofFromTransactionPhotos,
  onPatch,
  onMapMove,
  mapPinned,
  onPin,
  onUnpin,
  mapPinEpoch,
  mapActor,
  canRestoreInspectorMap,
  onRestoreInspectorMap,
  canAdoptEngineeringMap = false,
  onAdoptEngineeringMap,
  engineeringMapPin = null,
}: {
  property: PoPropertyIntake;
  draft: InspectorWorkspaceDraft;
  editable: boolean;
  fieldErrors: InspectorWorkspaceFieldErrors;
  serviceProofFromTransactionPhotos: boolean;
  onPatch: (patch: Partial<InspectorWorkspaceDraft>) => void;
  onMapMove: (lat: number, lng: number) => void;
  mapPinned: boolean;
  onPin: () => void;
  onUnpin: () => void;
  mapPinEpoch: number;
  mapActor: InspectorMapActor;
  canRestoreInspectorMap: boolean;
  onRestoreInspectorMap?: () => void;
  canAdoptEngineeringMap?: boolean;
  onAdoptEngineeringMap?: () => void;
  engineeringMapPin?: { lat: number; lng: number } | null;
}) {
  const { showToast } = useToast();
  const ackReady = canPrintSiteLocationAck(mapPinned);
  const mapGeo = useMemo(
    () => inspectorWizardMapGeo(draft, property),
    [draft, property],
  );
  const contextPins = useMemo(
    () => [
      ...inspectorReferenceMapPins(draft, mapActor, mapPinned),
      ...engineeringOfficeContextPins(draft, mapActor, engineeringMapPin),
    ],
    [draft, mapActor, mapPinned, engineeringMapPin],
  );
  const coordsValue = inspectorWizardCoordsValue(draft);

  return (
    <>
      <InsCard title="تحديد موقع العقار" step={1}>
        <div id="ins-map-section">
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
              pinLabel={
                mapPinned && mapActor === "specialist"
                  ? "الموقع المعتمد"
                  : undefined
              }
              contextPins={contextPins}
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
            {editable && !mapPinned ? (
              <input
                id="ins-map-coords"
                className={cn(
                  EDIT_CONTROL_CLASS,
                  "tabular-nums",
                  fieldErrors.mapLatitude && invalidControlClass,
                )}
                dir="ltr"
                placeholder="21.523339, 39.187743"
                value={coordsValue}
                onChange={(e) => {
                  const parts = e.target.value.split(/[,،]/);
                  onPatch(
                    mapPinPatchForActor(
                      draft,
                      (parts[0] || "").trim(),
                      (parts[1] || "").trim(),
                      mapActor,
                    ),
                  );
                }}
              />
            ) : (
              <input
                id="ins-map-coords"
                readOnly
                tabIndex={-1}
                aria-readonly="true"
                className={cn(INSPECTOR_LOCKED_CONTROL_CLASS, "tabular-nums")}
                dir="ltr"
                value={coordsValue || "—"}
              />
            )}
          </div>
          {editable && !mapPinned ? (
            <button
              type="button"
              className={INS_WIZARD_PIN_BUTTON_CLASS}
              onClick={onPin}
            >
              تثبيت الموقع
            </button>
          ) : null}
          {editable && mapPinned ? (
            <div
              className="inline-flex h-[38px] items-center gap-1.5 rounded-lg border border-[#B7E4C7] bg-[#F0FFF4] pe-1.5 ps-3.5 text-[12.5px] font-bold text-[#1B7A4A]"
              role="status"
            >
              <i className="ti ti-pin-filled text-sm" aria-hidden />
              تم تثبيت الموقع
              <button
                type="button"
                className="grid size-7 place-items-center rounded-md border-0 bg-transparent font-inherit text-[15px] text-[#1B7A4A] transition-colors hover:bg-[color-mix(in_srgb,#1B7A4A_12%,transparent)]"
                aria-label="إلغاء تثبيت الموقع"
                title="إلغاء التثبيت وإعادة التعيين"
                onClick={onUnpin}
              >
                <i className="ti ti-x" aria-hidden />
              </button>
            </div>
          ) : null}
          {editable && canRestoreInspectorMap && onRestoreInspectorMap ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onRestoreInspectorMap}
            >
              اعتماد موقع المعاين
            </Button>
          ) : null}
          {editable && canAdoptEngineeringMap && onAdoptEngineeringMap ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onAdoptEngineeringMap}
            >
              اعتماد موقع المكتب الهندسي
            </Button>
          ) : null}
        </div>
        {contextPins.length > 0 ? (
          <p className="mt-2 mb-0 text-[10.5px] leading-relaxed text-text-3">
            الدبابيس الإضافية للمقارنة فقط (معاين / مكتب هندسي) — الموقع
            المعتمد هو الدبوس الرئيسي بعد الاختيار.
          </p>
        ) : null}
        {fieldErrors.mapLatitude ? (
          <p className="mt-2 mb-0 text-[11px] text-danger-text" role="alert">
            {fieldErrors.mapLatitude}
          </p>
        ) : null}
        <div className="mt-3">
          <InsFieldsGrid min={150}>
            <InsEditField
              id="ins-date"
              label="تاريخ المعاينة"
              type="date"
              ltr
              value={draft.inspectionDate}
              onChange={(v) => onPatch({ inspectionDate: v })}
              disabled={!editable}
              invalid={Boolean(fieldErrors.inspectionDate)}
              errorMessage={fieldErrors.inspectionDate}
            />
            <InsEditField
              id="ins-time"
              label="وقت المعاينة"
              type="time"
              ltr
              value={draft.inspectionTime}
              onChange={(v) => onPatch({ inspectionTime: v })}
              disabled={!editable}
              invalid={Boolean(fieldErrors.inspectionTime)}
              errorMessage={fieldErrors.inspectionTime}
            />
          </InsFieldsGrid>
        </div>
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
            handleSiteLocationAckClick({
              mapPinned,
              draft,
              property,
              showToast,
            })
          }
          ackTitle={
            ackReady ? undefined : SITE_LOCATION_ACK_REQUIRES_PIN_MESSAGE
          }
        />
      </InsCard>

      <InsCard title="تصوير العقار" step={3}>
        <div
          id="ins-property-photos"
          className={cn(
            fieldErrors.freePhotos && invalidControlClass,
            fieldErrors.freePhotos && "rounded-md p-0.5",
          )}
        >
          <InspectorPropertyPhotosSection
            draft={draft}
            disabled={!editable}
            actor={serviceProofFromTransactionPhotos ? "specialist" : "inspector"}
            onPatch={onPatch}
          />
        </div>
      </InsCard>
    </>
  );
}
