// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Autosave  A status line next to «حفظ أسلوب التكلفة» says where the automatic save stands
//              (costSaveStatusText: pending / saving / saved / refused with the reason).
// Round 2 (1b19bedc)
//  • A    Takes deedArea and passes isApartment and the plot-area seed (buildingPlotAreaSeed) to the
//         workflow — the deed area seeds «مساحة أرض العمارة» unless the property is an apartment.
// ──────────────────────────────────────────────────────────────────────────────────────────────

"use client";

import { memo, type ReactNode } from "react";
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
import { costSaveStatusText } from "./lib/cost-autosave";
import { buildingPlotAreaSeed, COST_INVENTORY_AWAITS_STUDY } from "./lib/cost-approach-state";

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
  deedArea,
  costBasisKey,
  ownershipInterestKey = null,
  saving,
  locked = false,
  inventoryApproved = true,
  onSavingChange,
  onCostSaved,
  alerts = null,
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
  /** The deed area — seeds the plot box when the deed is the land itself. */
  deedArea?: string | null;
  costBasisKey: string;
  /** The interest valued (freehold / usufruct / leased_land) — words the age card's lease-cap note. */
  ownershipInterestKey?: string | null;
  saving: boolean;
  locked?: boolean;
  /** The study is issued — the inventory is the approved one and may be pulled. */
  inventoryApproved?: boolean;
  onSavingChange: (saving: boolean) => void;
  onCostSaved: (dto: ValuationCostApproachDto) => void;
  /**
   * The methodology alerts of the cost approach, shown at the end — and, like the tables after the
   * direct costs, only once those are reviewed and saved: until then the alerts speak about tables
   * the appraiser has not reached, and the review box says what is asked of him.
   */
  alerts?: ReactNode;
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
    isApartment: isApartmentProperty,
    plotAreaSeed: buildingPlotAreaSeed(deedArea, isApartmentProperty),
    costBasisKey,
    locked,
    inventoryApproved,
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
    saveCostLines,
    linesReviewed,
    saveState,
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
          <GhostBtn
            disabled={saving || locked || !workflow.inventoryApproved}
            onClick={() => void seedCostFromInventory()}
          >
            سحب من حصر المباني
          </GhostBtn>
        </div>
      </div>
      {workflow.inventoryApproved ? null : (
        <p className="mb-3 mt-0 text-[11.5px] font-semibold text-gold-d" data-testid="cost-inventory-awaits-study">
          {COST_INVENTORY_AWAITS_STUDY}
        </p>
      )}

      <CostInventoryDriftBanner
        drift={drift}
        disabled={saving || locked}
        onAddNew={addNewInventoryLines}
        onUpdateAreas={updateInventoryAreas}
      />

      <CostApproachLinesTable workflow={workflow} saving={saving} />

      {/* The tables after the direct costs open once the appraiser reviewed, priced and saved them
          (ruling 2026-11-11); they stay open afterwards. */}
      {linesReviewed ? null : (
        <div
          data-testid="cost-lines-review"
          className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-[10px] border border-border-md bg-gold-soft px-4 py-3"
        >
          <PrimaryBtn disabled={saving || locked} onClick={() => void saveCostLines()}>
            حفظ بنود التكلفة
          </PrimaryBtn>
          <p className="m-0 min-w-[14rem] flex-1 text-[11.5px] leading-relaxed text-text-2">
            راجع بنود التكلفة المباشرة وعدّلها بما تراه، وسعّر كل بند مشمول، ثم احفظها — بعدها تُفتح
            التكاليف غير المباشرة والعمر والإهلاك.
          </p>
          {!locked && costSaveStatusText(saveState) ? (
            <p className="m-0 basis-full text-[11.5px] text-text-3" role="status">
              {costSaveStatusText(saveState)}
            </p>
          ) : null}
        </div>
      )}

      {linesReviewed ? (
        <>
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

      {/* Phones stack the indirect-costs and age cards instead of two ~150px columns. */}
      <div className="mb-6 grid grid-cols-[1.2fr_1fr] gap-[18px] max-lg:grid-cols-1">
        <CostIndirectCard
          fields={fields}
          setField={setField}
          setIndirect={setIndirect}
          directTotal={totals.directTotal}
          derived={derived}
        />
        <CostAgeCard
          derived={derived}
          fields={fields}
          setField={setField}
          ownershipInterestKey={ownershipInterestKey}
        />
      </div>

      <CostResultsCard
        derived={derived}
        buildAreaLocal={totals.buildAreaLocal}
        buildingOnly={buildingOnly}
      />

      <CostAlertsCard alerts={costAlerts} />

      {alerts}

      <div className="flex flex-wrap items-center gap-3">
        <PrimaryBtn disabled={saving || locked} onClick={() => void saveCost()}>
          حفظ أسلوب التكلفة
        </PrimaryBtn>
        {!locked && costSaveStatusText(saveState) ? (
          <p
            className={
              saveState.status === "error"
                ? "m-0 text-[11.5px] font-semibold text-amber-text"
                : "m-0 text-[11.5px] text-text-3"
            }
            role="status"
            data-testid="cost-save-status"
          >
            {costSaveStatusText(saveState)}
          </p>
        ) : null}
      </div>
        </>
      ) : null}
    </>
  );
});
