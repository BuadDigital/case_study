"use client";

/**
 * Shared write plumbing for the valuation-work command hooks: the auth/request
 * guard every command starts with, the context helpers that pick the market or
 * land table, and the two save shapes (one comparable, or a fan-out across the
 * adopted set) with their saving flag, failure toast and silent reload.
 */
import { useRef } from "react";
import {
  saveValuationComparableMarket,
  type SaveValuationComparableMarketRequest,
  type ValuationComparableSelectionDto,
} from "@platform/api-client";
import { marketSaveBody } from "./lib/market-save-mappers";
import { apiConfig } from "./lib/shell-utils";
import { LAND_WITHIN_COST } from "./lib/shell-state";
import {
  contextOfSelection,
  type FactorRow,
  type SavedLine,
} from "./lib/market-commands-state";
import type { ValuationWorkData } from "./useValuationWorkData";

export type WriteContext = {
  config: NonNullable<ReturnType<typeof apiConfig>>;
  valuationRequestId: string;
};

export type FanOutSave = {
  items: ValuationComparableSelectionDto[];
  linesFor: (item: ValuationComparableSelectionDto) => SavedLine[];
  extra?: Partial<SaveValuationComparableMarketRequest>;
  errorMessage: string;
  successMessage?: string;
  /** Most fan-outs raise the saving flag; the ✓ toggle runs optimistically without it. */
  trackSaving?: boolean;
};

type MarketWriteResult = Awaited<ReturnType<typeof saveValuationComparableMarket>>;

function writeFailureMessage(
  res: { kind: string; message?: string },
  fallback: string,
): string {
  const message = res.message?.trim();
  if (message) return message;
  if (res.kind === "auth") return "انتهت الجلسة — أعد تسجيل الدخول";
  if (res.kind === "network") return "تعذّر الاتصال بالخادم";
  return fallback;
}

async function putMarket(
  ctx: WriteContext,
  item: ValuationComparableSelectionDto,
  lines: SavedLine[],
  extra?: Partial<SaveValuationComparableMarketRequest>,
): Promise<MarketWriteResult> {
  const body = marketSaveBody(item, lines, extra);
  const attempt = () =>
    saveValuationComparableMarket(
      ctx.config,
      ctx.valuationRequestId,
      item.id,
      body,
    );
  const first = await attempt();
  // A cell save and an add-factor fan-out can hit the same xmin; one replay is enough.
  if (!first.ok && first.kind === "conflict") return attempt();
  return first;
}

export function useComparableMarketSaver(data: ValuationWorkData) {
  const {
    showToast,
    valuationRequestId,
    setSaving,
    adoptedLand,
    visibleAdoptedMarket,
    visibleAdoptedLand,
    visibleFactorRows,
    visibleLandFactorRows,
    adjustmentsLocked,
    reload,
  } = data;
  const writeTail = useRef(Promise.resolve());

  function enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
    const run = writeTail.current.then(task, task);
    writeTail.current = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  /** Null when there is no session or no open request — or when the table is locked and the write needs it open. */
  function writeContext(opts?: { requireUnlocked?: boolean }): WriteContext | null {
    const config = apiConfig();
    if (!config || !valuationRequestId) return null;
    if (opts?.requireUnlocked && adjustmentsLocked) return null;
    return { config, valuationRequestId };
  }

  function contextOfItem(item: ValuationComparableSelectionDto): string {
    return contextOfSelection(item, adoptedLand);
  }
  function adoptedFor(context: string): ValuationComparableSelectionDto[] {
    return context === LAND_WITHIN_COST ? visibleAdoptedLand : visibleAdoptedMarket;
  }
  function factorRowsFor(context: string): FactorRow[] {
    return context === LAND_WITHIN_COST ? visibleLandFactorRows : visibleFactorRows;
  }

  /** One comparable: saving flag, failure toast, silent reload on success. Returns success. */
  async function saveOne(
    ctx: WriteContext,
    item: ValuationComparableSelectionDto,
    lines: SavedLine[],
    errorMessage: string,
    extra?: Partial<SaveValuationComparableMarketRequest>,
  ): Promise<boolean> {
    setSaving(true);
    const res = await enqueueWrite(() => putMarket(ctx, item, lines, extra));
    setSaving(false);
    if (!res.ok) {
      showToast(writeFailureMessage(res, errorMessage), "error");
      return false;
    }
    await reload({ silent: true, scope: "derived" });
    return true;
  }

  /** Every adopted comparable, one after another so xmin on a row is never raced. */
  async function saveMany(
    ctx: WriteContext,
    {
      items,
      linesFor,
      extra,
      errorMessage,
      successMessage,
      trackSaving = true,
    }: FanOutSave,
  ): Promise<boolean> {
    if (trackSaving) setSaving(true);
    const results = await enqueueWrite(async () => {
      const out: MarketWriteResult[] = [];
      for (const item of items) {
        out.push(await putMarket(ctx, item, linesFor(item), extra));
      }
      return out;
    });
    if (trackSaving) setSaving(false);
    const failed = results.find((r) => !r.ok);
    if (failed && !failed.ok) {
      showToast(writeFailureMessage(failed, errorMessage), "error");
      await reload({ silent: true, scope: "derived" });
      return false;
    }
    if (successMessage) showToast(successMessage, "success");
    await reload({ silent: true, scope: "derived" });
    return true;
  }

  return {
    writeContext,
    contextOfItem,
    adoptedFor,
    factorRowsFor,
    saveOne,
    saveMany,
  };
}

export type ComparableMarketSaver = ReturnType<typeof useComparableMarketSaver>;
