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
  useToast,
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
  const { showToast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<SortKey>("date");
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...rows];
    if (sort === "fee") copy.sort((a, b) => b.netFeeSar - a.netFeeSar);
    else if (sort === "idate") {
      copy.sort((a, b) =>
        (b.poReceivedAtUtc ?? "").localeCompare(a.poReceivedAtUtc ?? ""),
      );
    } else {
      copy.sort((a, b) =>
        (b.workSubmittedAtUtc ?? b.updatedAtUtc ?? "").localeCompare(
          a.workSubmittedAtUtc ?? a.updatedAtUtc ?? "",
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
      if (result.ok) {
        if (result.data.rows.length > 0) {
          pushNotification({
            title: "أُنشئ أمر صرف",
            body: `اعتُمد ${result.data.rows.length} عقار — بانتظار صرف المالية.`,
            tone: "success",
            category: "financial",
            href: "/party-fees",
            sourceEvent: "party-disbursement-created",
          });
        }
        if (result.data.failed.length > 0) {
          pushNotification({
            title: "تعذر تضمين بعض العقارات",
            body: result.data.failed.map((f) => f.error).join(" · "),
            tone: "warn",
            category: "financial",
            href: "/party-fees",
            sourceEvent: "party-disbursement-failed",
          });
        }
        setSelected(new Set());
        await queryClient.invalidateQueries({
          queryKey: [...prototypeKeys.all, "inspector-fees"],
        });
        return;
      }
      showToast(
        result.error ?? "تعذّر إنشاء أمر الصرف — حاول مرة أخرى",
        "error",
      );
      await queryClient.invalidateQueries({
        queryKey: [...prototypeKeys.all, "inspector-fees"],
      });
    } finally {
      setBusy(false);
    }
  };

  if (rows.length === 0) {
    return (
      <EmptyState
        line="لا عقارات جاهزة لإنشاء أمر صرف."
        hint="تظهر هنا بعد اعتماد المشرف (حالة «جاهز للصرف لدى المالية»). الأتعاب نفسها تظهر بعد اكتمال دراسة الحالة للصك."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-text-3">
        اختر من عقاراتك الجاهزة لدى المالية، اجمعها في أمر صرف واحد — ثم تصرفه
        الإدارة المالية.
      </p>
      <div className={cn(pageToolbarClassName, "rounded-[var(--radius-lg)] max-lg:flex-col max-lg:items-stretch")}>
        <label className="flex items-center gap-2 text-xs text-text-2 max-lg:w-full">
          الترتيب
          <select
            className="min-h-11 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-xs sm:min-h-0 sm:flex-none"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="date">تاريخ الإنجاز</option>
            <option value="idate">تاريخ الصدور</option>
            <option value="fee">المبلغ (الأعلى)</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-text-2 max-lg:w-full">
          سقف الميزانية
          <Input
            type="number"
            className="h-11 w-full text-xs sm:h-8 sm:w-28"
            placeholder="بدون سقف"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
        </label>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="max-lg:min-h-11"
          onClick={autoBudget}
        >
          تحديد تلقائي حتى السقف
        </Button>
      </div>

      <div className={cn(queueTableWrapClassName, "hidden lg:block")}>
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
                <Td className="text-text-2">
                  {formatFeeDate(row.workSubmittedAtUtc ?? row.updatedAtUtc)}
                </Td>
                <Td className="text-text-2">
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

      <ul className="m-0 flex list-none flex-col gap-2.5 p-0 lg:hidden">
        {sorted.map((row) => {
          const checked = selected.has(row.workflowTaskId);
          return (
            <li key={`m-${row.workflowTaskId}`}>
              <label
                className={cn(
                  "flex cursor-pointer gap-3 rounded-[12px] border bg-surface px-3.5 py-3 shadow-card transition-colors",
                  checked
                    ? "border-gold bg-[color-mix(in_srgb,var(--gold)_8%,var(--surface))]"
                    : "border-border",
                )}
              >
                <input
                  type="checkbox"
                  className="mt-1 h-[18px] w-[18px] shrink-0 accent-[var(--gold-d)]"
                  checked={checked}
                  onChange={(e) =>
                    toggle(row.workflowTaskId, e.target.checked)
                  }
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-bold text-heading">
                    {row.propertyLabel}
                  </div>
                  <div className="mt-1">
                    <PoNumber value={row.poNumber} link />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
                    <div>
                      <div className="text-[10.5px] text-text-3">الإنجاز</div>
                      <div className="font-semibold text-text-2">
                        {formatFeeDate(
                          row.workSubmittedAtUtc ?? row.updatedAtUtc,
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10.5px] text-text-3">الصدور</div>
                      <div className="font-semibold text-text-2">
                        {formatFeeDate(row.poReceivedAtUtc)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-end text-[14px] font-extrabold tabular-nums text-heading">
                    {row.netFeeSar.toLocaleString("ar-SA")} ر.س
                  </div>
                </div>
              </label>
            </li>
          );
        })}
      </ul>

      <div
        className={cn(
          pageToolbarClassName,
          "rounded-[var(--radius-lg)] max-lg:sticky max-lg:bottom-0 max-lg:z-20 max-lg:border max-lg:border-border max-lg:bg-surface/95 max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))] max-lg:backdrop-blur-sm",
        )}
      >
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
          className="max-lg:min-h-11 max-lg:w-full"
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