"use client";

/**
 * Step-1 cards «الموقع والوصول» (street, access contact) and «تصوير العقار»
 * (free property photos). Lifted out of `FieldInspectionWorkBody` — same
 * markup, state stays with the workflow hook.
 */
import { FormRow, Input } from "@platform/ui-kit";
import { RegField } from "@platform/app-shared/registration/FormFields";
import {
  SITE_LOCATION_ACK_PENDING_MESSAGE,
  type InspectorWorkspaceDraft,
} from "../../lib/app-data/inspector-workspace-data";
import { InsBadge, InspectorCard } from "./FieldInspectionWorkParts";
import { MobileFieldLabel, mobileControlClassName } from "./InspectMobileControls";
import { InspectorAccessContactFields } from "./InspectorAccessContactFields";
import {
  InspectorPropertyPhotosSection,
  inspectorPhotosLabel,
} from "./InspectorPropertyPhotosSection";
import { InspectorSaveChip } from "./InspectorSaveChip";
import type { FieldInspectionWorkflow } from "./useFieldInspectionWorkflow";

export function InspectorAccessPhotosCards({
  activeStep,
  draft,
  fieldErrors,
  layout,
  locked,
  markDirty,
  mobile,
  persist,
  property,
  saveState,
  showToast,
}: Pick<
  FieldInspectionWorkflow,
  | "activeStep"
  | "fieldErrors"
  | "locked"
  | "markDirty"
  | "persist"
  | "property"
  | "saveState"
  | "showToast"
> & {
  draft: InspectorWorkspaceDraft;
  layout: "desktop" | "mobile";
  mobile: boolean;
}) {
  return (
    <>
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
        layout={layout}
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
        layout={layout}
        step={3}
        subtitle={mobile ? inspectorPhotosLabel(draft.freePhotos.length) : undefined}
      >
        <div id="ins-property-photos">
          <InspectorPropertyPhotosSection
            draft={draft}
            disabled={locked}
            actor="inspector"
            mobile={mobile}
            onPatch={(patch) => persist(patch)}
            onDirty={() => markDirty("photos")}
          />
        </div>
      </InspectorCard>
    </>
  );
}
