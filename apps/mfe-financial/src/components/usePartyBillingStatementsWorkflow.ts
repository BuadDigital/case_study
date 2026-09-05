"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import {
  openPartyBillingAttachment,
  runCancelPartyBillingStatement,
  runClosePartyBillingStatement,
  runCreatePartyBillingStatement,
  runIssuePartyBillingStatement,
  runMatchVendorInvoice,
  runRejectVendorInvoice,
  uploadPartyBillingTransferReceipt,
} from "@platform/app-shared/app-data/party-billing-statements-api";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import { useToast } from "@platform/ui-kit";
import type {
  PartyBillingReadyLineDto,
  PartyBillingStatementDto,
} from "@platform/api-client";
import { pushNotification } from "@platform/app-shared/notifications/notification-store";

import {
  partyBillingSections,
  statementStatusesForMode,
  type PartyBillingMode,
} from "../lib/party-billing-statements-state";
import {
  FINANCE_LIST_PAGE_SIZE,
  useListPageState,
  usePartyBillingReadyLinesPageQuery,
  usePartyBillingStatementQuery,
  usePartyBillingStatementsPageQuery,
} from "../query/billing-list-page-queries";
import { EMPTY_READY_LINES, EMPTY_STATEMENTS } from "./FinancePartyBillingParts";

export type PartyBillingWorkflowArgs = {
  mode: PartyBillingMode;
  /** Scope dues/payrolls to one payee (payee account). */
  assigneeId: string | null;
  focusStatementId: string | null;
  onFocusStatement?: (id: string | null, partyId?: string | null) => void;
  onCreatedStatement?: () => void;
};

/**
 * Owns the party-billing screen: the two server-paged lists (dues and
 * statements, pagination-contract §9), the dues selection, the
 * close/reject/cancel form drafts and every write (create, issue, match,
 * reject, cancel, receipt upload, close). Rendering is left to the sections.
 */
