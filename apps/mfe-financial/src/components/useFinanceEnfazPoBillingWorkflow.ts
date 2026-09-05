"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useCommandMutation,
  useIdempotentAction,
} from "@platform/app-shared";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import {
  loadPoEnfazBillingForQuery,
  savePoEnfazBillingData,
  issueEnfazInvoice,
  collectEnfazInvoice,
  downloadEnfazInvoicePdf,
  openEnfazAttachment,
} from "@platform/app-shared/app-data/enfaz-billing-api";
import { useToast } from "@platform/ui-kit";
import type { EnfazReadyPoSummaryDto } from "@platform/api-client";
import {
  billingTotals,
  collectAmountDiffers,
  collectMismatchPrompt,
  defaultCollectAmount,
  draftFromBillingLines,
  patchLineDraft,
  remainingToCollect,
  saveLinesRequest,
  type LineDraft,
  type LineDraftMap,
} from "../lib/finance-enfaz-po-billing-state";
import {
  FINANCE_LIST_PAGE_SIZE,
  useEnfazReadyPosPageQuery,
  useListPageState,
} from "../query/billing-list-page-queries";

const EMPTY_READY_SUMMARIES: EnfazReadyPoSummaryDto[] = [];

/**
 * Workflow of the Enfaz work-order billing screen: the ready-list page, the
 * selected work order, its fee draft and the save / issue / collect / PDF
 * commands. `FinanceEnfazPoBilling` composes the regions over this bag; the
 * pure decisions live in `lib/finance-enfaz-po-billing-state.ts`.
 */
