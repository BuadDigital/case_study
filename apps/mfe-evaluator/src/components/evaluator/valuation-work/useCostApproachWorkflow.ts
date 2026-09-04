"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getBuildingInventory,
  saveValuationCostApproach,
  type ValuationCostApproachDto,
  type ValuationCostLineDto,
} from "@platform/api-client";
import { useToast } from "@platform/ui-kit";

import {
  COST_GROUP1_KEYS,
  COST_ITEM_OPTIONS,
  costGroupOf,
} from "./lib/cost-line-math";
import {
  EMPTY_COST_FIELDS,
  blankCostLine,
  buildCostAlerts,
  buildCostNarrative,
  costApproachDerived,
  costFieldsFromDto,
  costLineTotals,
  costLinesFromInventory,
  costSaveRequest,
  reorderCostLines,
  type CostApproachFields,
} from "./lib/cost-approach-state";
import { apiConfig } from "./lib/shell-utils";

export type CostApproachWorkflowArgs = {
  valuationRequestId: string | null;
  poNumber?: string;
  propertyId: string;
  cost: ValuationCostApproachDto | null;
  hydrateKey: number;
  buildingOnly: boolean;
  costBasisKey: string;
  onSavingChange: (saving: boolean) => void;
  onCostSaved: (dto: ValuationCostApproachDto) => void;
};

/**
 * Owns the cost-approach drafts, their hydration from the server batch, the
 * live totals/alerts/narrative memos and the two writes (seed from inventory,
 * save). Drafts are local so typing here does not re-render the valuation shell.
 */
export function useCostApproachWorkflow({
  valuationRequestId,
  poNumber,
  propertyId,
  cost,
  hydrateKey,
  buildingOnly,
  costBasisKey,
  onSavingChange,
  onCostSaved,
}: CostApproachWorkflowArgs) {
  const { showToast } = useToast();
  const [costDraft, setCostDraft] = useState<ValuationCostLineDto[]>([]);
  const [fields, setFields] = useState<CostApproachFields>(EMPTY_COST_FIELDS);
  /** Drag a cost line to reorder within its group (drag-to-reorder from the interactive form). */
  const [dragCostId, setDragCostId] = useState<string | null>(null);

  const setField = useCallback(
    <K extends keyof CostApproachFields>(key: K, value: CostApproachFields[K]) =>
      setFields((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const setIndirect = useCallback(
    (itemKey: string, patch: { pct?: string; rationale?: string }) =>
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
      })),
    [],
  );

  // Hydrate from the server batch — each full load (new hydrateKey) reseeds drafts;
  // silent reloads leave them alone (same meaning as hydrateEdits in the shell previously).
  const hydratedKeyRef = useRef<number | null>(null);
  useEffect(() => {
    if (hydratedKeyRef.current === hydrateKey) return;
    hydratedKeyRef.current = hydrateKey;
    if (!cost) {
      setCostDraft([]);
      return;
    }
    setCostDraft(cost.lines);
    setFields(costFieldsFromDto(cost));
  }, [hydrateKey, cost]);

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
    const seeded = costLinesFromInventory(inv.data.lines);
    setCostDraft(seeded);
    showToast(`تم سحب ${seeded.length} بندًا من الحصر — أدخل تكلفة المتر`, "info");
  }, [poNumber, propertyId, showToast, valuationRequestId]);

  const saveCost = useCallback(async () => {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    onSavingChange(true);
    const res = await saveValuationCostApproach(
      config,
      valuationRequestId,
      costSaveRequest(fields, costDraft),
    );
    onSavingChange(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ التكلفة", "error");
      return;
    }
    setCostDraft(res.data.lines);
    showToast("تم حفظ أسلوب التكلفة", "success");
    // Silent reload — no loading-skeleton flash after save (used to be a full reload).
    onCostSaved(res.data);
  }, [
    costDraft,
    fields,
    onCostSaved,
    onSavingChange,
    showToast,
    valuationRequestId,
  ]);

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
    (idx: number, partial: Partial<ValuationCostLineDto>) =>
      setCostDraft((prev) =>
        prev.map((l, i) => (i === idx ? { ...l, ...partial } : l)),
      ),
    [],
  );
  const removeCostLine = useCallback(
    (idx: number) => setCostDraft((prev) => prev.filter((_, i) => i !== idx)),
    [],
  );
  const addCostLine = useCallback(
    (partial: Partial<ValuationCostLineDto>) =>
      setCostDraft((prev) => [...prev, blankCostLine(prev.length, partial)]),
    [],
  );
  /** Insert a custom line after a given row — inherits the row’s group (hover-insert from the form). */
  const insertCostLineAfter = useCallback((idx: number) => {
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
  }, []);
  const moveCostLine = useCallback(
    (sourceId: string, targetIdx: number) =>
      setCostDraft((prev) => reorderCostLines(prev, sourceId, targetIdx) ?? prev),
    [],
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
  };
}

export type CostApproachWorkflow = ReturnType<typeof useCostApproachWorkflow>;
