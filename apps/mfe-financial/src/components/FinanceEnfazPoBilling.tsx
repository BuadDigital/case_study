"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import {
  loadPoEnfazBillingForQuery,
  loadReadyEnfazPoSummaries,
  savePoEnfazBillingData,
  issueEnfazInvoice,
  collectEnfazInvoice,
  downloadEnfazInvoicePdf,
  openEnfazAttachment,
} from "@platform/app-shared/prototype/enfaz-billing-api";
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
  pageToolbarClassName,
  queueTableWrapClassName,
  useToast,
} from "@platform/design-system";
import {
  inspectorFeeWorkStatusTone,
  type PoEnfazRevenueLineDto,
} from "@platform/api-client";

type LineDraft = {
  caseStudyFee: string;
  surveyFee: string;
  keyFee: string;
  inc: boolean;
};

function lineTotal(d: LineDraft | undefined): number {
  if (!d) return 0;
  return (
    (Number(d.caseStudyFee) || 0) +
    (Number(d.surveyFee) || 0) +
    (Number(d.keyFee) || 0)
  );
}

function invoiceStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "collected":
      return "محصّلة";
    case "partially_collected":
      return "تحصيل جزئي";
    case "issued":
      return "صادرة";
    default:
      return "مُفوتَرة";
  }
}

function invoiceStatusTone(
  status: string | null | undefined,
  overdue: boolean,
): "success" | "warning" | "danger" | "info" {
  if (overdue) return "danger";
  if (status === "collected") return "success";
  if (status === "partially_collected") return "warning";
  return "info";
}

