"use client";

import { memo } from "react";
import type { ValuationCostApproachDto } from "@platform/api-client";

import { GhostBtn, PrimaryBtn } from "./atoms";
import { EvaluatorActionNotice } from "../EvaluatorActionNotice";
import { CostInventoryDriftBanner } from "./CostInventoryDriftBanner";
import { CostApproachLinesTable } from "./CostApproachLinesTable";
import {
  CostAgeCard,
  CostAlertsCard,
  CostIndirectCard,
  CostLandValueCard,
  CostResultsCard,
} from "./CostApproachParts";
import { useCostApproachWorkflow } from "./useCostApproachWorkflow";

/**
 * Cost-approach section — composes the land, lines, indirect, age, results,
 * analysis and alert cards over `useCostApproachWorkflow`, which owns the
 * drafts locally so typing here does not re-render the valuation shell. Stays
 * mounted (hidden) after first visit so unsaved drafts survive screen switches.
 * Hydrates from the server batch via hydrateKey — bumps on full load only.
 */
export const CostApproachSection = memo(function CostApproachSection({
  valuationRequestId,
  poNumber,
  propertyId,
  inspectionTaskId = null,
  inspectorChangedGroups = null,
  cost,
  hydrateKey,
  buildingOnly,
  isApartmentProperty,
  costBasisKey,
  saving,
  locked = false,
  onSavingChange,
  onCostSaved,
}: {
  valuationRequestId: string | null;
  poNumber?: string;
  propertyId: string;
  inspectionTaskId?: string | null;
  inspectorChangedGroups?: readonly string[] | null;
  cost: ValuationCostApproachDto | null;
  hydrateKey: number;
  buildingOnly: boolean;
  isApartmentProperty: boolean;
  costBasisKey: string;
  saving: boolean;
  locked?: boolean;
  onSavingChange: (saving: boolean) => void;
  onCostSaved: (dto: ValuationCostApproachDto) => void;
}) {
  const workflow = useCostApproachWorkflow({
    valuationRequestId,
    poNumber,
    propertyId,
    inspectionTaskId,
    inspectorChangedGroups,
    cost,
    hydrateKey,
    buildingOnly,
    costBasisKey,
    locked,
    onSavingChange,
    onCostSaved,
  });
  const {
    fields,
    setField,
    setIndirect,
    totals,
    derived,
    costAlerts,
    seedCostFromInventory,
    saveCost,
    drift,
    addNewInventoryLines,
    updateInventoryAreas,
    ageNotice,
    applyInspectorAge,
  } = workflow;

  return (
    <>
      {!buildingOnly ? (
        <CostLandValueCard
          cost={cost}
          fields={fields}
          setField={setField}
          landComplete={derived.landComplete}
          isApartmentProperty={isApartmentProperty}
        />
      ) : null}

      <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="m-0 text-[17px] font-extrabold text-heading">
            بنود التكلفة المباشرة
          </h2>
          <span className="text-xs text-text-3">
            البنود موجبة فقط — النقص عن السائد يُعالَج تقادماً وظيفياً
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs text-text-3">
            أضف البند من صف «اختر البند» في نهاية كل مجموعة
          </span>
          <GhostBtn disabled={saving || locked} onClick={() => void seedCostFromInventory()}>
            سحب من حصر المباني
          </GhostBtn>
        </div>
      </div>

      <CostInventoryDriftBanner
        drift={drift}
        disabled={saving || locked}
        onAddNew={addNewInventoryLines}
        onUpdateAreas={updateInventoryAreas}
      />

      <CostApproachLinesTable workflow={workflow} saving={saving} />

      {ageNotice ? (
        <EvaluatorActionNotice
          testId="cost-inspector-age-notice"
          message={`عمر العقار عند المعاين ${ageNotice.inspectorAge} سنة، والمُدخل ${ageNotice.enteredAge || "—"}`}
          actions={[
            {
              label: "طبّق عمر المعاين",
              onClick: applyInspectorAge,
              disabled: saving || locked,
              primary: true,
            },
          ]}
        />
      ) : null}

      <div className="mb-6 grid grid-cols-[1.2fr_1fr] gap-[18px]">
        <CostIndirectCard
          fields={fields}
          setField={setField}
          setIndirect={setIndirect}
          directTotal={totals.directTotal}
          derived={derived}
        />
        <CostAgeCard derived={derived} fields={fields} setField={setField} />
      </div>

      <CostResultsCard
        derived={derived}
        buildAreaLocal={totals.buildAreaLocal}
        buildingOnly={buildingOnly}
      />

      <CostAlertsCard alerts={costAlerts} />

      <PrimaryBtn disabled={saving || locked} onClick={() => void saveCost()}>
        حفظ أسلوب التكلفة
      </PrimaryBtn>
    </>
  );
});
