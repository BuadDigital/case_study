"use client";

/**
 * Wizard step 1 of `InspectorWorkspaceWizard` - map pin, site access data, and
 * property photos. Owns the map/coords derivations that only this step needs.
 */

import { useMemo } from "react";
import { Button, cn, GoogleMapPin, useToast } from "@platform/ui-kit";
import type { PoPropertyIntake } from "../../lib/app-data/po-intake-data";
import {
  SITE_LOCATION_ACK_PENDING_MESSAGE,
  mapPinPatchForActor,
  type InspectorMapActor,
  type InspectorWorkspaceDraft,
} from "../../lib/app-data/inspector-workspace-data";
import {
  inspectorReferenceMapPins,
  inspectorWizardCoordsValue,
  inspectorWizardMapGeo,
} from "./inspector-wizard-state";
import { InspectorPropertyPhotosSection } from "./InspectorPropertyPhotosSection";
import { InspectorAccessContactFields } from "./InspectorAccessContactFields";
import {
  InsCard,
  InsEditField,
  InsFieldsGrid,
  EDIT_CONTROL_CLASS,
} from "../po-intake/PropertyDetailInspectionParts";
import {
  INS_LABEL_CLASS,
  INS_WIZARD_PIN_BUTTON_CLASS,
} from "./FieldInspectionWorkParts";
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
  mapPinEpoch,
  mapActor,
  canRestoreInspectorMap,
  onRestoreInspectorMap,
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
  mapPinEpoch: number;
  mapActor: InspectorMapActor;
  canRestoreInspectorMap: boolean;
  onRestoreInspectorMap?: () => void;
}) {
  const { showToast } = useToast();
  const mapGeo = useMemo(
    () => inspectorWizardMapGeo(draft, property),
    [draft, property],
  );
  const inspectorReferencePins = useMemo(
    () => inspectorReferenceMapPins(draft, mapActor, mapPinned),
    [draft, mapActor, mapPinned],
  );
  const coordsValue = inspectorWizardCoordsValue(draft);

  return (
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
              pinLabel={
                mapPinned && mapActor === "specialist"
                  ? "الموقع المعتمد"
                  : undefined
              }
              contextPins={inspectorReferencePins}
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
          {editable && canRestoreInspectorMap && onRestoreInspectorMap ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onRestoreInspectorMap}
            >
              استعادة موقع المعاين
            </Button>
          ) : null}
        </div>
        {inspectorReferencePins.length > 0 ? (
          <p className="mt-2 mb-0 text-[10.5px] leading-relaxed text-text-3">
            الدبوس الذهبي يعرض موقع المعاين الأصلي للمقارنة فقط — لا يُرفع مع
            التقرير.
          </p>
        ) : null}
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
        <div id="ins-property-photos">
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
