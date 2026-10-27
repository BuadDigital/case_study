"use client";

/**
 * All non-rendering workflow behind `EngFeesHtmlScreen`: the ledger and
 * statement queries, tab/filter/invoice-form state, the fee transition and the
 * vendor-invoice submit. The screen consumes the returned bag and keeps JSX
 * only; pure rules live in `eng-fees-state.ts`.
 */
import { fmtSar } from "@platform/app-shared/format/number";
import { useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { PartyBillingStatementDto } from "@platform/api-client";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import {
  loadPartyBillingStatements,
  runSubmitVendorInvoice,
  uploadPartyBillingVendorInvoice,
} from "@platform/app-shared/app-data/party-billing-statements-api";
import { sortInspectorFeeRowsNewestFirst } from "@platform/app-shared/fees/party-fee-meta";
import { todayIso } from "@platform/app-shared/format/date";
import { useInspectorFeesQuery } from "../../query/inspector-fees-queries";
import { computeEngineeringFeesSituation } from "../../lib/app-data/active-transaction-page-situation";
import {
  engFeeTabCounts,
  filterEngFeeRows,
  filterEngStatements,
  type TabId,
} from "./eng-fees-state";
import { useFeeLedgerWrites } from "./useFeeLedgerWrites";

export function useEngFeesWorkflow(assigneeId: string | undefined) {
  const { showToast, busyId, setBusyId, invalidate } = useFeeLedgerWrites();
  const [tab, setTab] = useState<TabId>("action");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [stFilter, setStFilter] = useState("");
  const [fnSearch, setFnSearch] = useState("");
  const [openFn, setOpenFn] = useState<string | null>(null);
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayIso);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);

  const { data: summary, isPending: feesPending } = useInspectorFeesQuery(
    {
      assigneeId,
      submittedOnly: false,
      taskKind: "engineering-survey",
    },
    { enabled: Boolean(assigneeId) },
  );

  const rows = useMemo(
    () => sortInspectorFeeRowsNewestFirst(summary?.rows ?? []),
    [summary?.rows],
  );

  const { data: statements = [] } = useQuery({
    queryKey: [
      ...appDataKeys.all,
      "party-billing",
      "statements",
      assigneeId ?? "none",
      "issued+",
    ],
    queryFn: () =>
      loadPartyBillingStatements({
        assigneeId,
        issuedOrLaterOnly: true,
      }),
    enabled: Boolean(assigneeId),
  });

  const closedPaid = useMemo(
    () =>
      statements
        .filter((s) => s.status === "closed")
        .reduce((sum, s) => sum + (Number(s.totalNetSar) || 0), 0),
    [statements],
  );

  const kpi = useMemo(
    () =>
      computeEngineeringFeesSituation(rows, {
        closedStatementsPaidSar: closedPaid,
      }),
    [rows, closedPaid],
  );

  const { actionCount, readyCount } = engFeeTabCounts(rows);

  const filteredFees = useMemo(
    () => filterEngFeeRows(rows, tab, deferredSearch, stFilter),
    [rows, tab, deferredSearch, stFilter],
  );

  const filteredFns = useMemo(
    () => filterEngStatements(statements, fnSearch),
    [statements, fnSearch],
  );

  const submitInvoice = async (s: PartyBillingStatementDto) => {
    if (!invoiceNo.trim()) {
      showToast("رقم الفاتورة مطلوب", "error");
      return;
    }
    if (!invoiceFile) {
      showToast("اختر ملف الفاتورة أولاً", "error");
      return;
    }
    setBusyId(s.id);
    try {
      const upload = await uploadPartyBillingVendorInvoice(s.id, invoiceFile);
      if (!upload.ok) {
        showToast(upload.error, "error");
        return;
      }
      const result = await runSubmitVendorInvoice(s.id, {
        invoiceNumber: invoiceNo.trim(),
        invoiceDate: invoiceDate
          ? new Date(`${invoiceDate}T12:00:00`).toISOString()
          : undefined,
        attachmentId: upload.id,
      });
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      showToast(`رُفعت الفاتورة — ${fmtSar(s.totalNetSar, { digits: 3, trim: true })}`, "success");
      setInvoiceNo("");
      setInvoiceFile(null);
      setOpenFn(null);
      await invalidate();
    } finally {
      setBusyId(null);
    }
  };

  const onTabChange = (id: string) => {
    setTab(id as TabId);
    setSearch("");
    setStFilter("");
    setFnSearch("");
    setOpenFn(null);
    setInvoiceFile(null);
  };

  const openStatement = useMemo(
    () =>
      openFn
        ? (filteredFns.find((s) => s.referenceNumber === openFn) ??
          statements.find((s) => s.referenceNumber === openFn) ??
          null)
        : null,
    [openFn, filteredFns, statements],
  );

  const closeStatementModal = () => {
    setOpenFn(null);
    setInvoiceFile(null);
  };

  return {
    tab,
    onTabChange,
    search,
    setSearch,
    stFilter,
    setStFilter,
    fnSearch,
    setFnSearch,
    openFn,
    setOpenFn,
    busyId,
    invoiceNo,
    setInvoiceNo,
    invoiceDate,
    setInvoiceDate,
    invoiceFile,
    setInvoiceFile,
    feesPending,
    statements,
    kpi,
    actionCount,
    readyCount,
    filteredFees,
    filteredFns,
    submitInvoice,
    openStatement,
    closeStatementModal,
    showToast,
  };
}
