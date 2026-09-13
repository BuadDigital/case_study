"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  activeValuationListOptions,
  getWorkOrder,
  saveValuationReconciliation,
  type ValuationCostApproachDto,
  type ValuationReconciliationDto,
  type ValuationReconciliationMethodDto,
} from "@platform/api-client";
import { useToast } from "@platform/ui-kit";
import { useValuationListsQuery } from "@platform/app-shared/query/valuation-lists-query";
import {
  VALUE_BASIS_OPTIONS,
  basisOfValueKeyForAssignment,
} from "@platform/app-shared/app-data/assignment-valuation-defaults";

import {
  alertOverridesFromRecon,
  finalOpinionComputed,
  mergeReconMethods,
  reconciliationSaveRequest,
  syncDiscountLineInOpinion,
  workOrderPremiseKey,
} from "./lib/final-opinion-state";
import { apiConfig } from "./lib/shell-utils";

export type FinalOpinionWorkflowArgs = {
  valuationRequestId: string | null;
  recon: ValuationReconciliationDto | null;
  cost: ValuationCostApproachDto | null;
  hydrateKey: number;
  buildingOnly: boolean;
  hasAdoptedMarket: boolean;
  assignmentType?: string;
  poNumber?: string;
  onSavingChange: (saving: boolean) => void;
  onReconSaved: (dto: ValuationReconciliationDto) => void;
};

/**
 * Owns the final-opinion screen: the reconciliation drafts and their
 * hydration, the live value calc, and the reconciliation save.
 */
