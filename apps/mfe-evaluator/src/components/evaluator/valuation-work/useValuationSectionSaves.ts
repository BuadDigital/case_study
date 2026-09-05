"use client";

/**
 * Post-save hooks for the sections that own their own drafts (cost approach,
 * reconciliation, approach settings): apply the returned batch to the shell
 * state, notify the value opinion, reseed drafts, and silent-reload derived
 * data — never a loading-skeleton flash. Also the cost basis/unit save the
 * cost screen performs on top of the last saved settings.
 */
import { useCallback, useRef, type Dispatch, type SetStateAction } from "react";
import {
  saveValuationApproachSettings,
  type ValuationApproachSettingsDto,
  type ValuationCostApproachDto,
  type ValuationReconciliationDto,
} from "@platform/api-client";
import { apiConfig } from "./lib/shell-utils";
import {
  costBasisUnitSettingsBody,
  hasPositiveFinalOpinion,
} from "./lib/valuation-data-state";

type SilentReload = (opts?: {
  silent?: boolean;
  scope?: "full" | "derived";
}) => Promise<void>;

export function useValuationSectionSaves({
  showToast,
  setSaving,
  setCost,
  setRecon,
  setApproachSettings,
  setSettingsHydrateKey,
  approachSettings,
  valuationRequestIdRef,
  reloadRef,
  onFinalOpinionChangeRef,
}: {
  showToast: (message: string, kind: "success" | "error") => void;
  setSaving: Dispatch<SetStateAction<boolean>>;
  setCost: Dispatch<SetStateAction<ValuationCostApproachDto | null>>;
  setRecon: Dispatch<SetStateAction<ValuationReconciliationDto | null>>;
  setApproachSettings: Dispatch<
    SetStateAction<ValuationApproachSettingsDto | null>
  >;
  setSettingsHydrateKey: Dispatch<SetStateAction<number>>;
  approachSettings: ValuationApproachSettingsDto | null;
  valuationRequestIdRef: { current: string | null };
  reloadRef: { current: SilentReload };
  onFinalOpinionChangeRef: {
    current: ((finalOpinionValue: number) => void) | undefined;
  };
}) {
  /** After cost save: update the batch and silent-reload — no loading-skeleton flash. */
  const onCostSaved = useCallback(
    (dto: ValuationCostApproachDto) => {
      setCost(dto);
      void reloadRef.current({ silent: true, scope: "derived" });
    },
    [setCost, reloadRef],
  );
  /** After reconciliation save: update the batch, notify value opinion, and silent-reload. */
  const onReconSaved = useCallback(
    (dto: ValuationReconciliationDto) => {
      setRecon(dto);
      if (hasPositiveFinalOpinion(dto.finalOpinionValue)) {
        onFinalOpinionChangeRef.current?.(dto.finalOpinionValue);
      }
      void reloadRef.current({ silent: true, scope: "derived" });
    },
    [setRecon, reloadRef, onFinalOpinionChangeRef],
  );
  const approachSettingsRef = useRef(approachSettings);
  approachSettingsRef.current = approachSettings;
  /** After settings save: update the batch, reseed settings drafts, and silent-reload derived data. */
  const onSettingsSaved = useCallback(
    (dto: ValuationApproachSettingsDto) => {
      setApproachSettings(dto);
      setSettingsHydrateKey((k) => k + 1);
      void reloadRef.current({ silent: true, scope: "derived" });
    },
    [setApproachSettings, setSettingsHydrateKey, reloadRef],
  );
  /** Save cost basis/unit from the cost screen — layered on the last saved settings. */
  const onSaveCostBasisUnit = useCallback(
    async (basisKey: string, unitKey: string) => {
      const config = apiConfig();
      const s = approachSettingsRef.current;
      const requestId = valuationRequestIdRef.current;
      if (!config || !requestId || !s) return;
      setSaving(true);
      const res = await saveValuationApproachSettings(
        config,
        requestId,
        costBasisUnitSettingsBody(s, basisKey, unitKey),
      );
      setSaving(false);
      if (!res.ok) {
        showToast(res.message ?? "تعذّر بدء التقييم", "error");
        return;
      }
      showToast("تم حفظ أساس ووحدة التكلفة", "success");
      setApproachSettings(res.data);
      setSettingsHydrateKey((k) => k + 1);
      void reloadRef.current({ silent: true, scope: "derived" });
    },
    [
      showToast,
      setSaving,
      setApproachSettings,
      setSettingsHydrateKey,
      valuationRequestIdRef,
      reloadRef,
    ],
  );

  return { onCostSaved, onReconSaved, onSettingsSaved, onSaveCostBasisUnit };
}
