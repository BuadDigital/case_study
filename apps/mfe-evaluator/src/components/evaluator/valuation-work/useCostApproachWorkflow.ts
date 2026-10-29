// ── Valuation fixes · 2026-10-25/26 ──────────────────────────────────────────────────────────
// Round 1 (5b554f4e)
//  • Autosave  The save moved to useCostAutosave: every appraiser edit bumps editVersion (markEdited) and is
//              saved after a pause; hydration and silent seeds never bump it. The toast shows only on
//              the explicit save; lines typed while a save is in flight are kept.
//  • Autosave  The inventory-drift buttons count as edits, so the autosave sends them.
// Round 2 (1b19bedc)
//  • A    New isApartment and plotAreaSeed arguments; the plot seed fills the draft on hydration.
//  • Re-pulling the inventory keeps unit costs already priced (keepCostLineInputs) and the toast
//           says which lines kept theirs (costRepullMessage).
//  • A refused save on leaving the screen is toasted «لم تُحفظ تعديلات أسلوب التكلفة: …».
// ──────────────────────────────────────────────────────────────────────────────────────────────

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getBuildingInventory,
  type ValuationCostApproachDto,
  type ValuationCostLineDto,
} from "@platform/api-client";
import { useToast } from "@platform/ui-kit";

import {
  COST_GROUP1_KEYS,
  COST_ITEM_OPTIONS,
  costGroupOf,
} from "./lib/cost-line-math";
import { fetchInspectorWorkspace } from "../../../lib/case-study-bridge";
import {
  EMPTY_COST_FIELDS,
  blankCostLine,
  buildCostAlerts,
  buildCostNarrative,
  costApproachDerived,
  costFieldsFromDto,
  costLineTotals,
  costLinesFromInventory,
  keepCostLineInputs,
  costRepullMessage,
  costSaveRequest,
  inspectorAgeYearsForCostField,
  reorderCostLines,
  type CostApproachFields,
} from "./lib/cost-approach-state";
import { apiConfig } from "./lib/shell-utils";
import { useCostAutosave } from "./useCostAutosave";
import { useCostInspectorSync } from "./useCostInspectorSync";
import { useValuationWorkErrors } from "./ValuationWorkErrors";

type CostApproachWorkflowArgs = {
  valuationRequestId: string | null;
  poNumber?: string;
  propertyId: string;
  inspectionTaskId?: string | null;
  /** Inspector-data groups changed since the appraiser last acknowledged (age → «طبّق عمر المعاين»). */
  inspectorChangedGroups?: readonly string[] | null;
  cost: ValuationCostApproachDto | null;
  hydrateKey: number;
  buildingOnly: boolean;
  /** The apartment's land is a share of the building plot (plot + share required). */
  isApartment?: boolean;
  /** The plot box before one is saved (`buildingPlotAreaSeed`) — a draft, never auto-saved. */
  plotAreaSeed?: string;
  costBasisKey: string;
  /** The appraiser's package is submitted: the numbers are closed (server-locked). */
  locked?: boolean;
  onSavingChange: (saving: boolean) => void;
  onCostSaved: (dto: ValuationCostApproachDto) => void;
};

/**
 * Owns the cost-approach drafts, their hydration from the server batch, the
 * live totals/alerts/narrative memos and the writes (seed from inventory, the
 * debounced autosave after every edit and the explicit save — `useCostAutosave`).
 * Drafts are local so typing here does not re-render the valuation shell.
 */
