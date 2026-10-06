"use client";

/**
 * Step-2 card «جدول الحصر»: the inspector lists the property's buildings, annexes, fence…
 * with their areas (the specialist's «مكونات العقار» text is not here — it is the
 * specialist's own). Mandatory for anything with buildings or annexes worth valuing: shown for
 * every non-land asset, and for an asset typed «أرض» only when the inspector answered «نعم» to
 * the yes/no question above it (hidden for «لا» / not answered). Saved automatically a pause
 * after typing, and queued on the device when there is no connection (replayed before the
 * inspection's submit). The hard gate is the specialist's acceptance; here an empty table
 * only gets a soft, non-blocking warning.
 */
import type { InspectorWorkspaceDraft } from "../../lib/app-data/inspector-workspace-data";
import { inspectorInventoryVisible } from "../../lib/app-data/building-inventory-editor-state";
import type { InspectorWorkspaceFieldErrors } from "../../lib/app-data/inspector-workspace-validation";
import { inspectedAssetIsLand } from "../../lib/app-data/specialist-components";
import { InsBadge, InspectorCard } from "./FieldInspectionWorkParts";
import { InspectorInventoryEditor } from "./InspectorInventoryEditor";
import { InspectorLandStructuresQuestion } from "./InspectorLandStructuresQuestion";
import type { FieldInspectionWorkflow } from "./useFieldInspectionWorkflow";

type CardProps = Pick<FieldInspectionWorkflow, "activeStep" | "workLocked" | "persist"> & {
  draft: Pick<InspectorWorkspaceDraft, "featureValues" | "landHasValuableStructures">;
  fieldErrors?: InspectorWorkspaceFieldErrors;
  layout: "desktop" | "mobile";
  mobile: boolean;
  poNumber: string;
  propertyId: string;
  /** The inspection task: a queued save is replayed before its submit. */
  taskId: string;
};

function InspectorInventoryCardBody({
  activeStep,
  draft,
  layout,
  mobile,
  poNumber,
  propertyId,
  taskId,
  workLocked,
}: CardProps) {
  return (
    <InspectorCard
      title="جدول الحصر"
      hidden={activeStep !== 2}
      icon="ti-table"
      badge={mobile ? undefined : <InsBadge label="إدخال ميداني" tone="danger" />}
      layout={layout}
      subtitle={mobile ? "المباني والملاحق ومساحاتها" : undefined}
    >
      <InspectorInventoryEditor
        draft={draft}
        mobile={mobile}
        poNumber={poNumber}
        propertyId={propertyId}
        taskId={taskId}
        workLocked={workLocked}
      />
    </InspectorCard>
  );
}

/**
 * Step 2, before the table: for an asset typed «أرض» the inspector's explicit yes/no «هل في
 * الأرض مبانٍ أو ملاحق تستحق التقييم؟». Until it is «نعم» the table card stays hidden.
 */
function InspectorLandStructuresCard({
  activeStep,
  draft,
  errorMessage,
  layout,
  locked,
  mobile,
  persist,
}: Pick<CardProps, "activeStep" | "draft" | "layout" | "mobile"> &
  Pick<FieldInspectionWorkflow, "locked" | "persist"> & { errorMessage?: string }) {
  return (
    <InspectorCard
      title="مبانٍ أو ملاحق على الأرض"
      hidden={activeStep !== 2}
      icon="ti-building"
      badge={mobile ? undefined : <InsBadge label="إدخال ميداني" tone="danger" />}
      layout={layout}
      defaultOpen
    >
      <InspectorLandStructuresQuestion
        value={draft.landHasValuableStructures}
        mobile={mobile}
        disabled={locked}
        errorMessage={errorMessage}
        onChange={(next) => persist({ landHasValuableStructures: next })}
      />
    </InspectorCard>
  );
}

export function InspectorInventoryCard(props: CardProps) {
  const { draft } = props;
  return (
    <>
      {inspectedAssetIsLand(draft.featureValues.assetSubject) ? (
        <InspectorLandStructuresCard
          activeStep={props.activeStep}
          draft={draft}
          errorMessage={props.fieldErrors?.landHasValuableStructures}
          layout={props.layout}
          locked={props.workLocked}
          mobile={props.mobile}
          persist={props.persist}
        />
      ) : null}
      {props.propertyId &&
      inspectorInventoryVisible({
        assetSubject: draft.featureValues.assetSubject,
        landHasValuableStructures: draft.landHasValuableStructures,
      }) ? (
        <InspectorInventoryCardBody {...props} />
      ) : null}
    </>
  );
}
