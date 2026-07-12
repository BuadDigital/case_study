"use client";

import { useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Input,
  SkeletonTableRows,
  Table,
  TBody,
  Td,
  Th,
  ThAction,
  THead,
  Tr,
  cn,
  pageToolbarClassName,
  queueTableWrapClassName,
  useToast,
} from "@platform/design-system";
import { prototypeKeys } from "@platform/app-shared/query/prototype-keys";
import {
  inspectorFeeStatusLabel,
  inspectorFeeStatusTone,
  type InspectorFeeBillingStatus,
  type InspectorFeeRowDto,
} from "@platform/api-client";
import { PoNumber } from "../ui/PoNumber";
import {
  runInspectorFeeTransition,
  saveInspectorFeePatch,
} from "@platform/app-shared/prototype/inspector-fees-api";
import { FeeDiscountModal } from "@platform/app-shared/fees/FeeDiscountModal";
import { FeeActionReasonModal } from "@platform/app-shared/fees/FeeActionReasonModal";

export type FeesBillingMode = "readonly" | "supervisor" | "finance";

/** Employee fee types can have agreed amount edited by supervisor. */
function isEmployeeFeeType(inspectorType: string): boolean {
  return inspectorType.trim() === "موظف";
}

type RowDraft = {
  agreedFeeSar: string;
  supervisorDiscountSar: string;
  discountReason: string;
  excludedFromBatch: boolean;
  exclusionReason: string;
};

const fieldSm =
  "h-8 w-[4.75rem] px-2 py-1 text-end text-xs tabular-nums";
const fieldMd = "h-8 min-w-[7.5rem] max-w-[11rem] px-2 py-1 text-xs";
const checkClass =
  "h-4 w-4 shrink-0 cursor-pointer rounded border-border text-primary accent-primary";

function draftFromRow(row: InspectorFeeRowDto): RowDraft {
  return {
    agreedFeeSar: String(row.agreedFeeSar),
    supervisorDiscountSar: String(row.supervisorDiscountSar),
    discountReason: row.discountReason ?? "",
    excludedFromBatch: row.excludedFromBatch,
    exclusionReason: row.exclusionReason ?? "",
  };
}

function hasDraftChanges(row: InspectorFeeRowDto, draft: RowDraft): boolean {
  return (
    draft.agreedFeeSar !== String(row.agreedFeeSar) ||
    draft.supervisorDiscountSar !== String(row.supervisorDiscountSar) ||
    (draft.discountReason ?? "") !== (row.discountReason ?? "") ||
    draft.excludedFromBatch !== row.excludedFromBatch ||
    (draft.exclusionReason ?? "") !== (row.exclusionReason ?? "")
  );
}

function Sar({
  value,
  className,
  signed = false,
}: {
  value: number;
  className?: string;
  signed?: boolean;
}) {
  const prefix = signed && value > 0 ? "− " : "";
  return (
    <span className={cn("tabular-nums whitespace-nowrap", className)}>
      {prefix}
      {value.toLocaleString("ar-SA")}{" "}
      <span className="text-[10px] font-normal text-text-3">ر.س</span>
    </span>
  );
}

function FeeStatusBadge({ row }: { row: InspectorFeeRowDto }) {
  const label =
    row.billingStatusLabel || inspectorFeeStatusLabel(row.billingStatus);
  return (
    <Badge tone={inspectorFeeStatusTone(row.billingStatus)} className="text-[11px]">
      {label}
    </Badge>
  );
}

