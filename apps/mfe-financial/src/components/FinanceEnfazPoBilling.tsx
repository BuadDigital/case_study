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
  SubpageHeader,
  SubpagePanel,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  cn,
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
    if (!billing) return { sub: 0, vat: 0, total: 0 };
    let sub = 0;
    for (const line of billing.lines) {
      const d = draft[line.propertyId];
      if (!d?.inc || line.workStatus !== "done") continue;
      sub += Number(d.fee) || 0;
    }
    const vat = Math.round(sub * 0.15);
    return { sub, vat, total: sub + vat };
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
            "—"
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
            "—"
          ) : (
            <input
              type="checkbox"
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
            />
          )}
        </Td>
      </Tr>
    );
  };

  return (
    <SubpagePanel>
      <SubpageHeader title="أوامر العمل الواردة (إنفاذ)" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(200px,0.85fr)_1.5fr]">
        <div className="rounded-[var(--radius-lg)] border border-border bg-surface">
          <div className="border-b border-border px-3 py-2 text-[11px] text-text-3">
            أوامر العمل الجاهزة للفوترة
          </div>
          {readyPos.length === 0 ? (
            <p className="p-4 text-xs text-text-3">لا أوامر عمل جاهزة.</p>
          ) : (
            readySummaries.map((summary) => (
              <button
                key={summary.poNumber}
                type="button"
                className={cn(
                  "flex w-full items-center justify-between border-t border-border px-3 py-2.5 text-start text-sm hover:bg-surface-2",
                  selectedPo === summary.poNumber && "bg-primary/5 font-semibold",
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
            ))
          )}
        </div>

        <div>
          {!selectedPo || isPending ? (
            <EmptyState line="اختر أمر عمل لعرض المعاملات." />
          ) : !billing ? (
            <EmptyState line="تعذر تحميل بيانات الفوترة." />
          ) : (
            <>
              <p className="mb-3 text-xs text-text-3">
                المصدر: منصة إنفاذ. الملغاة لا تُفوتر. عند الحفظ يظهر الهامش في
                «مالية المعاملة».
              </p>
              <Table>
                <THead>
                  <Tr hoverable={false}>
                    <Th>المعاملة</Th>
                    <Th>الحالة</Th>
                    <Th>أتعاب إنفاذ</Th>
                    <Th>مشمول</Th>
                  </Tr>
                </THead>
                <TBody>{billing.lines.map(lineRow)}</TBody>
              </Table>
              <div className="mt-3 rounded-[var(--radius-lg)] border border-border bg-surface p-4 text-sm">
                <div className="flex justify-between py-1 text-text-2">
                  <span>المجموع قبل الضريبة</span>
                  <span>{totals.sub.toLocaleString("ar-SA")} ر.س</span>
                </div>
                <div className="flex justify-between py-1 text-text-2">
                  <span>ضريبة 15%</span>
                  <span>{totals.vat.toLocaleString("ar-SA")} ر.س</span>
                </div>
                <div className="mt-1 flex justify-between border-t border-border pt-2 font-semibold">
                  <span>الإجمالي</span>
                  <span>{totals.total.toLocaleString("ar-SA")} ر.س</span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  disabled={busy}
                  onClick={() => void save()}
                >
                  حفظ الأتعاب
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
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
                {billing.invoiceNumber ? (
                  <span className="text-xs text-text-2">
                    {billing.invoiceNumber}
                  </span>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </SubpagePanel>
  );
}
