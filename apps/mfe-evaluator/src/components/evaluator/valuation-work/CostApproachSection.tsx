"use client";

import { memo } from "react";
import type { ValuationCostApproachDto } from "@platform/api-client";

import { GhostBtn, PrimaryBtn } from "./atoms";
import { CostApproachLinesTable } from "./CostApproachLinesTable";
import {
  CostAgeCard,
  CostAlertsCard,
  CostAnalysisCard,
  CostIndirectCard,
  CostLandValueCard,
  CostResultsCard,
} from "./CostApproachParts";
import { useCostApproachWorkflow } from "./useCostApproachWorkflow";

export { CostBasisUnitCard } from "./CostApproachParts";

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
  cost,
  hydrateKey,
  buildingOnly,
  isApartmentProperty,
  costBasisKey,
  saving,
  onSavingChange,
  onCostSaved,
}: {
  valuationRequestId: string | null;
  poNumber?: string;
  propertyId: string;
  cost: ValuationCostApproachDto | null;
  hydrateKey: number;
  buildingOnly: boolean;
  isApartmentProperty: boolean;
  costBasisKey: string;
  saving: boolean;
  onSavingChange: (saving: boolean) => void;
  onCostSaved: (dto: ValuationCostApproachDto) => void;
}) {
  const workflow = useCostApproachWorkflow({
    valuationRequestId,
    poNumber,
    propertyId,
    cost,
    hydrateKey,
    buildingOnly,
    costBasisKey,
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
    costNarrativeDirty,
    costNarrativeAuto,
    seedCostFromInventory,
    saveCost,
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

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-baseline gap-2.5">
          <h2 className="m-0 text-[17px] font-extrabold text-heading">
            بنود التكلفة المباشرة
          </h2>
          <span className="text-[11.5px] text-text-3">
            البنود موجبة فقط — النقص عن السائد يُعالَج تقادماً وظيفياً · أضف البند
            من صف «اختر البند» في نهاية كل مجموعة
          </span>
        </div>
        <GhostBtn disabled={saving} onClick={() => void seedCostFromInventory()}>
          سحب من حصر المباني
        </GhostBtn>
      </div>

      <CostApproachLinesTable workflow={workflow} saving={saving} />

      <div className="mb-6 grid grid-cols-[1.2fr_1fr] gap-[18px]">
        <CostIndirectCard
          fields={fields}
          setField={setField}
          setIndirect={setIndirect}
          directTotal={totals.directTotal}
          derived={derived}
        />
        <CostAgeCard cost={cost} fields={fields} setField={setField} />
      </div>

      {/* Results and recommendations — interactive-form spec */}
      <h2 className="mb-3 mt-0 text-[17px] font-extrabold text-heading">
        النتائج والتوصيات
      </h2>
      <CostResultsCard
        derived={derived}
        buildAreaLocal={totals.buildAreaLocal}
        buildingOnly={buildingOnly}
      />

      <CostAnalysisCard
        notes={fields.costAnalysisNotes}
        autoNarrative={costNarrativeAuto}
        dirty={costNarrativeDirty}
        saving={saving}
        onChange={(value) => setField("costAnalysisNotes", value)}
      />

      <CostAlertsCard alerts={costAlerts} />

      <PrimaryBtn disabled={saving} onClick={() => void saveCost()}>
        حفظ أسلوب التكلفة
      </PrimaryBtn>
    </>
  );
});
