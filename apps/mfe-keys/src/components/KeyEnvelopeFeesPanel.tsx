"use client";

import { useMemo, useState } from "react";
import {
  Button,
  OperationalPanel,
  SkeletonTableRows,
  StatusPill,
  Table,
  TBody,
  Td,
  TdAction,
  Th,
  ThAction,
  THead,
  Tr,
  cn,
  queueTableRowClassName,
  useToast,
} from "@platform/design-system";
import { markEnvelopeFeeCollected } from "../lib/keys-envelope-api";
import type { KeyEnvelopeFeeReportRow } from "../lib/keys-envelope-types";
import {
  useInvalidateKeyEnvelopes,
  useKeyEnvelopeFeesQuery,
} from "../query/keys-queries";

export function KeyEnvelopeFeesPanel({
  canCollect,
  onOpenEnvelope,
}: {
  canCollect: boolean;
  onOpenEnvelope: (envelopeId: string) => void;
}) {
  const { showToast } = useToast();
  const feesQuery = useKeyEnvelopeFeesQuery();
  const invalidate = useInvalidateKeyEnvelopes();
  const rows = feesQuery.data ?? [];
  const ready = !feesQuery.isPending;
  const [busyId, setBusyId] = useState<string | null>(null);

  const openRows = useMemo(
    () => rows.filter((r) => (r.collectionStatus ?? "open") !== "collected"),
    [rows],
  );
  const totalOpen = useMemo(
    () => openRows.reduce((sum, r) => sum + (r.feeAmountSar || 0), 0),
    [openRows],
  );
  const totalAll = useMemo(
    () => rows.reduce((sum, r) => sum + (r.feeAmountSar || 0), 0),
    [rows],
  );

  async function collect(row: KeyEnvelopeFeeReportRow) {
    setBusyId(row.envelopeId);
    const result = await markEnvelopeFeeCollected(row.envelopeId);
    setBusyId(null);
    if (!result.ok) {
      showToast(result.error, "error");
      return;
    }
    invalidate();
    showToast("تم تعليم الأتعاب كمحصّلة", "success");
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface px-[18px] py-4 shadow-card">
          <div className="text-[30px] font-extrabold leading-none text-heading tabular-nums">
            {ready ? rows.length : "—"}
          </div>
          <div className="mt-1.5 text-[12.5px] text-text-2">
            بنود أتعاب (سيناريو المحكمة)
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface px-[18px] py-4 shadow-card">
          <div className="text-[30px] font-extrabold leading-none text-[#8a5e14] tabular-nums">
            {ready ? totalOpen.toLocaleString("ar-SA") : "—"}{" "}
            <span className="text-[15px]">ر.س</span>
          </div>
          <div className="mt-1.5 text-[12.5px] text-text-2">
            مفتوح للتحصيل ({ready ? openRows.length : "—"})
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface px-[18px] py-4 shadow-card">
          <div className="text-[30px] font-extrabold leading-none text-[#2f7a4d] tabular-nums">
            {ready ? totalAll.toLocaleString("ar-SA") : "—"}{" "}
            <span className="text-[15px]">ر.س</span>
          </div>
          <div className="mt-1.5 text-[12.5px] text-text-2">
            إجمالي الأتعاب المولّدة
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <h2 className="m-0 text-[18px] font-extrabold text-heading">
          تقرير أتعاب استلام المفاتيح
        </h2>
        <span className="inline-flex items-center rounded-md bg-[var(--gold-soft)] px-2.5 py-1 text-[12px] font-bold text-[var(--gold-d)]">
          {ready ? `${rows.length} بند` : "…"}
        </span>
      </div>

      <OperationalPanel className="shrink-0 overflow-visible">
        <Table pending={!ready}>
          <THead>
            <Tr hoverable={false}>
              <Th className="text-start">رقم الطلب</Th>
              <Th className="text-start">المحكمة</Th>
              <Th className="text-start">المبلغ</Th>
              <Th className="text-start">الحالة</Th>
              <ThAction aria-label="إجراء" />
            </Tr>
          </THead>
          <TBody>
            {!ready ? (
              <SkeletonTableRows rows={5} cols={5} />
            ) : rows.length === 0 ? (
              <Tr hoverable={false}>
                <Td
                  colSpan={5}
                  className="cursor-default py-10 text-center text-[13px] text-text-3"
                >
                  <div className="font-semibold text-text-2">
                    لا توجد بنود أتعاب
                  </div>
                  <div className="mt-1 text-[12px]">
                    تُولَّد الأتعاب تلقائياً لسيناريو استلام المحكمة فقط.
                  </div>
                </Td>
              </Tr>
            ) : (
              rows.map((row) => {
                const collected =
                  (row.collectionStatus ?? "open") === "collected";
                const c = collected ? "#2f7a4d" : "#d9a441";
                return (
                  <Tr
                    key={row.envelopeId}
                    hoverable={false}
                    className={cn("group", queueTableRowClassName)}
                    onClick={() => onOpenEnvelope(row.envelopeId)}
                  >
                    <Td>
                      <span className="text-[13.5px] font-bold text-primary">
                        {row.requestNumber || "—"}
                      </span>
                    </Td>
                    <Td className="text-text-2">{row.court || "—"}</Td>
                    <Td className="tabular-nums font-extrabold text-heading">
                      {row.feeAmountSar.toLocaleString("ar-SA")} ر.س
                    </Td>
                    <Td>
                      <StatusPill
                        label={collected ? "محصّلة" : "بانتظار التحصيل"}
                        style={{ base: c, fg: c }}
                      />
                    </Td>
                    <TdAction onClick={(e) => e.stopPropagation()}>
                      {collected ? (
                        <span className="text-[11.5px] text-text-3">
                          أكّدته المالية
                        </span>
                      ) : canCollect ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-[30px] text-[12px] text-[#2f7a4d]"
                            disabled={busyId !== null}
                            showActionToast={false}
                            onClick={() => void collect(row)}
                          >
                            {busyId === row.envelopeId
                              ? "جاري…"
                              : "تأكيد التحصيل (المالية)"}
                          </Button>
                      ) : (
                        "—"
                      )}
                    </TdAction>
                  </Tr>
                );
              })
            )}
          </TBody>
        </Table>
      </OperationalPanel>

      <p className="m-0 text-[11.5px] text-text-3">
        تسجيل الظرف وتصويره يُنشئ حالة مالية بوجوب رفع أتعاب استلام المفتاح —
        التحصيل يتم بعد اكتمال دراسة الحالة ورفع صورة الظرف على إنفاذ، وتأكيد
        الاستلام من موظف المالية حصراً.
      </p>
    </div>
  );
}
