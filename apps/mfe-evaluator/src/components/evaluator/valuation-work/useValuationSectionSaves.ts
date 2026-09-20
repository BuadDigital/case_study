"use client";

/**
 * Post-save hooks for the sections that own their own drafts (cost approach,
 * reconciliation, approach settings): apply the returned batch to the shell
 * state, notify the value opinion, reseed drafts, and silent-reload derived
 * data — never a loading-skeleton flash.
 */
import { useCallback, type Dispatch, type SetStateAction } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  ValuationApproachSettingsDto,
  ValuationCostApproachDto,
  ValuationReconciliationDto,
} from "@platform/api-client";
import {
  finalOpinionSyncExtrasFromRecon,
  hasPositiveFinalOpinion,
  type FinalOpinionChangeHandler,
} from "./lib/valuation-data-state";

type SilentReload = (opts?: {
  silent?: boolean;
  scope?: "full" | "derived";
}) => Promise<void>;

export function useValuationSectionSaves({
  setCost,
  setRecon,
  setApproachSettings,
  setSettingsHydrateKey,
  reloadRef,
  onFinalOpinionChangeRef,
}: {
  setCost: Dispatch<SetStateAction<ValuationCostApproachDto | null>>;
  setRecon: Dispatch<SetStateAction<ValuationReconciliationDto | null>>;
  setApproachSettings: Dispatch<
    SetStateAction<ValuationApproachSettingsDto | null>
  >;
  setSettingsHydrateKey: Dispatch<SetStateAction<number>>;
  reloadRef: { current: SilentReload };
  onFinalOpinionChangeRef: {
    current: FinalOpinionChangeHandler | undefined;
  };
}) {
  const queryClient = useQueryClient();
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
        onFinalOpinionChangeRef.current?.(
          dto.finalOpinionValue,
          finalOpinionSyncExtrasFromRecon(dto),
        );
      }
      void reloadRef.current({ silent: true, scope: "derived" });
    },
    [setRecon, reloadRef, onFinalOpinionChangeRef],
  );
  /** After settings save: update the batch, reseed settings drafts, and silent-reload derived data. */
  const onSettingsSaved = useCallback(
    (dto: ValuationApproachSettingsDto) => {
      setApproachSettings(dto);
      setSettingsHydrateKey((k) => k + 1);
      // The printed report reads these settings (special assumptions, retrospective line, approaches)
      // from its own cached bundle — drop it so the next open shows what was just saved.
      void queryClient.invalidateQueries({ queryKey: ["evaluator-report-output"] });
      void reloadRef.current({ silent: true, scope: "derived" });
    },
    [setApproachSettings, setSettingsHydrateKey, reloadRef, queryClient],
  );

  return { onCostSaved, onReconSaved, onSettingsSaved };
}
