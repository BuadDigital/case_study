"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { pushNotification } from "@platform/app-shared";
import {
  Button,
  EmptyState,
  Input,
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
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import type { InspectorFeeRowDto } from "@platform/api-client";
import { runCreateDisbursementBatch } from "@platform/app-shared/prototype/inspector-fees-api";
import { formatFeeDate } from "@platform/app-shared/fees/party-fee-meta";
import { PoNumber } from "../ui/PoNumber";

type SortKey = "date" | "idate" | "fee";

export function PartyDisbursementRequest({
  rows,
}: {
  rows: InspectorFeeRowDto[];
}) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortKey>("date");
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...rows];
    if (sort === "fee") copy.sort((a, b) => b.netFeeSar - a.netFeeSar);
    else if (sort === "idate") {
      copy.sort((a, b) =>
        (a.poReceivedAtUtc ?? "").localeCompare(b.poReceivedAtUtc ?? ""),
      );
    } else {
      copy.sort((a, b) =>
        (a.workSubmittedAtUtc ?? a.updatedAtUtc ?? "").localeCompare(
          b.workSubmittedAtUtc ?? b.updatedAtUtc ?? "",
        ),
      );
    }
    return copy;
  }, [rows, sort]);

  const selectedRows = sorted.filter((r) => selected.has(r.workflowTaskId));
  const selectedTotal = selectedRows.reduce((s, r) => s + r.netFeeSar, 0);
  const budgetNum = Number(budget) || 0;
  const overBudget = budgetNum > 0 && selectedTotal > budgetNum;

  const toggle = (id: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const autoBudget = () => {
    if (!budgetNum) return;
    const next = new Set<string>();
    let total = 0;
    for (const row of sorted) {
      if (total + row.netFeeSar <= budgetNum) {
        next.add(row.workflowTaskId);
        total += row.netFeeSar;
      }
    }
    setSelected(next);
  };

  const submit = async () => {
    if (selected.size === 0 || overBudget) return;
    setBusy(true);
    try {
      const result = await runCreateDisbursementBatch({
        workflowTaskIds: [...selected],
      });
      if (result) {
        if (result.rows.length > 0) {
          pushNotification({
            title: "أُنشئ أمر صرف",
            body: `اعتُمد ${result.rows.length} عقار — بانتظار صرف المالية.`,
            tone: "success",
          });
        }
        if (result.failed.length > 0) {
          pushNotification({
            title: "تعذر تضمين بعض العقارات",
            body: result.failed.map((f) => f.error).join(" · "),
            tone: "warn",
          });
        }
        setSelected(new Set());
      }
      await queryClient.invalidateQueries({
        queryKey: [...prototypeKeys.all, "inspector-fees"],
      });
    } finally {
      setBusy(false);
    }
  };

  if (rows.length === 0) {
    return <EmptyState line="لا عقارات جاهزة للصرف حالياً." />;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-text-3">
        اختر من عقاراتك الجاهزة لدى المالية، اجمعها في أمر صرف واحد — ثم تصرفه
        الإدارة المالية.
      </p>
      <div className={cn(pageToolbarClassName, "rounded-[var(--radius-lg)]")}>
        <label className="flex items-center gap-2 text-xs text-text-2">
          الترتيب
          <select
            className="rounded-md border border-border bg-surface px-2 py-1 text-xs"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="date">تاريخ الإنجاز</option>
            <option value="idate">تاريخ الصدور</option>
            <option value="fee">المبلغ (الأعلى)</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-text-2">
          سقف الميزانية
          <Input
            type="number"
            className="h-8 w-28 text-xs"
            placeholder="بدون سقف"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
        </label>
        <Button type="button" size="sm" variant="ghost" onClick={autoBudget}>
          تحديد تلقائي حتى السقف
        </Button>
      </div>

      <div className={queueTableWrapClassName}>
        <Table>
          <THead>
            <Tr hoverable={false}>
              <Th className="w-10" />
              <Th>المعاملة</Th>
              <Th>أمر العمل</Th>
              <Th>تاريخ الإنجاز</Th>
              <Th>تاريخ الصدور</Th>
              <Th className="text-end">الصافي</Th>
            </Tr>
          </THead>
          <TBody>
            {sorted.map((row) => (
              <Tr key={row.workflowTaskId} hoverable={false}>
                <Td>
                  <input
                    type="checkbox"
                    checked={selected.has(row.workflowTaskId)}
                    onChange={(e) =>
                      toggle(row.workflowTaskId, e.target.checked)
                    }
                  />
                </Td>
                <Td className="font-medium">{row.propertyLabel}</Td>
                <Td>
                  <PoNumber value={row.poNumber} link />
                </Td>
                <Td className="text-[11px] text-text-2">
                  {formatFeeDate(row.workSubmittedAtUtc ?? row.updatedAtUtc)}
                </Td>
                <Td className="text-[11px] text-text-2">
                  {formatFeeDate(row.poReceivedAtUtc)}
                </Td>
                <Td className="text-end tabular-nums">
                  {row.netFeeSar.toLocaleString("ar-SA")} ر.س
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>

      <div className={cn(pageToolbarClassName, "rounded-[var(--radius-lg)]")}>
        <span className="text-xs text-text-2">
          المحدّد: {selectedRows.length} · الإجمالي:{" "}
          <strong className={overBudget ? "text-danger" : "text-text"}>
            {selectedTotal.toLocaleString("ar-SA")} ر.س
          </strong>
          {budgetNum > 0 ? ` / السقف ${budgetNum.toLocaleString("ar-SA")} ر.س` : ""}
        </span>
        <Button
          type="button"
          size="sm"
          variant="primary"
          disabled={busy || selected.size === 0 || overBudget}
          onClick={() => void submit()}
        >
          إنشاء أمر صرف واعتماده
        </Button>
      </div>
      <QueueTableHint>
        بعد الإنشاء تنتقل المعاملات إلى «ضمن أمر صرف» وتظهر لدى المالية للصرف.
      </QueueTableHint>
    </div>
  );
}
