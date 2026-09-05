"use client";

/**
 * Step-3 cards that are not the photographed observations: «الوصف
 * والملاحظات» (description, violations), «توثيق الخدمات والمرافق» (defined
 * photos), «العقارات المقارنة» and the party case-study questions. Lifted
 * out of `FieldInspectionWorkBody` — same markup, state stays with the
 * workflow hook.
 */
import { cn, formControlClassName, Select, Textarea } from "@platform/ui-kit";
import { RegField, RegTextarea } from "@platform/app-shared/registration/FormFields";
import type { PartyTaskPageDef } from "@platform/app-shared/app-data/party-task-pages";
import type { InspectorWorkspaceDraft } from "../../lib/app-data/inspector-workspace-data";
import type { WorkflowTask } from "../../lib/app-data/tasks-storage";
import { PartyCaseStudyFormTab } from "../case-study/PartyCaseStudyFormTab";
import { FieldComparableCaptureSection } from "./FieldComparableCaptureSection";
import { InsBadge, InspectorCard } from "./FieldInspectionWorkParts";
import { MobileFieldLabel, mobileControlClassName } from "./InspectMobileControls";
import { InspectorDefinedPhotosSection } from "./InspectorDefinedPhotosSection";
import type { FieldInspectionWorkflow } from "./useFieldInspectionWorkflow";

export function InspectorDescriptionCard({
  activeStep,
  draft,
  layout,
  locked,
  mobile,
  persist,
}: Pick<FieldInspectionWorkflow, "activeStep" | "locked" | "persist"> & {
  draft: InspectorWorkspaceDraft;
  layout: "desktop" | "mobile";
  mobile: boolean;
}) {
  return (
    <InspectorCard
      title="الوصف والملاحظات"
      hidden={activeStep !== 3}
      icon="ti-notes"
      badge={mobile ? undefined : <InsBadge label="نص حر" />}
      layout={layout}
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
  );
}

export function InspectorDefinedPhotosCard({
  activeStep,
  draft,
  fieldErrors,
  layout,
  locked,
  mobile,
  persist,
  photoCoverage,
}: Pick<FieldInspectionWorkflow, "activeStep" | "fieldErrors" | "locked" | "persist"> & {
  draft: InspectorWorkspaceDraft;
  layout: "desktop" | "mobile";
  mobile: boolean;
  photoCoverage: string;
}) {
  return (
    <div id="ins-defined-photos">
      <InspectorCard
        title={mobile ? "توثيق الخدمات" : "توثيق الخدمات والمرافق"}
        hidden={activeStep !== 3}
        icon="ti-photo"
        layout={layout}
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
  );
}

export function InspectorComparablesAndQuestionsCards({
  activeStep,
  def,
  draft,
  layout,
  locked,
  mobile,
  property,
  propertyId,
  task,
  workLocked,
}: Pick<FieldInspectionWorkflow, "activeStep" | "locked" | "property" | "propertyId" | "workLocked"> & {
  def: PartyTaskPageDef;
  draft: InspectorWorkspaceDraft;
  layout: "desktop" | "mobile";
  mobile: boolean;
  task: WorkflowTask;
}) {
  return (
    <>
      <InspectorCard
        title="العقارات المقارنة"
        hidden={activeStep !== 3}
        icon="ti-building-estate"
        layout={layout}
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
        layout={layout}
        step={5}
        subtitle={mobile ? "أسئلة الطرف" : undefined}
      >
        <PartyCaseStudyFormTab def={def} childTask={task} forceReadOnly={locked} />
      </InspectorCard>
    </>
  );
}
