"use client";

import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Button,
  OperationalToolbarSearch,
  OperationalToolbarSelect,
  PageToolbar,
  SkeletonTableRows,
  StatusPill,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  cn,
  queueTableWrapClassName,
  useToast,
  type StatusPillStyle,
} from "@platform/ui-kit";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import {
  type InspectorFeeAction,
  type InspectorFeeRowDto,
} from "@platform/api-client";
import { runInspectorFeeTransition } from "@platform/app-shared/prototype/inspector-fees-api";
import { FeeActionReasonModal } from "@platform/app-shared/fees/FeeActionReasonModal";
import { fmtMax } from "@platform/app-shared/format/number";
import { PROPERTY_IDENTIFIER_COLUMN_LABEL } from "../../lib/prototype/po-intake-data";

/** Case Study.html `FEE_ST` mapping for engineering office billing. */
type EngFeeUiStatus =
  | "pending_office"
  | "dispute"
  | "ready"
  | "carried"
  | "listed"
  | "paid"
  | "other";

function fmtSar(n: number): string {
  return `${fmtMax(n || 0, 3)} ر.س`;
}

function formatAcceptDate(row: InspectorFeeRowDto): string {
  const raw =
    row.accruedAtUtc?.trim() ||
    row.workSubmittedAtUtc?.trim() ||
    row.updatedAtUtc?.trim() ||
    "";
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

export function engFeeUiStatus(row: InspectorFeeRowDto): EngFeeUiStatus {
  switch (row.billingStatus) {
    case "office-review":
      return "pending_office";
    case "disputed":
      return "dispute";
    case "deferred":
      return "carried";
    case "at-finance":
    case "disb-req":
      return "ready";
    case "in-statement":
      return "listed";
    case "disbursed":
      return "paid";
    default:
      return "other";
  }
}

function engFeeStatusMeta(st: EngFeeUiStatus): {
  label: string;
  style: StatusPillStyle;
} {
  if (st === "pending_office") {
    return {
      label: "بانتظار إفادتكم",
      style: { base: "#d9a441", fg: "#8a5e14" },
    };
  }
  if (st === "dispute") {
    return {
      label: "تحفّظ على التسعير",
      style: { base: "#d9694f", fg: "#a5432e" },
    };
  }
  if (st === "carried") {
    return {
      label: "مرحَّل — متأخر عن دورته",
      style: { base: "#8a5e14", fg: "#8a5e14" },
    };
  }
  if (st === "ready") {
    return {
      label: "جاهز للفوترة",
      style: { base: "var(--ink)", fg: "var(--ink)" },
    };
  }
  if (st === "listed") {
    return {
      label: "مدرج في كشف",
      style: { base: "#d9a441", fg: "#8a5e14" },
    };
  }
  if (st === "paid") {
    return {
      label: "مفوترة / مدفوعة",
      style: { base: "#3f8f5f", fg: "#2f7a4d" },
    };
  }
  return {
    label: "—",
    style: { base: "#6b7c8f", fg: "#4a5568" },
  };
}

/** Tooltip explaining why a status is what it is — only where it adds context. */
function engFeeStatusTitle(
  st: EngFeeUiStatus,
  row: InspectorFeeRowDto,
): string | undefined {
  if (st === "carried") {
    return "لم يُدرج في كشف سابق بقرار المحاسب — يدخل تلقائياً في كشف الشهر الجاري";
  }
  if (st === "dispute") {
    const reason = row.lastTransitionReason?.trim();
    return reason
      ? `تحفّظكم: ${reason} — قيد المعالجة مع المشرف`
      : "قيد المعالجة مع المشرف";
  }
  if (st === "ready" && !(row.supervisorDiscountSar > 0)) {
    return "تلقائياً — لا تلزم موافقة";
  }
  if (st === "paid") {
    return "موثَّق برقم الفاتورة وإيصال التحويل";
  }
  return undefined;
}

export type EngOfficeFeesTab = "action" | "ready";

export function EngOfficeFeesBillingTable({
  rows,
  tab,
  pending = false,
  onChanged,
}: {
  rows: InspectorFeeRowDto[];
  tab: EngOfficeFeesTab;
  pending?: boolean;
  onChanged?: () => void;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [disputeRow, setDisputeRow] = useState<InspectorFeeRowDto | null>(null);

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: [...prototypeKeys.all, "inspector-fees"],
    });
    onChanged?.();
  }, [onChanged, queryClient]);

  const scoped = useMemo(() => {
    return rows.filter((row) => {
      const st = engFeeUiStatus(row);
      if (tab === "action") {
        return st === "pending_office" || st === "dispute";
      }
      return st === "ready" || st === "carried";
    });
  }, [rows, tab]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scoped.filter((row) => {
      const st = engFeeUiStatus(row);
      if (statusFilter && st !== statusFilter) return false;
      if (!q) return true;
      const hay = [row.propertyLabel, row.poNumber, row.discountReason ?? ""]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [scoped, search, statusFilter]);

  const act = async (
    row: InspectorFeeRowDto,
    action: InspectorFeeAction,
    extra?: { reason?: string },
  ) => {
    setBusyId(row.workflowTaskId);
    try {
      const result = await runInspectorFeeTransition(row.workflowTaskId, {
        action,
        reason: extra?.reason,
      });
      if (result.ok) {
        await invalidate();
        return;
      }
      showToast(result.error || "تعذّر تنفيذ الإجراء — حاول مرة أخرى", "error");
    } finally {
      setBusyId(null);
    }
  };

  const statusOptions =
    tab === "action"
      ? [
          { value: "pending_office", label: "بانتظار إفادتكم" },
          { value: "dispute", label: "تحفّظ على التسعير" },
        ]
      : [
          { value: "ready", label: "جاهز للفوترة" },
          { value: "carried", label: "مرحَّل — متأخر" },
        ];

  return (
    <div className="flex flex-col gap-0">
      <PageToolbar className="shrink-0 flex-wrap items-center justify-between gap-2.5 border-b border-border bg-surface-2 max-lg:mb-0">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5">
          <OperationalToolbarSearch
            type="search"
            placeholder="رقم الصك أو المدينة أو الحي…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="بحث الأتعاب"
          />
          <OperationalToolbarSelect
            className="shrink-0"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="تصفية الحالة"
          >
            <option value="">جميع الحالات</option>
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </OperationalToolbarSelect>
          <span className="ms-auto shrink-0 rounded-full bg-gold-soft px-3 py-[5px] text-[12px] font-bold text-gold-d">
            {filtered.length} بند
          </span>
        </div>
      </PageToolbar>

      <div
        className={cn(
          queueTableWrapClassName,
          "hidden rounded-b-[var(--radius-lg)] border border-t-0 border-border bg-surface lg:block",
        )}
      >
        <Table className="w-full min-w-[920px]" pending={pending}>
          <THead>
            <Tr hoverable={false}>
              <Th>{PROPERTY_IDENTIFIER_COLUMN_LABEL}</Th>
              <Th>تاريخ القبول</Th>
              <Th>سعر الجدول</Th>
              <Th>تعديل التسعير ومبرره</Th>
              <Th>الصافي</Th>
              <Th>الحالة</Th>
              <Th>إجراء المكتب</Th>
            </Tr>
          </THead>
          <TBody>
            {pending && filtered.length === 0 ? (
              <SkeletonTableRows rows={5} cols={7} />
            ) : filtered.length === 0 ? (
              <Tr hoverable={false}>
                <Td
                  colSpan={7}
                  className="!py-5 text-center text-[13px] text-text-3"
                >
                  لا توجد بنود مطابقة.
                </Td>
              </Tr>
            ) : (
              filtered.map((row) => {
                const st = engFeeUiStatus(row);
                const meta = engFeeStatusMeta(st);
                const busy = busyId === row.workflowTaskId;
                const ded = row.supervisorDiscountSar > 0;
                return (
                  <Tr key={row.workflowTaskId} hoverable={false}>
                    <Td>
                      <span className="inline-flex flex-col gap-0.5">
                        <span
                          dir="ltr"
                          className="text-end text-[13px] font-bold text-gold-d"
                        >
                          {row.propertyLabel}
                        </span>
                        <span className="text-[11px] text-text-3">
                          {row.poNumber}
                        </span>
                      </span>
                    </Td>
                    <Td dir="ltr" className="text-[12px] text-text-2">
                      {formatAcceptDate(row)}
                    </Td>
                    <Td className="text-[12.5px] text-text-2">
                      {fmtSar(row.agreedFeeSar)}
                    </Td>
                    <Td>
                      {ded ? (
                        <span
                          className="inline-flex min-w-0 items-center gap-1.5"
                          title={row.discountReason ?? undefined}
                        >
                          <span className="shrink-0 text-[12.5px] font-bold text-[#a5432e]">
                            − {fmtSar(row.supervisorDiscountSar)}
                          </span>
                          <span className="truncate text-[10.5px] text-text-3">
                            {row.discountReason || ""}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-text-3">
                          بسعر الجدول
                        </span>
                      )}
                    </Td>
                    <Td className="text-[13px] font-bold text-heading">
                      {fmtSar(row.netFeeSar)}
                    </Td>
                    <Td>
                      <span title={engFeeStatusTitle(st, row)}>
                        <StatusPill label={meta.label} style={meta.style} />
                      </span>
                    </Td>
                    <Td>
                      {st === "pending_office" ? (
                        <div className="flex w-full flex-col gap-1.5">
                          <div className="flex gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="primary"
                              loading={busy}
                              disabled={!row.canOfficeApproveDiscount}
                              showActionToast={false}
                              className="whitespace-nowrap px-[11px] py-1 text-[11px]"
                              onClick={() =>
                                void act(row, "office-approve-discount")
                              }
                            >
                              قبول
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy || !row.canOfficeDispute}
                              showActionToast={false}
                              className="whitespace-nowrap border-[color-mix(in_srgb,#d9694f_40%,transparent)] bg-surface px-[11px] py-1 text-[11px] font-bold text-[#a5432e]"
                              onClick={() => setDisputeRow(row)}
                            >
                              تحفّظ
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-text-3">
                          {st === "dispute"
                            ? "قيد المعالجة"
                            : "لا إجراء مطلوب"}
                        </span>
                      )}
                    </Td>
                  </Tr>
                );
              })
            )}
          </TBody>
        </Table>
      </div>

      <div className="lg:hidden">
        {pending && filtered.length === 0 ? (
          <div className="space-y-2.5 py-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-[100px] animate-pulse rounded-[14px] border border-border bg-surface-2"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="m-0 py-4 text-center text-[13px] text-text-3">
            لا توجد بنود مطابقة.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {filtered.map((row) => {
              const st = engFeeUiStatus(row);
              const meta = engFeeStatusMeta(st);
              const busy = busyId === row.workflowTaskId;
              const ded = row.supervisorDiscountSar > 0;
              return (
                <li
                  key={`m-eng-${row.workflowTaskId}`}
                  className="rounded-[14px] border border-border border-s-[3px] border-s-gold bg-surface px-3.5 py-3.5 shadow-[0_2px_8px_rgba(15,52,96,0.06)]"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div
                        dir="ltr"
                        className="text-[14px] font-bold text-heading"
                      >
                        {row.propertyLabel}
                      </div>
                      <div className="mt-1 text-[11px] text-text-3" dir="ltr">
                        {row.poNumber}
                      </div>
                      <div className="mt-1 text-[11px] text-text-3">
                        قبول: {formatAcceptDate(row)}
                      </div>
                    </div>
                    <div className="shrink-0 text-end">
                      <div className="text-[14px] font-bold text-gold-d">
                        {fmtSar(row.netFeeSar)}
                      </div>
                      {ded ? (
                        <div className="mt-0.5 text-[10px] text-text-3">
                          حسم {fmtSar(row.supervisorDiscountSar)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="mb-2.5">
                    <StatusPill label={meta.label} style={meta.style} />
                  </div>
                  {st === "pending_office" ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        loading={busy}
                        disabled={!row.canOfficeApproveDiscount}
                        showActionToast={false}
                        onClick={() =>
                          void act(row, "office-approve-discount")
                        }
                      >
                        قبول
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy || !row.canOfficeDispute}
                        showActionToast={false}
                        onClick={() => setDisputeRow(row)}
                      >
                        تحفّظ
                      </Button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-text-3">
                      {st === "dispute" ? "قيد المعالجة" : "لا إجراء مطلوب"}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <FeeActionReasonModal
        open={disputeRow !== null}
        title="تحفّظ على التسعير"
        label="مبررات التحفّظ (إلزامي)"
        confirmLabel="إرسال التحفّظ"
        onClose={() => setDisputeRow(null)}
        onConfirm={async (reason) => {
          if (!disputeRow) return;
          await act(disputeRow, "office-dispute", { reason });
          setDisputeRow(null);
        }}
      />
    </div>
  );
}