export function usePartyBillingStatementsWorkflow({
  mode,
  assigneeId,
  focusStatementId,
  onFocusStatement,
  onCreatedStatement,
}: PartyBillingWorkflowArgs) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];
  const { showDues, showStatements } = partyBillingSections(mode);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  /**
   * Net fee of every ticked line, kept alongside the id set: the dues list is
   * one server page, so a selection made on an earlier page is no longer in
   * `readyLines` when the total is shown.
   */
  const [selectedNet, setSelectedNet] = useState<Map<string, number>>(new Map());
  const [busy, setBusy] = useState(false);
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(
    focusStatementId,
  );
  const [duesSearch, setDuesSearch] = useState("");
  /** Deferred value for filtering — search input stays immediate without blocking typing */
  const deferredDuesSearch = useDeferredValue(duesSearch);
  const [disbursementVoucher, setDisbursementVoucher] = useState("");
  const [transferReference, setTransferReference] = useState("");
  const [receiptRef, setReceiptRef] = useState("");
  const [receiptAttachmentId, setReceiptAttachmentId] = useState<string | null>(
    null,
  );
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [paidAt, setPaidAt] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );

  // Dues: search, payee scope and the oldest-first order are server-side
  // (§9.2); a search or payee change goes back to page 1.
  const duesQ = deferredDuesSearch.trim();
  const [duesPage, setDuesPage] = useListPageState(`${assigneeId ?? ""}|${duesQ}`);
  const readyQuery = usePartyBillingReadyLinesPageQuery(
    {
      assigneeId: assigneeId ?? undefined,
      q: duesQ || undefined,
      sort: "accrued",
      dir: "asc",
      page: duesPage,
      pageSize: FINANCE_LIST_PAGE_SIZE,
    },
    showDues,
  );

  // Statements: the mode's status set and the payee scope are the server
  // filters (§9.1); the “dues” mode shows no statements, so nothing is fetched.
  const [statementsPage, setStatementsPage] = useListPageState(
    `${assigneeId ?? ""}|${mode}`,
  );
  const statementsQuery = usePartyBillingStatementsPageQuery(
    {
      assigneeId: assigneeId ?? undefined,
      status: statementStatusesForMode(mode),
      page: statementsPage,
      pageSize: FINANCE_LIST_PAGE_SIZE,
    },
    showStatements,
  );

  const readyLines = readyQuery.data?.items ?? EMPTY_READY_LINES;
  const statements = statementsQuery.data?.items ?? EMPTY_STATEMENTS;

  /** The page already carries the search and the sort — kept under the old name for the section. */
  const filteredDues = readyLines;
  /** Selectable lines (net > 0) — computed once instead of repeating filter */
  const payableDues = useMemo(
    () => filteredDues.filter((l) => l.netFeeSar > 0),
    [filteredDues],
  );

  // The focused statement may sit on another page (deep link, or the one just
  // created); fetch it by id when the page does not carry it.
  const focusedId = focusStatementId ?? selectedStatementId;
  const focusedOnPage = useMemo(
    () => (focusedId ? (statements.find((s) => s.id === focusedId) ?? null) : null),
    [statements, focusedId],
  );
  const focusedStatementQuery = usePartyBillingStatementQuery(
    focusedId && !focusedOnPage ? focusedId : null,
  );
  const selectedStatement = focusedOnPage ?? focusedStatementQuery.data ?? null;

  const selectedTotal = useMemo(() => {
    let total = 0;
    for (const id of selected) total += selectedNet.get(id) ?? 0;
    return total;
  }, [selected, selectedNet]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: appDataKeys.partyBilling(),
      }),
      queryClient.invalidateQueries({
        queryKey: [...appDataKeys.all, "inspector-fees"],
      }),
    ]);
  };

  const resetCloseForm = () => {
    setDisbursementVoucher("");
    setTransferReference("");
    setReceiptRef("");
    setReceiptAttachmentId(null);
    setReceiptFileName(null);
    setRejectReason("");
    setCancelReason("");
    setPaidAt(new Date().toISOString().slice(0, 10));
  };

  const selectStatement = (id: string) => {
    setSelectedStatementId(id);
    const party =
      statements.find((s) => s.id === id)?.assigneeId?.trim() || assigneeId;
    onFocusStatement?.(id, party);
    resetCloseForm();
  };

  const closeDetail = () => {
    setSelectedStatementId(null);
    onFocusStatement?.(null);
  };

  const clearSelection = () => {
    setSelected(new Set());
    setSelectedNet(new Map());
  };

  const toggle = (line: PartyBillingReadyLineDto) => {
    const id = line.workflowTaskId;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSelectedNet((prev) => new Map(prev).set(id, line.netFeeSar));
  };

  const selectGroup = (lines: PartyBillingReadyLineDto[], on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const line of lines) {
        if (on) next.add(line.workflowTaskId);
        else next.delete(line.workflowTaskId);
      }
      return next;
    });
    setSelectedNet((prev) => {
      const next = new Map(prev);
      for (const line of lines) next.set(line.workflowTaskId, line.netFeeSar);
      return next;
    });
  };

  const createStatement = async () => {
    if (selected.size === 0) {
      showToast("اختر بنوداً لإنشاء المسير / أمر الصرف", "error");
      return;
    }
    setBusy(true);
    try {
      const result = await runCreatePartyBillingStatement({
        workflowTaskIds: [...selected],
        deferUnselectedForAssignee: false,
      });
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      clearSelection();
      setSelectedStatementId(result.statement.id);
      resetCloseForm();
      showToast(
        result.deferredCount > 0
          ? `أُنشئ المسير ${result.statement.referenceNumber} ورُحِّل ${result.deferredCount} بند`
          : `أُنشئ المسير ${result.statement.referenceNumber}`,
        "success",
      );
      onFocusStatement?.(
        result.statement.id,
        result.statement.assigneeId?.trim() || null,
      );
      onCreatedStatement?.();
      await invalidate();
    } finally {
      setBusy(false);
    }
  };

  const matchInvoice = async (statement: PartyBillingStatementDto) => {
    setBusy(true);
    try {
      const result = await runMatchVendorInvoice(statement.id);
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      showToast(`طُوبقت فاتورة ${result.statement.vendorInvoiceNumber}`, "success");
      await invalidate();
    } finally {
      setBusy(false);
    }
  };

  const rejectInvoice = async (statement: PartyBillingStatementDto) => {
    if (rejectReason.trim().length < 3) {
      showToast("سبب الإعادة للتصحيح إلزامي", "error");
      return;
    }
    setBusy(true);
    try {
      const result = await runRejectVendorInvoice(statement.id, {
        reason: rejectReason.trim(),
      });
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      setRejectReason("");
      showToast("أُعيدت الفاتورة للتصحيح وأُرشفت", "success");
      await invalidate();
    } finally {
      setBusy(false);
    }
  };

  const cancelStatement = async (statement: PartyBillingStatementDto) => {
    if (cancelReason.trim().length < 3) {
      showToast("سبب الإلغاء إلزامي", "error");
      return;
    }
    setBusy(true);
    try {
      const result = await runCancelPartyBillingStatement(statement.id, {
        reason: cancelReason.trim(),
      });
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      setCancelReason("");
      showToast(
        `أُلغي ${result.statement.referenceNumber} — عادت البنود مستحقات`,
        "success",
      );
      await invalidate();
    } finally {
      setBusy(false);
    }
  };

  const issueStatement = async (statement: PartyBillingStatementDto) => {
    setBusy(true);
    try {
      const result = await runIssuePartyBillingStatement(statement.id);
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      if (statement.payeeType === "vendor") {
        pushNotification({
          title: "أُرسل مسير الصرف",
          body: `${result.statement.referenceNumber} مرسل للمكتب.`,
          tone: "info",
          category: "financial",
          href: `/financial?area=costs&section=statements&statement=${result.statement.id}&party=${encodeURIComponent(result.statement.assigneeId || statement.assigneeId || "")}`,
        });
        showToast(`أُرسل المسير ${result.statement.referenceNumber} للمكتب`, "success");
      } else {
        showToast(`صدر أمر الصرف ${result.statement.referenceNumber}`, "success");
      }
      await invalidate();
    } finally {
      setBusy(false);
    }
  };

  const handleReceiptFile = async (
    statement: PartyBillingStatementDto,
    file: File | undefined,
  ) => {
    if (!file) return;
    setUploadingReceipt(true);
    setReceiptFileName(file.name);
    try {
      const upload = await uploadPartyBillingTransferReceipt(statement.id, file);
      if (!upload.ok) {
        showToast(upload.error, "error");
        setReceiptAttachmentId(null);
        setReceiptFileName(null);
        return;
      }
      setReceiptAttachmentId(upload.id);
      setReceiptFileName(upload.fileName);
      showToast("تم رفع إيصال التحويل", "success");
    } finally {
      setUploadingReceipt(false);
    }
  };

  const closeStatement = async (statement: PartyBillingStatementDto) => {
    if (!disbursementVoucher.trim()) {
      showToast("رقم سند الصرف مطلوب", "error");
      return;
    }
    if (!transferReference.trim()) {
      showToast("مرجع التحويل مطلوب", "error");
      return;
    }
    if (!receiptAttachmentId) {
      showToast("إيصال التحويل (مرفق) مطلوب", "error");
      return;
    }
    setBusy(true);
    try {
      const paidAtUtc = paidAt
        ? new Date(`${paidAt}T12:00:00`).toISOString()
        : undefined;
      const result = await runClosePartyBillingStatement(statement.id, {
        disbursementVoucher: disbursementVoucher.trim(),
        transferReference: transferReference.trim(),
        transferReceiptAttachmentId: receiptAttachmentId,
        transferReceiptRef: receiptRef.trim() || undefined,
        paidAtUtc,
      });
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      resetCloseForm();
      showToast(`أُقفل ${result.statement.referenceNumber} كمدفوع`, "success");
      await invalidate();
    } finally {
      setBusy(false);
    }
  };

  const viewReceipt = async (attachmentId: string) => {
    const result = await openPartyBillingAttachment(attachmentId, "إيصال-التحويل");
    if (!result.ok) showToast(result.error, "error");
  };

  return {
    staffUsers,
    readyQuery,
    statementsQuery,
    readyLines,
    statements,
    filteredDues,
    payableDues,
    selectedStatement,
    selectedStatementId,
    selectedTotal,
    selected,
    busy,
    duesSearch,
    setDuesSearch,
    deferredDuesSearch,
    showDues,
    showStatements,
    // Pager state — one server page per list (pagination-contract §9).
    pageSize: FINANCE_LIST_PAGE_SIZE,
    duesPage,
    setDuesPage,
    duesTotalCount: readyQuery.data?.totalCount ?? 0,
    duesTotalPages: readyQuery.data?.totalPages ?? 1,
    statementsPage,
    setStatementsPage,
    statementsTotalCount: statementsQuery.data?.totalCount ?? 0,
    statementsTotalPages: statementsQuery.data?.totalPages ?? 1,
    // Close / reject / cancel form drafts.
    disbursementVoucher,
    setDisbursementVoucher,
    transferReference,
    setTransferReference,
    receiptRef,
    setReceiptRef,
    receiptAttachmentId,
    receiptFileName,
    uploadingReceipt,
    rejectReason,
    setRejectReason,
    cancelReason,
    setCancelReason,
    paidAt,
    setPaidAt,
    // Commands.
    toggle,
    selectGroup,
    selectStatement,
    closeDetail,
    createStatement,
    matchInvoice,
    rejectInvoice,
    cancelStatement,
    issueStatement,
    handleReceiptFile,
    closeStatement,
    viewReceipt,
  };
}

export type PartyBillingStatementsWorkflow = ReturnType<
  typeof usePartyBillingStatementsWorkflow
>;