export function useFinanceEnfazPoBillingWorkflow({
  initialPo,
  compact,
}: {
  initialPo: string | null;
  compact: boolean;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [selectedPo, setSelectedPo] = useState<string | null>(
    initialPo?.trim() || null,
  );
  const [draft, setDraft] = useState<LineDraftMap>({});
  const [collectAmount, setCollectAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const { execute: executeIssueInvoice, loading: issuing } = useIdempotentAction(
    useCallback(async (idempotencyKey: string) => {
      if (!selectedPo) throw new Error("اختر أمر عمل");
      return issueEnfazInvoice(selectedPo, idempotencyKey);
    }, [selectedPo]),
  );

  const { run: runCollect, loading: collecting } = useCommandMutation(
    useCallback(
      async (
        args: { poNumber: string; amountSar: number },
        idempotencyKey: string,
      ) =>
        collectEnfazInvoice(
          args.poNumber,
          { amountSar: args.amountSar },
          idempotencyKey,
        ),
      [],
    ),
  );

  const commandBusy = busy || issuing || collecting;

  // One server page of ready work orders (pagination-contract §10.1); the
  // side list pages it, and the first PO of page 1 is the default selection.
  const [readyPage, setReadyPage] = useListPageState("ready");
  const readyQuery = useEnfazReadyPosPageQuery({
    page: readyPage,
    pageSize: FINANCE_LIST_PAGE_SIZE,
  });
  const readySummaries = readyQuery.data?.items ?? EMPTY_READY_SUMMARIES;
  const readyTotalCount = readyQuery.data?.totalCount ?? 0;

  const readyPos = useMemo(
    () => readySummaries.map((s) => s.poNumber),
    [readySummaries],
  );

  useEffect(() => {
    if (initialPo?.trim()) {
      setSelectedPo(initialPo.trim());
      return;
    }
    if (!selectedPo && readyPos.length > 0) setSelectedPo(readyPos[0]);
  }, [initialPo, readyPos, selectedPo]);

  const { data: billing, isPending, isError, error, refetch } = useQuery({
    queryKey: [...appDataKeys.all, "enfaz-billing", selectedPo],
    queryFn: () => loadPoEnfazBillingForQuery(selectedPo!),
    enabled: Boolean(selectedPo),
  });

  useEffect(() => {
    if (!billing) return;
    setDraft(draftFromBillingLines(billing.lines));
    setCollectAmount(defaultCollectAmount(billing));
  }, [billing]);

  const totals = useMemo(
    () => billingTotals(billing?.lines, draft),
    [billing, draft],
  );

  const issued = Boolean(billing?.invoiceNumber);
  const fullyCollected = billing?.invoiceStatus === "collected";
  const remaining = billing ? remainingToCollect(billing) : 0;

  const invalidateBilling = () =>
    queryClient.invalidateQueries({
      queryKey: [...appDataKeys.all, "enfaz-billing"],
    });

  const save = async () => {
    if (!selectedPo || !billing) return;
    setBusy(true);
    try {
      const saved = await savePoEnfazBillingData(
        selectedPo,
        saveLinesRequest(billing.lines, draft),
      );
      if (!saved) {
        showToast("تعذّر حفظ الأتعاب — حاول مرة أخرى", "error");
        return;
      }
      showToast("تم حفظ الأتعاب", "success");
      await invalidateBilling();
    } finally {
      setBusy(false);
    }
  };

  const issueInvoice = async () => {
    if (!selectedPo) return;
    setBusy(true);
    try {
      const outcome = await executeIssueInvoice();
      if (outcome.status === "skipped") return;
      const issuedBilling = outcome.value;
      if (!issuedBilling) {
        showToast("تعذّر إصدار الفاتورة — حاول مرة أخرى", "error");
        return;
      }
      showToast("تم إصدار الفاتورة", "success");
      // Download does not depend on invalidation — parallel so the PDF is not delayed (async-parallel).
      const [, downloaded] = await Promise.all([
        invalidateBilling(),
        downloadEnfazInvoicePdf(selectedPo),
      ]);
      if (!downloaded) {
        showToast("صدرت الفاتورة لكن تعذّر تنزيل PDF", "info");
      }
    } finally {
      setBusy(false);
    }
  };

  const collect = async () => {
    if (!selectedPo || !billing) return;
    const amount = Number(collectAmount);
    if (!(amount > 0)) {
      showToast("أدخل مبلغ تحصيل أكبر من صفر", "error");
      return;
    }
    const owed = remainingToCollect(billing);
    if (collectAmountDiffers(amount, owed) && typeof window !== "undefined") {
      const ok = window.confirm(collectMismatchPrompt(amount, owed));
      if (!ok) return;
    }
    const outcome = await runCollect({
      poNumber: selectedPo,
      amountSar: amount,
    });
    if (outcome.status === "skipped") return;
    if (!outcome.value) {
      showToast("تعذّر تسجيل التحصيل — تحقق من المبلغ", "error");
      return;
    }
    showToast("تم تسجيل التحصيل", "success");
    await invalidateBilling();
  };

  const downloadPdf = async () => {
    if (!selectedPo) return;
    setBusy(true);
    try {
      const ok = await downloadEnfazInvoicePdf(selectedPo);
      if (!ok) {
        showToast("تعذّر تنزيل PDF — تأكد من إصدار الفاتورة أولاً", "error");
        return;
      }
      showToast("تم تنزيل فاتورة PDF", "success");
    } finally {
      setBusy(false);
    }
  };

  const openAttachment = (id: string, index: number) => {
    void openEnfazAttachment(id, `مرفق-مفتاح-${index + 1}`).then((result) => {
      if (!result.ok) {
        showToast(result.error, "error");
      }
    });
  };

  const patchDraft = (propertyId: string, patch: Partial<LineDraft>) => {
    setDraft((prev) => patchLineDraft(prev, propertyId, patch));
  };

  const showReadyEmptyState =
    !compact && !readyQuery.isPending && readyTotalCount === 0 && !initialPo;

  return {
    selectedPo,
    setSelectedPo,
    draft,
    patchDraft,
    collectAmount,
    setCollectAmount,
    commandBusy,
    billing,
    isPending,
    isError,
    error,
    refetch,
    totals,
    issued,
    fullyCollected,
    remaining,
    save,
    issueInvoice,
    collect,
    downloadPdf,
    openAttachment,
    ready: {
      summaries: readySummaries,
      totalCount: readyTotalCount,
      totalPages: readyQuery.data?.totalPages ?? 1,
      page: readyPage,
      setPage: setReadyPage,
      pending: readyQuery.isPending,
    },
    showReadyEmptyState,
  };
}

export type FinanceEnfazPoBillingWorkflow = ReturnType<
  typeof useFinanceEnfazPoBillingWorkflow
>;