function SupervisorToolbar({
  total,
  selectedCount,
  eligibleCount,
  busy,
  onSelectAll,
  onClear,
  onBatchSubmit,
}: {
  total: number;
  selectedCount: number;
  eligibleCount: number;
  busy: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  onBatchSubmit: () => void;
}) {
  return (
    <div className={cn(pageToolbarClassName, "mb-0 rounded-t-[var(--radius-lg)]")}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text">
          {total.toLocaleString("ar-SA")} عقار
        </p>
        <p className="text-[11px] text-text-3">
          {eligibleCount.toLocaleString("ar-SA")} قابلة للمراجعة
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onSelectAll}>
          تحديد الكل
        </Button>
        {selectedCount > 0 ? (
          <Button type="button" size="sm" variant="ghost" onClick={onClear}>
            إلغاء ({selectedCount.toLocaleString("ar-SA")})
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="primary"
          disabled={busy || selectedCount === 0}
          onClick={onBatchSubmit}
        >
          حفظ المحدد
        </Button>
      </div>
    </div>
  );
}

export function InspectorFeesBillingTable({
  rows,
  mode = "readonly",
  pending = false,
  partyTypeColumn = "نوع الطرف",
  partyTypeEmployeeHint = "",
  onChanged,
}: {
  rows: InspectorFeeRowDto[];
  mode?: FeesBillingMode;
  pending?: boolean;
  partyTypeColumn?: string;
  partyTypeEmployeeHint?: string;
  onChanged?: () => void;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [drafts, setDrafts] = useState<Record<string, RowDraft>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [discountRow, setDiscountRow] = useState<InspectorFeeRowDto | null>(
    null,
  );
  const [reasonModal, setReasonModal] = useState<{
    row: InspectorFeeRowDto;
    action: "return-to-supervisor" | "inquiry-to-office";
  } | null>(null);

  const eligibleIds = useMemo(
    () =>
      rows
        .filter((row) => row.isEditable && !row.excludedFromBatch)
        .map((row) => row.workflowTaskId),
    [rows],
  );

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: [...prototypeKeys.all, "inspector-fees"],
    });
    onChanged?.();
  }, [onChanged, queryClient]);

  const draftFor = (row: InspectorFeeRowDto): RowDraft =>
    drafts[row.workflowTaskId] ?? draftFromRow(row);

  const setDraft = (taskId: string, patch: Partial<RowDraft>) => {
    setDrafts((prev) => {
      const row = rows.find((r) => r.workflowTaskId === taskId);
      const base = prev[taskId] ?? (row ? draftFromRow(row) : undefined);
      if (!base) return prev;
      return { ...prev, [taskId]: { ...base, ...patch } };
    });
  };

  const saveRow = async (row: InspectorFeeRowDto) => {
    const draft = draftFor(row);
    setBusyId(row.workflowTaskId);
    try {
      const body = {
        agreedFeeSar: isEmployeeFeeType(row.inspectorType)
          ? Number(draft.agreedFeeSar)
          : undefined,
        supervisorDiscountSar: Number(draft.supervisorDiscountSar),
        discountReason: draft.discountReason.trim() || undefined,
        excludedFromBatch: draft.excludedFromBatch,
        exclusionReason: draft.excludedFromBatch
          ? draft.exclusionReason.trim() || undefined
          : undefined,
      };
      const saved = await saveInspectorFeePatch(row.workflowTaskId, body);
      if (saved) {
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[row.workflowTaskId];
          return next;
        });
        await invalidate();
        return;
      }
      showToast("تعذّر حفظ الصف — حاول مرة أخرى", "error");
    } finally {
      setBusyId(null);
    }
  };

  const transitionRow = async (
    row: InspectorFeeRowDto,
    action: import("@platform/api-client").InspectorFeeAction,
    extra?: { reason?: string; disbursementVoucher?: string },
  ) => {
    setBusyId(row.workflowTaskId);
    try {
      const result = await runInspectorFeeTransition(row.workflowTaskId, {
        action,
        reason: extra?.reason,
        disbursementVoucher: extra?.disbursementVoucher,
      });
      if (result) {
        await invalidate();
        return;
      }
      showToast("تعذّر تنفيذ الإجراء — حاول مرة أخرى", "error");
    } finally {
      setBusyId(null);
    }
  };

  const batchSave = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBusyId("batch");
    try {
      for (const id of ids) {
        const row = rows.find((r) => r.workflowTaskId === id);
        if (!row) continue;
        await saveRow(row);
      }
      setSelected(new Set());
    } finally {
      setBusyId(null);
    }
  };

  const showActions = mode !== "readonly";
  const isSupervisor = mode === "supervisor";
  const colCount = (isSupervisor ? 1 : 0) + (showActions ? 9 : 8);

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
      {isSupervisor && rows.length > 0 ? (
        <SupervisorToolbar
          total={rows.length}
          selectedCount={selected.size}
          eligibleCount={eligibleIds.length}
          busy={busyId === "batch"}
          onSelectAll={() => setSelected(new Set(eligibleIds))}
          onClear={() => setSelected(new Set())}
          onBatchSubmit={() => void batchSave()}
        />
      ) : null}

      <div className={queueTableWrapClassName}>
        <Table className="min-w-[980px] w-full" pending={pending}>
          <THead>
            <Tr hoverable={false}>
              {isSupervisor ? (
                <ThAction aria-label="تحديد" className="w-10" />
              ) : null}
              <Th>رقم الصك</Th>
              <Th>أمر العمل</Th>
              <Th>{partyTypeColumn}</Th>
              <Th className="text-end">الأتعاب</Th>
              <Th className="text-end">الحسم</Th>
              <Th>سبب الحسم</Th>
              <Th className="text-end">الصافي</Th>
              <Th>الحالة</Th>
              {showActions ? <Th className="w-[9.5rem]">إجراءات</Th> : null}
            </Tr>
          </THead>
          <TBody>
            {pending && rows.length === 0 ? (
              <SkeletonTableRows rows={5} cols={colCount} />
            ) : (
              rows.map((row) => {
                const draft = draftFor(row);
                const editing = isSupervisor && row.isEditable;
                const isBusy = busyId === row.workflowTaskId;
                const dirty = editing && hasDraftChanges(row, draft);
                const discount = Number(draft.supervisorDiscountSar) || 0;

                return (
                  <Tr
                    key={row.workflowTaskId}
                    hoverable={false}
                    className={cn(
                      dirty && "bg-[color-mix(in_srgb,var(--warning-bg)_35%,var(--surface))]",
                      draft.excludedFromBatch &&
                        "bg-[color-mix(in_srgb,var(--danger-bg)_25%,var(--surface))]",
                    )}
                  >
                    {isSupervisor ? (
                      <Td className="w-10 text-center">
                        {row.isEditable && !draft.excludedFromBatch ? (
                          <input
                            type="checkbox"
                            className={checkClass}
                            checked={selected.has(row.workflowTaskId)}
                            onChange={(e) => {
                              setSelected((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(row.workflowTaskId);
                                else next.delete(row.workflowTaskId);
                                return next;
                              });
                            }}
                          />
                        ) : null}
                      </Td>
                    ) : null}

                    <Td className="max-w-[9rem] font-medium text-text">
                      {row.propertyLabel}
                    </Td>
                    <Td>
                      <PoNumber value={row.poNumber} link />
                    </Td>
                    <Td className="text-text-2">
                      <span>{row.inspectorType}</span>
                      {isEmployeeFeeType(row.inspectorType) &&
                      partyTypeEmployeeHint ? (
                        <span className="mr-1 text-[10px] text-text-3">
                          {partyTypeEmployeeHint}
                        </span>
                      ) : null}
                    </Td>

                    <Td className="text-end">
                      {editing && isEmployeeFeeType(row.inspectorType) ? (
                        <Input
                          type="number"
                          min={0}
                          className={fieldSm}
                          value={draft.agreedFeeSar}
                          onChange={(e) =>
                            setDraft(row.workflowTaskId, {
                              agreedFeeSar: e.target.value,
                            })
                          }
                        />
                      ) : (
                        <Sar value={row.agreedFeeSar} className="text-text-2" />
                      )}
                    </Td>

                    <Td className="text-end">
                      {editing ? (
                        <Input
                          type="number"
                          min={0}
                          className={cn(
                            fieldSm,
                            discount > 0 && "border-danger/40 text-danger",
                          )}
                          value={draft.supervisorDiscountSar}
                          onChange={(e) =>
                            setDraft(row.workflowTaskId, {
                              supervisorDiscountSar: e.target.value,
                            })
                          }
                        />
                      ) : row.supervisorDiscountSar > 0 ? (
                        <Sar
                          value={row.supervisorDiscountSar}
                          signed
                          className="font-medium text-danger"
                        />
                      ) : (
                        <span className="text-text-3">—</span>
                      )}
                    </Td>

                    <Td className="min-w-[8rem]">
                      {editing ? (
                        <Input
                          className={fieldMd}
                          value={draft.discountReason}
                          placeholder="سبب الحسم"
                          disabled={discount <= 0}
                          onChange={(e) =>
                            setDraft(row.workflowTaskId, {
                              discountReason: e.target.value,
                            })
                          }
                        />
                      ) : (
                        <span className="text-text-2">
                          {row.discountReason ?? "—"}
                        </span>
                      )}
                    </Td>

                    <Td className="text-end font-semibold text-text">
                      <Sar value={row.netFeeSar} />
                    </Td>

                    <Td>
                      <div className="flex flex-col items-start gap-1">
                        <FeeStatusBadge row={row} />
                        {row.excludedFromBatch || draft.excludedFromBatch ? (
                          <Badge tone="danger" className="text-[10px]">
                            مستبعد
                          </Badge>
                        ) : null}
                        {row.disbursementVoucher ? (
                          <span className="text-[10px] text-text-3">
                            {row.disbursementVoucher}
                          </span>
                        ) : null}
                      </div>
                    </Td>

                    {showActions ? (
                      <Td className="align-top">
                        {editing ? (
                          <div className="flex min-w-[8.5rem] flex-col gap-2">
                            <div className="flex flex-wrap gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={isBusy || !dirty}
                                onClick={() => void saveRow(row)}
                              >
                                حفظ
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={isBusy}
                                onClick={() => setDiscountRow(row)}
                              >
                                حسم
                              </Button>
                            </div>
                            <button
                              type="button"
                              className={cn(
                                "rounded-[var(--radius-DEFAULT)] border px-2 py-1 text-[10px] transition-colors",
                                draft.excludedFromBatch
                                  ? "border-danger/35 bg-danger-bg text-danger-text"
                                  : "border-border text-text-3 hover:bg-surface-2",
                              )}
                              onClick={() =>
                                setDraft(row.workflowTaskId, {
                                  excludedFromBatch: !draft.excludedFromBatch,
                                })
                              }
                            >
                              {draft.excludedFromBatch
                                ? "إلغاء الاستبعاد"
                                : "استبعاد مؤقت"}
                            </button>
                            {draft.excludedFromBatch ? (
                              <Input
                                className="h-8 px-2 py-1 text-[11px]"
                                placeholder="سبب الاستبعاد"
                                value={draft.exclusionReason}
                                onChange={(e) =>
                                  setDraft(row.workflowTaskId, {
                                    exclusionReason: e.target.value,
                                  })
                                }
                              />
                            ) : null}
                          </div>
                        ) : mode === "finance" ? (
                          <div className="flex flex-col gap-1">
                            {row.billingStatus === "disb-req" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="primary"
                                disabled={isBusy}
                                onClick={() => void transitionRow(row, "disburse")}
                              >
                                صرف
                              </Button>
                            ) : null}
                            {row.billingStatus === "at-finance" ||
                            row.billingStatus === "disb-req" ? (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={isBusy}
                                  onClick={() =>
                                    setReasonModal({
                                      row,
                                      action: "return-to-supervisor",
                                    })
                                  }
                                >
                                  إرجاع للمشرف
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  disabled={isBusy}
                                  onClick={() =>
                                    setReasonModal({
                                      row,
                                      action: "inquiry-to-office",
                                    })
                                  }
                                >
                                  استفسار للمكتب
                                </Button>
                              </>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-[11px] text-text-3">—</span>
                        )}
                      </Td>
                    ) : null}
                  </Tr>
                );
              })
            )}
          </TBody>
        </Table>
      </div>
      <FeeDiscountModal
        open={discountRow !== null}
        row={discountRow}
        onClose={() => setDiscountRow(null)}
        onSave={async (patch) => {
          if (!discountRow) return;
          setBusyId(discountRow.workflowTaskId);
          try {
            const saved = await saveInspectorFeePatch(
              discountRow.workflowTaskId,
              patch,
            );
            if (saved) await invalidate();
          } finally {
            setBusyId(null);
          }
        }}
      />
      <FeeActionReasonModal
        open={reasonModal !== null}
        title={
          reasonModal?.action === "inquiry-to-office"
            ? "استفسار للمكتب"
            : "إرجاع للمشرف"
        }
        label={
          reasonModal?.action === "inquiry-to-office"
            ? "نص الاستفسار"
            : "سبب الإرجاع"
        }
        confirmLabel="تأكيد"
        onClose={() => setReasonModal(null)}
        onConfirm={async (reason) => {
          if (!reasonModal) return;
          await transitionRow(reasonModal.row, reasonModal.action, { reason });
        }}
      />
    </div>
  );
}

export function feesStatusFilter(
  mode: FeesBillingMode,
): InspectorFeeBillingStatus | undefined {
  if (mode === "finance") return "disb-req";
  return undefined;
}
