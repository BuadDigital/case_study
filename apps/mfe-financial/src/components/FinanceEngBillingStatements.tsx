"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import {
  loadEngBillingReadyLines,
  loadEngBillingStatements,
  openEngBillingAttachment,
  runCloseEngBillingStatement,
  runCreateEngBillingStatement,
  runDeferEngBillingLines,
  runIssueEngBillingStatement,
  uploadEngBillingTransferReceipt,
} from "@platform/app-shared/prototype/eng-billing-statements-api";
import { resolvePartyName } from "@platform/app-shared/fees/party-fee-meta";
import { useStaffUsersQuery } from "@settings/mfe/query/settings-queries";
import {
  Badge,
  Button,
  EmptyState,
  Input,
  Note,
  PageToolbar,
  QueueTableHint,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  cn,
  queueTableWrapClassName,
  useToast,
} from "@platform/design-system";
import {
  engBillingStatementStatusTone,
  inspectorFeeStatusTone,
  type EngBillingReadyLineDto,
  type EngBillingStatementDto,
  type InspectorFeeBillingStatus,
} from "@platform/api-client";
import { pushNotification } from "@platform/app-shared";

function formatSar(n: number) {
  return `${n.toLocaleString("ar-SA", { maximumFractionDigits: 2 })} ر.س`;
}

function groupReadyByAssignee(lines: EngBillingReadyLineDto[]) {
  const map = new Map<string, EngBillingReadyLineDto[]>();
  for (const line of lines) {
    const key = line.assigneeId?.trim() || "—";
    const list = map.get(key) ?? [];
    list.push(line);
    map.set(key, list);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "ar"));
}