export function FinanceEnfazPoBilling() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [selectedPo, setSelectedPo] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, LineDraft>>({});
  const [collectAmount, setCollectAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: readySummaries = [] } = useQuery({
    queryKey: [...prototypeKeys.all, "enfaz-billing", "ready-summary"],
    queryFn: loadReadyEnfazPoSummaries,
  });

  const readyPos = readySummaries.map((s) => s.poNumber);

  useEffect(() => {
    if (!selectedPo && readyPos.length > 0) setSelectedPo(readyPos[0]);
  }, [readyPos, selectedPo]);

  const { data: billing, isPending, isError, error, refetch } = useQuery({
    queryKey: [...prototypeKeys.all, "enfaz-billing", selectedPo],
    queryFn: () => loadPoEnfazBillingForQuery(selectedPo!),
    enabled: Boolean(selectedPo),
  });

  useEffect(() => {
    if (!billing) return;
    const next: Record<string, LineDraft> = {};
    for (const line of billing.lines) {
      next[line.propertyId] = {
        caseStudyFee: String(line.caseStudyFeeSar || ""),
        surveyFee: String(line.surveyFeeSar || ""),
        keyFee: String(line.keyFeeSar || ""),
        inc: line.includedInBilling,
      };
    }
    setDraft(next);
    const remaining = Math.max(
      0,
      (billing.totalSar || 0) - (billing.collectedAmountSar || 0),
    );
    setCollectAmount(remaining > 0 ? String(remaining) : "");
  }, [billing]);

  const totals = useMemo(() => {
    if (!billing) return { sub: 0, vat: 0, total: 0, billable: 0 };
    let sub = 0;
    let billable = 0;
    for (const line of billing.lines) {
      const d = draft[line.propertyId];
      if (!d?.inc || line.workStatus !== "done") continue;
      billable += 1;
      sub += lineTotal(d);
    }
    const vat = Math.round(sub * 0.15);
    return { sub, vat, total: sub + vat, billable };
  }, [billing, draft]);

  const issued = Boolean(billing?.invoiceNumber);
  const fullyCollected = billing?.invoiceStatus === "collected";

  const save = async () => {
    if (!selectedPo || !billing) return;
    setBusy(true);
    try {
      const saved = await savePoEnfazBillingData(selectedPo, {
        lines: billing.lines.map((line) => {
          const d = draft[line.propertyId];
          return {
            propertyId: line.propertyId,
            caseStudyFeeSar: Number(d?.caseStudyFee) || 0,
            surveyFeeSar: Number(d?.surveyFee) || 0,
            keyFeeSar: Number(d?.keyFee) || 0,
            keyEntitlementEnvelopeId: line.keyEntitlementEnvelopeId,
            includedInBilling: d?.inc ?? true,
          };
        }),
      });
      if (!saved) {
        showToast("تعذّر حفظ الأتعاب — حاول مرة أخرى", "error");
        return;
      }
      showToast("تم حفظ الأتعاب", "success");
      await queryClient.invalidateQueries({
        queryKey: [...prototypeKeys.all, "enfaz-billing"],
      });
    } finally {
      setBusy(false);
    }
  };

  const issueInvoice = async () => {
    if (!selectedPo) return;
    setBusy(true);
    try {
      const issuedBilling = await issueEnfazInvoice(selectedPo);
      if (!issuedBilling) {
        showToast("تعذّر إصدار الفاتورة — حاول مرة أخرى", "error");
        return;
      }
      showToast("تم إصدار الفاتورة", "success");
      await queryClient.invalidateQueries({
        queryKey: [...prototypeKeys.all, "enfaz-billing"],
      });
      const downloaded = await downloadEnfazInvoicePdf(selectedPo);
      if (!downloaded) {
        showToast("صدرت الفاتورة لكن تعذّر تنزيل PDF", "info");
      }
    } finally {
      setBusy(false);
    }
  };

  const collect = async () => {
    if (!selectedPo) return;
    const amount = Number(collectAmount);
    if (!(amount > 0)) {
      showToast("أدخل مبلغ تحصيل أكبر من صفر", "error");
      return;
    }
    setBusy(true);
    try {
      const result = await collectEnfazInvoice(selectedPo, {
        amountSar: amount,
      });
      if (!result) {
        showToast("تعذّر تسجيل التحصيل — تحقق من المبلغ", "error");
        return;
      }
      showToast("تم تسجيل التحصيل", "success");
      await queryClient.invalidateQueries({
        queryKey: [...prototypeKeys.all, "enfaz-billing"],
      });
    } finally {
      setBusy(false);
    }
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

  const patchDraft = (propertyId: string, patch: Partial<LineDraft>) => {
    setDraft((prev) => ({
      ...prev,
      [propertyId]: {
        caseStudyFee: prev[propertyId]?.caseStudyFee ?? "",
        surveyFee: prev[propertyId]?.surveyFee ?? "",
        keyFee: prev[propertyId]?.keyFee ?? "",
        inc: prev[propertyId]?.inc ?? true,
        ...patch,
      },
    }));
  };

  const lineRow = (line: PoEnfazRevenueLineDto) => {
    const cancelled = line.workStatus === "cancelled";
    const d = draft[line.propertyId];
    return (
      <Tr key={line.propertyId} hoverable={false} className={cancelled ? "opacity-50" : ""}>
        <Td className="font-medium">
          {line.propertyLabel}
          {line.hasKeyEntitlement ? (
            <span className="ms-1 text-[10px] text-text-3">· مفتاح</span>
          ) : null}
        </Td>
        <Td>
          <Badge tone={inspectorFeeWorkStatusTone(line.workStatus as "done")}>
            {line.workStatusLabel}
          </Badge>
        </Td>
        <Td>
          {cancelled ? (
            <span className="text-text-3">—</span>
          ) : (
            <Input
              type="number"
              min={0}
              className="h-8 w-24 text-xs"
              value={d?.caseStudyFee ?? ""}
              disabled={issued}
              onChange={(e) =>
                patchDraft(line.propertyId, { caseStudyFee: e.target.value })
              }
              aria-label={`دخل دراسة المعاملة ${line.propertyLabel}`}
            />
          )}
        </Td>
        <Td>
          {cancelled ? (
            <span className="text-text-3">—</span>
          ) : (
            <Input
              type="number"
              min={0}
              className="h-8 w-24 text-xs"
              value={d?.surveyFee ?? ""}
              disabled={issued}
              onChange={(e) =>
                patchDraft(line.propertyId, { surveyFee: e.target.value })
              }
              aria-label={`دخل تكاليف الرفع ${line.propertyLabel}`}
            />
          )}
        </Td>
        <Td>
          {cancelled ? (
            <span className="text-text-3">—</span>
          ) : line.hasKeyEntitlement ? (
            <Input
              type="number"
              min={0}
              className="h-8 w-24 text-xs"
              value={d?.keyFee ?? ""}
              disabled={issued}
              onChange={(e) =>
                patchDraft(line.propertyId, { keyFee: e.target.value })
              }
              aria-label={`أتعاب المفاتيح ${line.propertyLabel}`}
            />
          ) : (
            <span className="text-text-3">—</span>
          )}
        </Td>
        <Td className="tabular-nums text-text-2">
          {cancelled ? (
            <span className="text-text-3">—</span>
          ) : (
            `${lineTotal(d).toLocaleString("ar-SA")} ر.س`
          )}
        </Td>
        <Td>
          {cancelled ? (
            <span className="text-text-3">—</span>
          ) : (
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={d?.inc ?? true}
              disabled={issued}
              onChange={(e) =>
                patchDraft(line.propertyId, { inc: e.target.checked })
              }
              aria-label={`تضمين ${line.propertyLabel}`}
            />
          )}
        </Td>
      </Tr>
    );
  };

  if (readyPos.length === 0) {
    return (
      <EmptyState
        line="لا أوامر عمل جاهزة للفوترة."
        hint="يظهر PO هنا فقط بعد اكتمال كل معاملاته على كل الصكوك (مكتملة أو ملغاة) — بما فيها التقييم والتنسيق إن وُجدت."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <PageToolbar className="border-0 bg-surface-2/60">
        <Note tone="info" className="m-0 flex-1">
          المسار: اختر PO ← عبّئ دخل الدراسة والرفع (وأتعاب المفاتيح عند
          الاستحقاق) ← احفظ ← أصدر الفاتورة ← سجّل التحصيل.
        </Note>
      </PageToolbar>

      {isError ? (
        <Note tone="warn">
          {error instanceof Error
            ? error.message
            : "تعذّر تحميل بيانات الفوترة — حاول مرة أخرى"}
          <div className="mt-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>
              إعادة المحاولة
            </Button>
          </div>
        </Note>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(220px,0.9fr)_1.6fr]">
        <div className="rounded-[var(--radius-lg)] border border-border bg-surface">
          <div className="border-b border-border px-3 py-2.5 text-[12px] font-semibold text-text">
            أوامر العمل الجاهزة
            <Badge tone="warning" className="ms-2 text-[10px]">
              {readySummaries.length}
            </Badge>
          </div>
          {readySummaries.map((summary) => (
            <button
              key={summary.poNumber}
              type="button"
              className={cn(
                "flex w-full items-center justify-between border-t border-border px-3 py-2.5 text-start text-sm transition-colors hover:bg-surface-2",
                selectedPo === summary.poNumber &&
                  "border-s-2 border-s-primary bg-primary/5 font-semibold",
              )}
              onClick={() => setSelectedPo(summary.poNumber)}
            >
              <span>{summary.poNumber}</span>
              <span className="text-[11px] text-text-3">
                {summary.doneCount} مكتملة
                {summary.cancelledCount > 0
                  ? ` · ${summary.cancelledCount} ملغاة`
                  : ""}
              </span>
            </button>
          ))}
        </div>

        <div className="min-w-0">
          {!selectedPo || isPending ? (
            <EmptyState line="اختر أمر عمل من القائمة." />
          ) : !billing ? (
            <EmptyState line="تعذر تحميل بيانات الفوترة." />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-[13px] font-semibold text-text">
                  {selectedPo}
                </h3>
                {billing.invoiceNumber ? (
                  <Badge
                    tone={invoiceStatusTone(
                      billing.invoiceStatus,
                      billing.isOverdue,
                    )}
                  >
                    {invoiceStatusLabel(billing.invoiceStatus)}
                    {billing.isOverdue ? " · متأخر" : ""} ·{" "}
                    {billing.invoiceNumber}
                  </Badge>
                ) : billing.poReadyForBilling ? (
                  <Badge tone="info">جاهز للإصدار</Badge>
                ) : (
                  <Badge tone="warning">يحتاج حفظ</Badge>
                )}
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
                      <Th>المعاملة</Th>
                      <Th>الحالة</Th>
                      <Th>دخل الدراسة</Th>
                      <Th>دخل الرفع</Th>
                      <Th>مفاتيح</Th>
                      <Th>المجموع</Th>
                      <Th>مشمول</Th>
                    </Tr>
                  </THead>
                  <TBody>{billing.lines.map(lineRow)}</TBody>
                </Table>
              </div>

              <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4 text-sm">
                <div className="mb-2 text-[11px] text-text-3">
                  {totals.billable} عقار مشمول في الفاتورة
                </div>
                <div className="flex justify-between py-1 text-text-2">
                  <span>المجموع قبل الضريبة</span>
                  <span className="tabular-nums">
                    {(issued ? billing.subtotalSar : totals.sub).toLocaleString(
                      "ar-SA",
                    )}{" "}
                    ر.س
                  </span>
                </div>
                <div className="flex justify-between py-1 text-text-2">
                  <span>ضريبة 15%</span>
                  <span className="tabular-nums">
                    {(issued ? billing.vatSar : totals.vat).toLocaleString(
                      "ar-SA",
                    )}{" "}
                    ر.س
                  </span>
                </div>
                <div className="mt-1 flex justify-between border-t border-border pt-2 font-semibold">
                  <span>الإجمالي</span>
                  <span className="tabular-nums">
                    {(issued ? billing.totalSar : totals.total).toLocaleString(
                      "ar-SA",
                    )}{" "}
                    ر.س
                  </span>
                </div>
                {issued ? (
                  <div className="mt-2 flex justify-between border-t border-border pt-2 text-text-2">
                    <span>المحصّل</span>
                    <span className="tabular-nums">
                      {billing.collectedAmountSar.toLocaleString("ar-SA")} ر.س
                    </span>
                  </div>
                ) : null}
                {billing.attachmentIds.length > 0 ? (
                  <div className="mt-3 border-t border-border pt-3">
                    <div className="mb-2 text-[11px] text-text-3">
                      مرفقات ظروف المفاتيح (عرض فقط)
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {billing.attachmentIds.map((id, index) => (
                        <Button
                          key={id}
                          type="button"
                          size="sm"
                          variant="outline"
                          showActionToast={false}
                          onClick={() => {
                            void openEnfazAttachment(
                              id,
                              `مرفق-مفتاح-${index + 1}`,
                            ).then((result) => {
                              if (!result.ok) {
                                showToast(result.error, "error");
                              }
                            });
                          }}
                        >
                          مرفق {index + 1}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div
                className={cn(
                  pageToolbarClassName,
                  "rounded-[var(--radius-lg)] border border-border bg-surface",
                )}
              >
                <span className="text-xs text-text-2">
                  {fullyCollected
                    ? "الفاتورة محصّلة بالكامل."
                    : issued
                      ? "سجّل مبلغ التحصيل (جزئي أو كامل)."
                      : totals.sub <= 0
                        ? "عبّئ أتعاب عقار واحد على الأقل قبل الإصدار."
                        : "احفظ ثم أصدر الفاتورة."}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {!issued ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        loading={busy}
                        showActionToast={false}
                        onClick={() => void save()}
                      >
                        حفظ الأتعاب
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        loading={busy}
                        disabled={
                          !billing.poReadyForBilling || totals.sub <= 0
                        }
                        showActionToast={false}
                        onClick={() => void issueInvoice()}
                      >
                        إصدار الفاتورة
                      </Button>
                    </>
                  ) : (
                    <>
                      {!fullyCollected ? (
                        <>
                          <Input
                            type="number"
                            min={0}
                            className="h-8 w-28 text-xs"
                            value={collectAmount}
                            onChange={(e) => setCollectAmount(e.target.value)}
                            aria-label="مبلغ التحصيل"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            loading={busy}
                            showActionToast={false}
                            onClick={() => void collect()}
                          >
                            تسجيل تحصيل
                          </Button>
                        </>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        loading={busy}
                        showActionToast={false}
                        onClick={() => void downloadPdf()}
                      >
                        تحميل PDF
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <QueueTableHint className="px-0">
                المعاملات الملغاة لا تُفوتر. أتعاب المفاتيح اختيارية عند وجود
                استحقاق ظرف. الإيراد المحصّل يظهر في التقارير.
              </QueueTableHint>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
