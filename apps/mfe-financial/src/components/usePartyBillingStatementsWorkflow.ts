"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { appDataKeys } from "@platform/app-shared/query/app-data-keys";
import {
  loadPartyBillingReadyLines,
  loadPartyBillingStatements,
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
  duesForAssignee,
  partyBillingSections,
  searchAndSortDues,
  selectedDuesTotal,
  statementsForAssignee,
  statementsForMode,
  type PartyBillingMode,
} from "../lib/party-billing-statements-state";
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
 * Owns the party-billing screen: the two queries, the dues selection, the
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

  const [selected, setSelected] = useState<Set<string>>(new Set());
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

  const readyQuery = useQuery({
    queryKey: [...appDataKeys.all, "party-billing", "ready-lines"],
    queryFn: () => loadPartyBillingReadyLines(),
  });

  const statementsQuery = useQuery({
    queryKey: [...appDataKeys.all, "party-billing", "statements"],
    queryFn: () => loadPartyBillingStatements(),
  });

  const readyLinesAll = readyQuery.data ?? EMPTY_READY_LINES;
  const allStatementsRaw = statementsQuery.data ?? EMPTY_STATEMENTS;

  const readyLines = useMemo(
    () => duesForAssignee(readyLinesAll, assigneeId),
    [readyLinesAll, assigneeId],
  );
  const allStatements = useMemo(
    () => statementsForAssignee(allStatementsRaw, assigneeId),
    [allStatementsRaw, assigneeId],
  );
  const statements = useMemo(
    () => statementsForMode(allStatements, mode),
    [allStatements, mode],
  );
  const filteredDues = useMemo(
    () => searchAndSortDues(readyLines, deferredDuesSearch),
    [readyLines, deferredDuesSearch],
  );
  /** Selectable lines (net > 0) — computed once instead of repeating filter */
  const payableDues = useMemo(
    () => filteredDues.filter((l) => l.netFeeSar > 0),
    [filteredDues],
  );
  const selectedStatement = useMemo(() => {
    const id = focusStatementId ?? selectedStatementId;
    if (!id) return null;
    return (
      allStatements.find((s) => s.id === id) ??
      allStatementsRaw.find((s) => s.id === id) ??
      null
    );
  }, [allStatements, allStatementsRaw, focusStatementId, selectedStatementId]);
  const selectedTotal = useMemo(
    () => selectedDuesTotal(readyLines, selected),
    [readyLines, selected],
  );

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: [...appDataKeys.all, "party-billing"],
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
      allStatementsRaw.find((s) => s.id === id)?.assigneeId?.trim() || assigneeId;
    onFocusStatement?.(id, party);
    resetCloseForm();
  };

  const closeDetail = () => {
    setSelectedStatementId(null);
    onFocusStatement?.(null);
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
      setSelected(new Set());
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
    ...partyBillingSections(mode),
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