export function FinanceEngBillingStatements() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { data: staffResult } = useStaffUsersQuery();
  const staffUsers = staffResult?.users ?? [];

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deferUnselected, setDeferUnselected] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selectedStatementId, setSelectedStatementId] = useState<string | null>(
    null,
  );
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [receiptRef, setReceiptRef] = useState("");
  const [receiptAttachmentId, setReceiptAttachmentId] = useState<string | null>(
    null,
  );
  const [receiptFileName, setReceiptFileName] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [paidAt, setPaidAt] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );

  const readyQuery = useQuery({
    queryKey: [...prototypeKeys.all, "eng-billing", "ready-lines"],
    queryFn: () => loadEngBillingReadyLines(),
  });

  const statementsQuery = useQuery({
    queryKey: [...prototypeKeys.all, "eng-billing", "statements"],
    queryFn: () => loadEngBillingStatements(),
  });

  const readyLines = readyQuery.data ?? [];
  const statements = statementsQuery.data ?? [];
  const groups = useMemo(() => groupReadyByAssignee(readyLines), [readyLines]);

  const selectedStatement = useMemo(
    () => statements.find((s) => s.id === selectedStatementId) ?? null,
    [statements, selectedStatementId],
  );

  const selectedTotal = useMemo(() => {
    let total = 0;
    for (const line of readyLines) {
      if (selected.has(line.workflowTaskId)) total += line.netFeeSar;
    }
    return total;
  }, [readyLines, selected]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: [...prototypeKeys.all, "eng-billing"],
      }),
      queryClient.invalidateQueries({
        queryKey: [...prototypeKeys.all, "inspector-fees"],
      }),
    ]);
  };

  const resetCloseForm = () => {
    setInvoiceNumber("");
    setReceiptRef("");
    setReceiptAttachmentId(null);
    setReceiptFileName(null);
    setPaidAt(new Date().toISOString().slice(0, 10));
  };

  const selectStatement = (id: string) => {
    setSelectedStatementId(id);
    resetCloseForm();
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectGroup = (lines: EngBillingReadyLineDto[], on: boolean) => {
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
      showToast("اختر بنوداً لإنشاء كشف الفوترة", "error");
      return;
    }
    setBusy(true);
    try {
      const result = await runCreateEngBillingStatement({
        workflowTaskIds: [...selected],
        deferUnselectedForAssignee: deferUnselected,
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
          ? `أُنشئ الكشف ${result.statement.referenceNumber} ورُحِّل ${result.deferredCount} بند`
          : `أُنشئ الكشف ${result.statement.referenceNumber}`,
        "success",
      );
      await invalidate();
    } finally {
      setBusy(false);
    }
  };

  const deferSelected = async () => {
    if (selected.size === 0) {
      showToast("اختر بنوداً للترحيل", "error");
      return;
    }
    setBusy(true);
    try {
      const result = await runDeferEngBillingLines({
        workflowTaskIds: [...selected],
      });
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      setSelected(new Set());
      showToast(`تم ترحيل ${result.deferredCount} بند`, "success");
      await invalidate();
    } finally {
      setBusy(false);
    }
  };

  const issueStatement = async (statement: EngBillingStatementDto) => {
    setBusy(true);
    try {
      const result = await runIssueEngBillingStatement(statement.id);
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      pushNotification({
        title: "أُرسل كشف الفوترة",
        body: `${result.statement.referenceNumber} مرسل للمكتب والمشرف.`,
        tone: "info",
        category: "financial",
        href: "/financial",
      });
      showToast(`أُرسل الكشف ${result.statement.referenceNumber}`, "success");
      await invalidate();
    } finally {
      setBusy(false);
    }
  };

  const handleReceiptFile = async (
    statement: EngBillingStatementDto,
    file: File | undefined,
  ) => {
    if (!file) return;
    setUploadingReceipt(true);
    setReceiptFileName(file.name);
    try {
      const upload = await uploadEngBillingTransferReceipt(statement.id, file);
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

  const closeStatement = async (statement: EngBillingStatementDto) => {
    if (!invoiceNumber.trim()) {
      showToast("رقم الفاتورة مطلوب", "error");
      return;
    }
    if (!receiptAttachmentId && !receiptRef.trim()) {
      showToast("أرفق إيصال التحويل أو أدخل مرجعه", "error");
      return;
    }
    setBusy(true);
    try {
      const paidAtUtc = paidAt
        ? new Date(`${paidAt}T12:00:00`).toISOString()
        : undefined;
      const result = await runCloseEngBillingStatement(statement.id, {
        externalInvoiceNumber: invoiceNumber.trim(),
        transferReceiptAttachmentId: receiptAttachmentId ?? undefined,
        transferReceiptRef: receiptRef.trim() || undefined,
        paidAtUtc,
      });
      if (!result.ok) {
        showToast(result.error, "error");
        return;
      }
      resetCloseForm();
      showToast(`أُقفل الكشف ${result.statement.referenceNumber}`, "success");
      await invalidate();
    } finally {
      setBusy(false);
    }
  };

  const viewReceipt = async (attachmentId: string) => {
    const result = await openEngBillingAttachment(
      attachmentId,
      "إيصال-التحويل",
    );
    if (!result.ok) showToast(result.error, "error");
  };

  return (
    <div className="flex flex-col gap-5">
      <section>
        <PageToolbar className="mb-3 border-0 bg-primary/5">
          <Note tone="info" className="m-0 flex-1">
            اختر من البنود الجاهزة للفوترة لإنشاء كشف شهري (FN-CS). غير المختار
            يمكن ترحيله تلقائياً للدورة القادمة.
          </Note>
        </PageToolbar>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            disabled={busy || selected.size === 0}
            onClick={() => void createStatement()}
          >
            إنشاء كشف فوترة
            {selected.size > 0
              ? ` (${selected.size} — ${formatSar(selectedTotal)})`
              : ""}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || selected.size === 0}
            onClick={() => void deferSelected()}
          >
            ترحيل المحدد
          </Button>
          <label className="ms-2 flex items-center gap-2 text-[12px] text-text-2">
            <input
              type="checkbox"
              checked={deferUnselected}
              onChange={(e) => setDeferUnselected(e.target.checked)}
            />
            ترحيل غير المختار لنفس المكتب عند الإنشاء
          </label>
        </div>

        {readyQuery.isPending ? (
          <EmptyState line="جاري التحميل…" />
        ) : readyLines.length === 0 ? (
          <EmptyState
            line="لا بنود جاهزة أو مرحَّلة للفوترة."
            hint="تظهر هنا بنود الرفع المساحي بحالة جاهز للفوترة أو جاهز — مرحَّل."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {groups.map(([assigneeId, lines]) => {
              const allSelected = lines.every((l) =>
                selected.has(l.workflowTaskId),
              );
              return (
                <div key={assigneeId}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-[13px] font-semibold text-text">
                      {resolvePartyName(assigneeId, staffUsers)}
                      <span className="ms-2 font-normal text-text-2">
                        ({lines.length} بند —{" "}
                        {formatSar(
                          lines.reduce((s, l) => s + l.netFeeSar, 0),
                        )}
                        )
                      </span>
                    </h3>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => selectGroup(lines, !allSelected)}
                    >
                      {allSelected ? "إلغاء تحديد المكتب" : "تحديد كل المكتب"}
                    </Button>
                  </div>
                  <div
                    className={cn(
                      queueTableWrapClassName,
                      "rounded-[var(--radius-lg)] border border-border bg-surface",
                    )}
                  >
                    <Table>
                      <THead>
                        <Tr hoverable={false}>
                          <Th className="w-10"> </Th>
                          <Th>العقار</Th>
                          <Th>PO</Th>
                          <Th>الصافي</Th>
                          <Th>الحالة</Th>
                        </Tr>
                      </THead>
                      <TBody>
                        {lines.map((line) => (
                          <Tr key={line.workflowTaskId}>
                            <Td>
                              <input
                                type="checkbox"
                                checked={selected.has(line.workflowTaskId)}
                                onChange={() => toggle(line.workflowTaskId)}
                              />
                            </Td>
                            <Td className="font-medium">
                              {line.propertyLabel}
                            </Td>
                            <Td className="text-primary-light">
                              {line.poNumber}
                            </Td>
                            <Td>{formatSar(line.netFeeSar)}</Td>
                            <Td>
                              <Badge
                                tone={inspectorFeeStatusTone(
                                  line.billingStatus as InspectorFeeBillingStatus,
                                )}
                              >
                                {line.billingStatusLabel}
                              </Badge>
                            </Td>
                          </Tr>
                        ))}
                      </TBody>
                    </Table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <QueueTableHint className="mt-3">
          كشف الفوترة مسار المكتب الهندسي فقط — منفصل عن صرف أتعاب المعاينين.
        </QueueTableHint>
      </section>

      <section>
        <h3 className="mb-2 text-[13px] font-semibold text-text">
          كشوف الفوترة
        </h3>
        {statementsQuery.isPending ? (
          <EmptyState line="جاري التحميل…" />
        ) : statements.length === 0 ? (
          <EmptyState line="لا كشوف فوترة بعد." />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div
              className={cn(
                queueTableWrapClassName,
                "rounded-[var(--radius-lg)] border border-border bg-surface",
              )}
            >
              <Table>
                <THead>
                  <Tr hoverable={false}>
                    <Th>المرجع</Th>
                    <Th>المكتب</Th>
                    <Th>الإجمالي</Th>
                    <Th>الحالة</Th>
                  </Tr>
                </THead>
                <TBody>
                  {statements.map((s) => (
                    <Tr
                      key={s.id}
                      className={cn(
                        "cursor-pointer",
                        selectedStatementId === s.id && "bg-primary/5",
                      )}
                      onClick={() => selectStatement(s.id)}
                    >
                      <Td className="font-medium text-primary-light">
                        {s.referenceNumber}
                      </Td>
                      <Td>{resolvePartyName(s.assigneeId, staffUsers)}</Td>
                      <Td>{formatSar(s.totalNetSar)}</Td>
                      <Td>
                        <Badge tone={engBillingStatementStatusTone(s.status)}>
                          {s.statusLabel}
                        </Badge>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>

            <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-3">
              {!selectedStatement ? (
                <EmptyState line="اختر كشفاً لعرض التفاصيل والإجراءات." />
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-[14px] font-semibold">
                        {selectedStatement.referenceNumber}
                      </div>
                      <div className="text-[12px] text-text-2">
                        {resolvePartyName(
                          selectedStatement.assigneeId,
                          staffUsers,
                        )}{" "}
                        — {formatSar(selectedStatement.totalNetSar)} —{" "}
                        {selectedStatement.lines.length} بند
                      </div>
                    </div>
                    <Badge
                      tone={engBillingStatementStatusTone(
                        selectedStatement.status,
                      )}
                    >
                      {selectedStatement.statusLabel}
                    </Badge>
                  </div>

                  <div
                    className={cn(
                      queueTableWrapClassName,
                      "max-h-56 overflow-auto rounded border border-border",
                    )}
                  >
                    <Table>
                      <THead>
                        <Tr hoverable={false}>
                          <Th>العقار</Th>
                          <Th>PO</Th>
                          <Th>الصافي</Th>
                          <Th>الحالة</Th>
                        </Tr>
                      </THead>
                      <TBody>
                        {selectedStatement.lines.map((line) => (
                          <Tr key={line.id} hoverable={false}>
                            <Td>{line.propertyLabel}</Td>
                            <Td>{line.poNumber}</Td>
                            <Td>{formatSar(line.netFeeSar)}</Td>
                            <Td>
                              <Badge
                                tone={inspectorFeeStatusTone(
                                  line.billingStatus as InspectorFeeBillingStatus,
                                )}
                              >
                                {line.billingStatusLabel}
                              </Badge>
                            </Td>
                          </Tr>
                        ))}
                      </TBody>
                    </Table>
                  </div>

                  {selectedStatement.status === "draft" ? (
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() => void issueStatement(selectedStatement)}
                    >
                      إرسال للمكتب
                    </Button>
                  ) : null}

                  {selectedStatement.status === "issued" ? (
                    <div className="flex flex-col gap-2 rounded border border-border bg-bg p-3">
                      <div className="text-[12px] font-semibold text-text">
                        توثيق الصرف (من البرنامج المحاسبي)
                      </div>
                      <label className="text-[12px] text-text-2">
                        رقم الفاتورة *
                        <Input
                          className="mt-1"
                          value={invoiceNumber}
                          onChange={(e) => setInvoiceNumber(e.target.value)}
                          placeholder="رقم الفاتورة الخارجية"
                        />
                      </label>
                      <label className="text-[12px] text-text-2">
                        إيصال التحويل (ملف)
                        <Input
                          className="mt-1"
                          type="file"
                          accept="image/*,application/pdf"
                          disabled={busy || uploadingReceipt}
                          onChange={(e) => {
                            void handleReceiptFile(
                              selectedStatement,
                              e.target.files?.[0],
                            );
                            e.target.value = "";
                          }}
                        />
                      </label>
                      {uploadingReceipt ? (
                        <span className="text-[11px] text-text-3">
                          جاري رفع الإيصال…
                        </span>
                      ) : receiptAttachmentId && receiptFileName ? (
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-2">
                          <span>مرفق: {receiptFileName}</span>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => void viewReceipt(receiptAttachmentId)}
                          >
                            معاينة
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setReceiptAttachmentId(null);
                              setReceiptFileName(null);
                            }}
                          >
                            إزالة
                          </Button>
                        </div>
                      ) : null}
                      <label className="text-[12px] text-text-2">
                        مرجع إيصال التحويل
                        <Input
                          className="mt-1"
                          value={receiptRef}
                          onChange={(e) => setReceiptRef(e.target.value)}
                          placeholder="رقم الإيصال / التحويل (إن لم يُرفع ملف)"
                        />
                      </label>
                      <p className="m-0 text-[11px] text-text-3">
                        يلزم مرفق الإيصال أو المرجع النصي (أحدهما كافٍ).
                      </p>
                      <label className="text-[12px] text-text-2">
                        تاريخ الصرف
                        <Input
                          className="mt-1"
                          type="date"
                          value={paidAt}
                          onChange={(e) => setPaidAt(e.target.value)}
                        />
                      </label>
                      <Button
                        type="button"
                        disabled={busy || uploadingReceipt}
                        onClick={() => void closeStatement(selectedStatement)}
                      >
                        إقفال الكشف كمفُوتر / مدفوع
                      </Button>
                    </div>
                  ) : null}

                  {selectedStatement.status === "closed" ? (
                    <div className="flex flex-col gap-2">
                      <Note tone="success" className="m-0">
                        مصروف — فاتورة {selectedStatement.externalInvoiceNumber}
                        {selectedStatement.transferReceiptRef
                          ? ` — إيصال ${selectedStatement.transferReceiptRef}`
                          : ""}
                        {selectedStatement.paidAtUtc
                          ? ` — ${new Date(selectedStatement.paidAtUtc).toLocaleDateString("ar-SA")}`
                          : ""}
                      </Note>
                      {selectedStatement.transferReceiptAttachmentId ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void viewReceipt(
                              selectedStatement.transferReceiptAttachmentId!,
                            )
                          }
                        >
                          عرض / تنزيل إيصال التحويل
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