export function useFinalOpinionWorkflow({
  valuationRequestId,
  recon,
  cost,
  hydrateKey,
  buildingOnly,
  hasAdoptedMarket,
  assignmentType,
  poNumber,
  onSavingChange,
  onReconSaved,
}: FinalOpinionWorkflowArgs) {
  const { showToast } = useToast();
  const [reconMethods, setReconMethods] = useState<ValuationReconciliationMethodDto[]>(
    [],
  );
  const [methodsRationale, setMethodsRationale] = useState("");
  const [finalRoundDecimals, setFinalRoundDecimals] = useState("0");
  const [poKeys, setPoKeys] = useState<{
    basis: string | null;
    premise: string | null;
  }>({ basis: null, premise: null });
  const basisOfValueKey = useMemo(() => {
    const fromPo =
      poKeys.basis?.trim() || recon?.basisOfValueKey?.trim() || "";
    if (fromPo) return fromPo;
    return assignmentType?.trim()
      ? basisOfValueKeyForAssignment(assignmentType)
      : "market";
  }, [assignmentType, poKeys.basis, recon?.basisOfValueKey]);
  const valuePremiseKey = workOrderPremiseKey({
    poPremise: poKeys.premise,
    reconPremise: recon?.valuePremiseKey,
    assignmentType,
  });
  const [liquidationDiscountPct, setLiquidationDiscountPct] = useState("0");
  const [liquidationDiscountRationale, setLiquidationDiscountRationale] =
    useState("");

  useEffect(() => {
    const config = apiConfig();
    const n = poNumber?.trim();
    if (!config || !n) return;
    let cancelled = false;
    void getWorkOrder(config, n).then((res) => {
      if (cancelled || !res.ok) return;
      setPoKeys({
        basis: res.data.basisOfValueKey ?? null,
        premise: res.data.valuePremiseKey ?? null,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [poNumber]);

  // Valuation lists from the shared query — used to duplicate a GET with the final-review tab.
  const { data: valuationLists } = useValuationListsQuery();
  const basisOptions = useMemo(() => {
    const bases = valuationLists
      ? activeValuationListOptions(valuationLists.lists, "valueBases")
      : [];
    return bases.length ? bases : VALUE_BASIS_OPTIONS;
  }, [valuationLists]);
  const premiseOptions = useMemo<{ value: string; label: string }[]>(() => {
    return valuationLists
      ? activeValuationListOptions(valuationLists.lists, "premises")
      : [];
  }, [valuationLists]);

  // Hydration: new key = full load (full reseed); same key with a new batch = silent
  // reload that merges computed approach values and keeps user weights/rationales.
  const hydratedKeyRef = useRef<number | null>(null);
  useEffect(() => {
    if (hydratedKeyRef.current === hydrateKey) {
      if (recon) {
        setReconMethods((prev) => mergeReconMethods(recon.methods, prev));
      }
      return;
    }
    hydratedKeyRef.current = hydrateKey;
    if (!recon) {
      setReconMethods([]);
      setMethodsRationale("");
      setFinalRoundDecimals("0");
      setLiquidationDiscountPct("0");
      setLiquidationDiscountRationale("");
      return;
    }
    setReconMethods(recon.methods);
    setMethodsRationale(recon.methodsRationale ?? "");
    setFinalRoundDecimals(String(recon.finalRoundDecimals ?? 0));
    setLiquidationDiscountPct(String(recon.liquidationDiscountPct ?? 0));
    setLiquidationDiscountRationale(recon.liquidationDiscountRationale ?? "");
  }, [hydrateKey, recon, assignmentType]);

  /* ─── Live value-opinion calc (interactive-form spec) ─── */
  const finalComputed = useMemo(
    () =>
      finalOpinionComputed({
        reconMethods,
        basisOfValueKey,
        basisOptions,
        liquidationDiscountPct,
        finalRoundDecimals,
        cost,
        buildingOnly,
        hasAdoptedMarket,
      }),
    [
      buildingOnly,
      reconMethods,
      basisOfValueKey,
      liquidationDiscountPct,
      finalRoundDecimals,
      basisOptions,
      cost,
      hasAdoptedMarket,
    ],
  );

  async function saveReconciliation() {
    const config = apiConfig();
    if (!config || !valuationRequestId) return;
    onSavingChange(true);
    const res = await saveValuationReconciliation(
      config,
      valuationRequestId,
      reconciliationSaveRequest(
        {
          reconMethods,
          methodsRationale,
          finalRoundDecimals,
          basisOfValueKey,
          valuePremiseKey,
          liquidationDiscountPct,
          liquidationDiscountRationale,
          alertOverrides: alertOverridesFromRecon(recon),
        },
        finalComputed.opinionAuto,
      ),
    );
    onSavingChange(false);
    if (!res.ok) {
      showToast(res.message ?? "تعذّر حفظ الترجيح", "error");
      return;
    }
    setReconMethods(res.data.methods);
    setMethodsRationale(res.data.methodsRationale ?? "");
    setFinalRoundDecimals(String(res.data.finalRoundDecimals ?? 0));
    setLiquidationDiscountPct(String(res.data.liquidationDiscountPct ?? 0));
    setLiquidationDiscountRationale(res.data.liquidationDiscountRationale ?? "");
    showToast(
      res.data.liquidationDiscountApplied
        ? "تم حفظ رأي القيمة مع خصم التصفية"
        : "تم حفظ رأي القيمة النهائي",
      "success",
    );
    // Refresh issuance gates and alerts after save (dispositions apply to evaluation immediately).
    onReconSaved(res.data);
  }

  const sole = recon && !recon.meetsMultiMethodGate;
  const {
    weightSumLocal,
    reconWeightsBad,
    weightedLocal,
    isLiquidation,
    forcedCut,
    finalLocal,
    roundNote,
    soleCost,
    methodComplete,
    opinionAuto,
  } = finalComputed;
  // Treated as manually edited only when it differs from auto text (save pins auto without counting as an edit).
  const opinionDirty =
    methodsRationale.trim().length > 0 &&
    methodsRationale.trim() !== opinionAuto.trim();

  const applyLiquidationDiscountPct = useCallback(
    (nextRaw: string) => {
      const nextPct = Number(String(nextRaw).replace(",", ".")) || 0;
      setLiquidationDiscountPct(nextRaw);
      setMethodsRationale((prev) => {
        const trimmed = prev.trim();
        if (!trimmed) return prev;
        // Still on auto text → clear so the textarea follows the regenerated auto.
        if (trimmed === opinionAuto.trim()) return "";
        // Custom prose → only refresh/remove the discount sentence.
        return syncDiscountLineInOpinion(prev, nextPct);
      });
    },
    [opinionAuto],
  );

  const clearMethodsRationale = useCallback(() => {
    setMethodsRationale("");
  }, []);

  return {
    // Reconciliation drafts.
    reconMethods,
    setReconMethods,
    methodsRationale,
    setMethodsRationale,
    finalRoundDecimals,
    setFinalRoundDecimals,
    basisOfValueKey,
    basisOptions,
    premiseOptions,
    valuePremiseKey,
    liquidationDiscountPct,
    setLiquidationDiscountPct: applyLiquidationDiscountPct,
    liquidationDiscountRationale,
    setLiquidationDiscountRationale,
    // Derived.
    sole,
    finalComputed,
    weightSumLocal,
    reconWeightsBad,
    weightedLocal,
    isLiquidation,
    forcedCut,
    finalLocal,
    roundNote,
    soleCost,
    methodComplete,
    opinionAuto,
    opinionDirty,
    clearMethodsRationale,
    // Commands.
    saveReconciliation,
  };
}

export type FinalOpinionWorkflow = ReturnType<typeof useFinalOpinionWorkflow>;
