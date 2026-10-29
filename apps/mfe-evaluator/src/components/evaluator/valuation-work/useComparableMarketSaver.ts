"use client";

/**
 * Shared write plumbing for the valuation-work command hooks: the auth/request
 * guard every command starts with, the context helpers that pick the market or
 * land table, and the two save shapes (one comparable, or a fan-out across the
 * adopted set) with their saving flag, failure toast and silent reload.
 */
import { useRef } from "react";
import { useLatestRef } from "@platform/app-shared/hooks/use-latest-ref";
import {
  saveValuationComparableMarket,
  type SaveValuationComparableMarketRequest,
  type ValuationComparableSelectionDto,
} from "@platform/api-client";
import {
  createComparableMarketWriteQueue,
  type ComparableMarketWriteQueue,
  type MarketWrite,
} from "./lib/comparable-market-write-queue";
import { marketSaveBody } from "./lib/market-save-mappers";
import { apiConfig } from "./lib/shell-utils";
import { LAND_WITHIN_COST } from "./lib/shell-state";
import {
  contextOfSelection,
  type FactorRow,
  type SavedLine,
} from "./lib/market-commands-state";
import type { ValuationWorkData } from "./useValuationWorkData";

type WriteContext = {
  config: NonNullable<ReturnType<typeof apiConfig>>;
  valuationRequestId: string;
};

/** Builds one comparable's save from its freshest copy (see comparable-market-write-queue.ts). */
type LinesFor = (item: ValuationComparableSelectionDto) => SavedLine[];
/** Like `LinesFor`, but null declines the save (a check on the freshest copy failed). */
type LinesOrDecline = (item: ValuationComparableSelectionDto) => SavedLine[] | null;
type ExtraFor = (
  item: ValuationComparableSelectionDto,
) => Partial<SaveValuationComparableMarketRequest> | undefined;

type FanOutSave = {
  items: ValuationComparableSelectionDto[];
  linesFor: LinesFor;
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
  if (res.kind === "auth") return "انتهت الجلسة — سجّل الدخول مجدداً";
  if (res.kind === "network") return "تعذّر الاتصال بالخادم";
  return fallback;
}

/**
 * One comparable's PUT with a single replay on a row-version conflict.
 * `item` is the freshest copy the write queue built the lines from, so the
 * weight and override fields the body keeps come from it too.
 */
async function putMarket(
  ctx: WriteContext,
  item: ValuationComparableSelectionDto,
  { lines, extra }: MarketWrite,
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
  // The screen's current copy of a comparable, read when a queued write runs —
  // not when the edit was made, so a stale render closure cannot feed it old lines.
  const listsRef = useLatestRef([data.selection, data.landSelection]);
  const writeQueueRef = useRef<ComparableMarketWriteQueue | null>(null);

  /** The valuation's one write queue, made on the first save (handlers only, never in render). */
  function writeQueue(): ComparableMarketWriteQueue {
    writeQueueRef.current ??= createComparableMarketWriteQueue((id) => {
      for (const list of listsRef.current) {
        const found = list?.items.find((i) => i.id === id);
        if (found) return found;
      }
      return undefined;
    });
    return writeQueueRef.current;
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

  /**
   * One comparable: saving flag, failure toast, silent reload on success. Returns success.
   * `linesFor` / `extraFor` get the comparable as it stands after every earlier queued
   * write — two quick edits on one comparable (a cell % then its description) used to
   * both build on the pre-save item, and the second erased the first.
   * When `linesFor` returns null nothing is sent and the result is false, with no
   * toast or reload — the caller reports why on the field.
   */
  async function saveOne(
    ctx: WriteContext,
    item: ValuationComparableSelectionDto,
    linesFor: LinesOrDecline,
    errorMessage: string,
    extraFor?: ExtraFor,
  ): Promise<boolean> {
    setSaving(true);
    return writeQueue().write({
      items: [item],
      build: (fresh) => {
        const lines = linesFor(fresh);
        return lines ? { lines, extra: extraFor?.(fresh) } : null;
      },
      put: (fresh, write) => putMarket(ctx, fresh, write),
      settle: async ([res]) => {
        setSaving(false);
        if (!res) return false;
        if (!res.ok) {
          showToast(writeFailureMessage(res, errorMessage), "error");
          return false;
        }
        await reload({ silent: true, scope: "derived" });
        return true;
      },
    });
  }

  /**
   * Every adopted comparable, one after another so xmin on a row is never raced.
   * Like `saveOne`, each comparable's lines are built from its freshest copy.
   */
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
    return writeQueue().write({
      items,
      build: (fresh) => ({ lines: linesFor(fresh), extra }),
      put: (fresh, write) => putMarket(ctx, fresh, write),
      settle: async (results) => {
        if (trackSaving) setSaving(false);
        const failed = results.find((r) => r && !r.ok);
        if (failed && !failed.ok) {
          showToast(writeFailureMessage(failed, errorMessage), "error");
          await reload({ silent: true, scope: "derived" });
          return false;
        }
        if (successMessage) showToast(successMessage, "success");
        await reload({ silent: true, scope: "derived" });
        return true;
      },
    });
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