export function useCostApproachWorkflow({
  valuationRequestId,
  poNumber,
  propertyId,
  inspectionTaskId = null,
  inspectorChangedGroups = null,
  cost,
  hydrateKey,
  buildingOnly,
  isApartment = false,
  plotAreaSeed = "",
  costBasisKey,
  locked = false,
  onSavingChange,
  onCostSaved,
}: CostApproachWorkflowArgs) {
  const { showToast } = useToast();
  const { reportSaveFailure, clearSaveErrors } = useValuationWorkErrors();
  const [costDraft, setCostDraft] = useState<ValuationCostLineDto[]>([]);
  const [fields, setFields] = useState<CostApproachFields>(EMPTY_COST_FIELDS);
  /** Drag a cost line to reorder within its group (drag-to-reorder from the interactive form). */
  const [dragCostId, setDragCostId] = useState<string | null>(null);
  /** Bumps on every appraiser edit — what the autosave saves (seeds and hydration never bump it). */
  const [editVersion, setEditVersion] = useState(0);
  const markEdited = useCallback(() => setEditVersion((v) => v + 1), []);

  const setField = useCallback(
    <K extends keyof CostApproachFields>(key: K, value: CostApproachFields[K]) => {
      setFields((prev) => ({ ...prev, [key]: value }));
      markEdited();
    },
    [markEdited],
  );

  const setIndirect = useCallback(
    (itemKey: string, patch: { pct?: string; rationale?: string }) => {
      markEdited();
      setFields((prev) => ({
        ...prev,
        indirectDraft: {
          ...prev.indirectDraft,
          [itemKey]: {
            pct: patch.pct ?? prev.indirectDraft[itemKey]?.pct ?? "0",
            rationale:
              patch.rationale ?? prev.indirectDraft[itemKey]?.rationale ?? "",
          },
        },
      }));
    },
    [markEdited],
  );

  // Hydrate from the server batch — each full load (new hydrateKey) reseeds drafts;
  // silent reloads leave them alone (same meaning as hydrateEdits in the shell previously).
  // The drafts are reseeded during render; the effect below runs the async seeding only.
  const [hydratedKey, setHydratedKey] = useState<number | null>(null);
  if (hydratedKey !== hydrateKey) {
    setHydratedKey(hydrateKey);
    if (!cost) {
      setCostDraft([]);
    } else {
      setCostDraft(cost.lines);
      setFields(costFieldsFromDto(cost, undefined, plotAreaSeed));
    }
  }
  const hydratedKeyRef = useRef<number | null>(null);
  useEffect(() => {
    if (hydratedKeyRef.current === hydrateKey) return;
    hydratedKeyRef.current = hydrateKey;
    // An empty cost table starts from the case specialist's «جدول المكونات» (draft only —
    // nothing is saved until the appraiser saves; later edits are never overwritten).
    const seedFromComponents = () => {
      const config = apiConfig();
      if (!config || !poNumber || !propertyId) return () => {};
      let stop = false;
      void getBuildingInventory(config, poNumber, propertyId).then((inv) => {
        if (stop || !inv.ok || inv.data.lines.length === 0) return;
        const seeded = costLinesFromInventory(inv.data.lines);
        setCostDraft((prev) => (prev.length > 0 ? prev : seeded));
        showToast(`نزلت ${seeded.length} بنود من جدول المكونات — أدخل سعر المتر`, "info");
      });
      return () => {
        stop = true;
      };
    };
    return !cost || cost.lines.length === 0 ? seedFromComponents() : () => {};
  }, [hydrateKey, cost, poNumber, propertyId, showToast]);

  // «العمر الفعلي» starts from the inspector's age until the appraiser saves one — also when the
  // cost approach was never saved (no `cost` yet).
  // Fixed 2026-10-28: the read lived in the effect above, whose cleanup cancelled it on any new
  // `cost` object or a late inspection id while its once-per-load guard skipped the retry, so the
  // 10-year default stayed (and «سحب من حصر المباني» saved it).
  const savedActualAge = cost?.actualAgeYears;
  useEffect(() => {
    const taskId = inspectionTaskId?.trim();
    if (savedActualAge != null || !taskId) return;
    let cancelled = false;
    void fetchInspectorWorkspace(taskId).then((workspace) => {
      if (cancelled) return;
      const age = inspectorAgeYearsForCostField(workspace?.propertyAgeYears);
      if (age) setFields((prev) => ({ ...prev, actualAge: age }));
    });
    return () => {
      cancelled = true;
    };
  }, [hydrateKey, savedActualAge, inspectionTaskId]);

  const setActualAge = useCallback(
    (age: string) => setField("actualAge", age),
    [setField],
  );
  const inspectorSync = useCostInspectorSync({
    poNumber,
    propertyId,
    inspectionTaskId,
    hydrateKey,
    costDraft,
    setCostDraft,
    fields,
    setActualAge,
    inspectorChangedGroups,
    locked,
  });

  const seedCostFromInventory = useCallback(async () => {
    const config = apiConfig();
    if (!config || !valuationRequestId || !poNumber) {
      showToast("يلزم رقم أمر العمل لسحب حصر المباني", "error");
      return;
    }
    const inv = await getBuildingInventory(config, poNumber, propertyId);
    if (!inv.ok) {
      showToast("تعذّر تحميل حصر المباني", "error");
      return;
    }
    // Unit costs already priced survive the re-pull (they used to reset to 0); the toast says
    // which lines kept theirs and which still need one.
    const seeded = costLinesFromInventory(inv.data.lines);
    setCostDraft((prev) => keepCostLineInputs(seeded, prev));
    markEdited();
    showToast(costRepullMessage(keepCostLineInputs(seeded, costDraft)), "info");
  }, [costDraft, markEdited, poNumber, propertyId, showToast, valuationRequestId]);

  const { saveState, saveNow: saveCost } = useCostAutosave({
    valuationRequestId,
    locked,
    editVersion,
    hydrateKey,
    buildRequest: () => costSaveRequest(fields, costDraft),
    onSavingChange,
    onSaved: (dto, editedSinceSend) => {
      clearSaveErrors();
      // Lines typed while the save was in flight stay; the next autosave sends them.
      if (!editedSinceSend) setCostDraft(dto.lines);
      // Silent reload — no loading-skeleton flash after save (used to be a full reload).
      onCostSaved(dto);
    },
    onManualSaved: () => showToast("تم حفظ أسلوب التكلفة", "success"),
    onManualFailure: (failure) => reportSaveFailure(failure, "تعذّر حفظ التكلفة"),
    onLeaveFailure: (message) => showToast(`لم تُحفظ تعديلات أسلوب التكلفة: ${message}`, "error"),
  });

  // Live local calcs per interactive-form rules (server recalculates on save).
  const totals = useMemo(() => costLineTotals(costDraft), [costDraft]);
  const derived = costApproachDerived(
    fields,
    totals.directTotal,
    cost,
    buildingOnly,
  );

  const usedItemKeys = useMemo(
    () => new Set(costDraft.map((l) => l.itemKey)),
    [costDraft],
  );
  /** Items still selectable in a group — the “اختر البند” ghost row. */
  const ghostOptionsFor = useCallback(
    (group: "area" | "extra") =>
      COST_ITEM_OPTIONS.filter(
        (o) =>
          o.key !== "custom" &&
          !usedItemKeys.has(o.key) &&
          (group === "area"
            ? COST_GROUP1_KEYS.has(o.key)
            : !COST_GROUP1_KEYS.has(o.key)),
      ),
    [usedItemKeys],
  );

  const costAlerts = buildCostAlerts(
    fields,
    costDraft,
    totals,
    derived,
    buildingOnly,
    isApartment,
  );

  // memo + short-circuit: multi-KB text used to rebuild on every keystroke then be discarded
  // entirely whenever the field was manually edited (rerender-memo).
  const costNarrativeDirty = fields.costAnalysisNotes.trim().length > 0;
  const costNarrativeAuto = useMemo(
    () =>
      costNarrativeDirty ? "" : buildCostNarrative(fields, costDraft, costBasisKey),
    [costNarrativeDirty, fields, costDraft, costBasisKey],
  );

  const patchLine = useCallback(
    (idx: number, partial: Partial<ValuationCostLineDto>) => {
      markEdited();
      setCostDraft((prev) =>
        prev.map((l, i) => (i === idx ? { ...l, ...partial } : l)),
      );
    },
    [markEdited],
  );
  const removeCostLine = useCallback(
    (idx: number) => {
      markEdited();
      setCostDraft((prev) => prev.filter((_, i) => i !== idx));
    },
    [markEdited],
  );
  const addCostLine = useCallback(
    (partial: Partial<ValuationCostLineDto>) => {
      markEdited();
      setCostDraft((prev) => [...prev, blankCostLine(prev.length, partial)]);
    },
    [markEdited],
  );
  /** Insert a custom line after a given row — inherits the row’s group (hover-insert from the form). */
  const insertCostLineAfter = useCallback((idx: number) => {
    markEdited();
    setCostDraft((prev) => {
      const anchor = prev[idx];
      if (!anchor) return prev;
      const next = [...prev];
      next.splice(
        idx + 1,
        0,
        blankCostLine(prev.length, {
          structureKind: costGroupOf(anchor) === "area" ? "floor" : "other",
        }),
      );
      return next;
    });
  }, [markEdited]);
  const moveCostLine = useCallback(
    (sourceId: string, targetIdx: number) => {
      markEdited();
      setCostDraft((prev) => reorderCostLines(prev, sourceId, targetIdx) ?? prev);
    },
    [markEdited],
  );

  return {
    costDraft,
    fields,
    setField,
    setIndirect,
    dragCostId,
    setDragCostId,
    totals,
    derived,
    costAlerts,
    costNarrativeDirty,
    costNarrativeAuto,
    usedItemKeys,
    ghostOptionsFor,
    patchLine,
    addCostLine,
    removeCostLine,
    insertCostLineAfter,
    moveCostLine,
    seedCostFromInventory,
    saveCost,
    saveState,
    ...inspectorSync,
    // The inventory-drift buttons are the appraiser's edits too — the autosave sends them.
    addNewInventoryLines: () => {
      inspectorSync.addNewInventoryLines();
      markEdited();
    },
    updateInventoryAreas: () => {
      inspectorSync.updateInventoryAreas();
      markEdited();
    },
  };
}

export type CostApproachWorkflow = ReturnType<typeof useCostApproachWorkflow>;
