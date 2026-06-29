"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import {
  loadPoEnfazBilling,
  loadReadyEnfazPoSummaries,
  savePoEnfazBillingData,
  issueEnfazInvoice,
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
} from "@platform/design-system";
import {
  inspectorFeeWorkStatusTone,
  type PoEnfazRevenueLineDto,
} from "@platform/api-client";

export function FinanceEnfazPoBilling() {
  const queryClient = useQueryClient();
  const [selectedPo, setSelectedPo] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, { fee: string; inc: boolean }>>(
    {},
  );
  const [busy, setBusy] = useState(false);

  const { data: readySummaries = [] } = useQuery({
    queryKey: [...prototypeKeys.all, "enfaz-billing", "ready-summary"],
    queryFn: loadReadyEnfazPoSummaries,
  });

  const readyPos = readySummaries.map((s) => s.poNumber);

  useEffect(() => {
    if (!selectedPo && readyPos.length > 0) setSelectedPo(readyPos[0]);
  }, [readyPos, selectedPo]);

  const { data: billing, isPending } = useQuery({
    queryKey: [...prototypeKeys.all, "enfaz-billing", selectedPo],
    queryFn: () => loadPoEnfazBilling(selectedPo!),
    enabled: Boolean(selectedPo),
  });

  useEffect(() => {
    if (!billing) return;
    const next: Record<string, { fee: string; inc: boolean }> = {};
    for (const line of billing.lines) {
      next[line.propertyId] = {
        fee: String(line.enfazFeeSar || ""),
        inc: line.includedInBilling,
      };
    }
    setDraft(next);
  }, [billing]);

  const totals = useMemo(() => {
    if (!billing) return { sub: 0, vat: 0, total: 0, billable: 0 };
    let sub = 0;
    let billable = 0;
    for (const line of billing.lines) {
      const d = draft[line.propertyId];
      if (!d?.inc || line.workStatus !== "done") continue;
      billable += 1;
      sub += Number(d.fee) || 0;
    }
    const vat = Math.round(sub * 0.15);
    return { sub, vat, total: sub + vat, billable };
  }, [billing, draft]);

  const save = async () => {
    if (!selectedPo || !billing) return;
    setBusy(true);
    try {
      await savePoEnfazBillingData(selectedPo, {
        lines: billing.lines.map((line) => ({
          propertyId: line.propertyId,
          enfazFeeSar: Number(draft[line.propertyId]?.fee) || 0,
          includedInBilling: draft[line.propertyId]?.inc ?? true,
        })),
      });
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
      await issueEnfazInvoice(selectedPo);
      await queryClient.invalidateQueries({
        queryKey: [...prototypeKeys.all, "enfaz-billing"],
      });
    } finally {
      setBusy(false);
    }
  };

  const lineRow = (line: PoEnfazRevenueLineDto) => {
    const cancelled = line.workStatus === "cancelled";
    const d = draft[line.propertyId];
    return (
      <Tr key={line.propertyId} hoverable={false} className={cancelled ? "opacity-50" : ""}>
        <Td className="font-medium">{line.propertyLabel}</Td>
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
              className="h-8 w-28 text-xs"
              value={d?.fee ?? ""}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  [line.propertyId]: {
                    fee: e.target.value,
                    inc: prev[line.propertyId]?.inc ?? true,
                  },
                }))
              }
            />
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
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  [line.propertyId]: {
                    fee: prev[line.propertyId]?.fee ?? "",
                    inc: e.target.checked,
                  },
                }))
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
        hint="يظهر PO هنا بعد اكتمال كل معاملاته (مكتملة أو ملغاة)."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <PageToolbar className="border-0 bg-surface-2/60">
        <Note tone="info" className="m-0 flex-1">
          المسار: اختر PO ← عبّئ أتعاب المكتملة ← احفظ ← أصدر الفاتورة. الإيراد
          يظهر في التقارير وهامش المعاملة.
        </Note>
      </PageToolbar>

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
                  <Badge tone="success">مُفوتَر · {billing.invoiceNumber}</Badge>
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
                      <Th>أتعاب إنفاذ (ر.س)</Th>
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
                    {totals.sub.toLocaleString("ar-SA")} ر.س
                  </span>
                </div>
                <div className="flex justify-between py-1 text-text-2">
                  <span>ضريبة 15%</span>
                  <span className="tabular-nums">
                    {totals.vat.toLocaleString("ar-SA")} ر.س
                  </span>
                </div>
                <div className="mt-1 flex justify-between border-t border-border pt-2 font-semibold">
                  <span>الإجمالي</span>
                  <span className="tabular-nums">
                    {totals.total.toLocaleString("ar-SA")} ر.س
                  </span>
                </div>
              </div>

              <div
                className={cn(
                  pageToolbarClassName,
                  "rounded-[var(--radius-lg)] border border-border bg-surface",
                )}
              >
                <span className="text-xs text-text-2">
                  {billing.invoiceNumber
                    ? "تم إصدار الفاتورة — يمكنك تعديل الأتعاب وحفظها فقط."
                    : totals.sub <= 0
                      ? "عبّئ أتعاب عقار واحد على الأقل قبل الإصدار."
                      : "احفظ ثم أصدر الفاتورة."}
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy || Boolean(billing.invoiceNumber)}
                    onClick={() => void save()}
                  >
                    حفظ الأتعاب
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    disabled={
                      busy ||
                      !billing.poReadyForBilling ||
                      totals.sub <= 0 ||
                      Boolean(billing.invoiceNumber)
                    }
                    onClick={() => void issueInvoice()}
                  >
                    إصدار الفاتورة
                  </Button>
                </div>
              </div>

              <QueueTableHint className="px-0">
                المعاملات الملغاة لا تُفوتر. بعد الإصدار يظهر الإيراد في تبويب
                «التقارير» وفي مالية كل عقار.
              </QueueTableHint>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
