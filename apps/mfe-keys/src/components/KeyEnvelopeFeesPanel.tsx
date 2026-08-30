"use client";

import { useMemo, useState } from "react";
import {
  SkeletonTableRows,
  Spinner,
  TBody,
  THead,
  Table,
  TableFrame,
  Td,
  TdLtr,
  Th,
  Tr,
  cn,
  opsBtnGhost,
  opsChip,
  opsDashCard,
  opsTapCard,
  useToast,
} from "@platform/ui-kit";
import { KeysBackLink, KeysEmpty, KeysStatusPill } from "./KeysHtmlPrimitives";
import { markEnvelopeFeeCollected } from "../lib/keys-envelope-api";
import type { KeyEnvelopeFeeReportRow } from "../lib/keys-envelope-types";
import {
  useInvalidateKeyEnvelopes,
  useKeyEnvelopeFeesQuery,
} from "../query/keys-queries";

/** Skeleton rows while loading — mobile cards only. */
const FEES_CARDS_SKELETON = (
  <div className="space-y-2.5 p-3">
    {Array.from({ length: 4 }).map((_, i) => (
      <div
        key={i}
        className="h-[96px] animate-pulse rounded-[12px] bg-surface-2"
      />
    ))}
  </div>
);

export function KeyEnvelopeFeesPanel({
  canCollect,
  onOpenEnvelope,
  onBack,
}: {
  canCollect: boolean;
  onOpenEnvelope: (envelopeId: string) => void;
  onBack?: () => void;
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
  // Only the historical stamped rows carry an amount, so the totals speak for those alone. Rows
  // without one are entitlements waiting to be priced in enforcement billing.
  const totalOpen = useMemo(
    () => openRows.reduce((sum, r) => sum + (r.feeAmountSar || 0), 0),
    [openRows],
  );
  const unpricedCount = useMemo(
    () => rows.filter((r) => !r.feeAmountSar).length,
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
    <div>
      {onBack ? (
        <KeysBackLink onClick={onBack}>محفظة المفاتيح</KeysBackLink>
      ) : null}

      {/* renderKeyFees KPI dash-cards */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className={opsDashCard}>
          <div className="text-[30px] font-extrabold leading-none text-heading tabular-nums">
            {ready ? rows.length : "—"}
          </div>
          <div className="mt-1.5 text-[12.5px] text-text-2">
            أظرف مستحقة (سيناريو المحكمة)
          </div>
        </div>
        <div className={opsDashCard}>
          <div className="text-[30px] font-extrabold leading-none text-[#8a5e14] tabular-nums">
            {ready ? unpricedCount : "—"}
          </div>
          <div className="mt-1.5 text-[12.5px] text-text-2">
            بانتظار فوترة إنفاذ (بلا مبلغ)
          </div>
        </div>
        <div className={opsDashCard}>
          <div className="text-[30px] font-extrabold leading-none text-[#2f7a4d] tabular-nums">
            {ready ? totalOpen.toLocaleString("ar-SA") : "—"}{" "}
            <span className="text-[15px]">ر.س</span>
          </div>
          <div className="mt-1.5 text-[12.5px] text-text-2">
            مبالغ مختومة سابقاً مفتوحة للتحصيل
          </div>
        </div>
      </div>

      <div className="mb-3.5 flex items-center gap-2.5">
        <h2 className="m-0 text-[17px] font-extrabold text-heading">
          تقرير أتعاب استلام المفاتيح
        </h2>
        <span className={opsChip}>
          {ready ? `${rows.length} بند` : "…"}
        </span>
      </div>

      <TableFrame className="hidden lg:block">
        <Table className="min-w-[720px]" pending={!ready}>
          <THead>
            <Tr hoverable={false}>
              <Th>رقم الطلب</Th>
              <Th>المحكمة</Th>
              <Th>المبلغ</Th>
              <Th>الحالة</Th>
              <Th className="text-center">إجراء</Th>
            </Tr>
          </THead>
          <TBody>
            {!ready ? (
              <SkeletonTableRows rows={4} cols={5} />
            ) : rows.length === 0 ? (
              <Tr hoverable={false}>
                <Td colSpan={5} className="!border-b-0 !p-0">
                  <KeysEmpty
                    title="لا توجد بنود أتعاب"
                    sub="تُولَّد الأتعاب تلقائياً لسيناريو استلام المحكمة فقط."
                  />
                </Td>
              </Tr>
            ) : (
              rows.map((row) => {
                const collected =
                  (row.collectionStatus ?? "open") === "collected";
                const c = collected ? "#2f7a4d" : "#d9a441";
                const priced = !!row.feeAmountSar;
                return (
                  <Tr
                    key={row.envelopeId}
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpenEnvelope(row.envelopeId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onOpenEnvelope(row.envelopeId);
                      }
                    }}
                  >
                    <TdLtr bare className="text-[13.5px] font-bold text-gold-d">
                      {row.requestNumber || "—"}
                    </TdLtr>
                    <Td>
                      <span className="text-[13px] text-text-2">
                        {row.court || "—"}
                      </span>
                    </Td>
                    <TdLtr bare>
                      {priced ? (
                        <span className="text-[14px] font-extrabold tabular-nums text-heading">
                          {row.feeAmountSar!.toLocaleString("ar-SA")} ر.س
                        </span>
                      ) : (
                        <span className="text-[12px] text-text-3">
                          تُدخله المالية
                        </span>
                      )}
                    </TdLtr>
                    <Td>
                      <KeysStatusPill
                        label={
                          collected
                            ? "محصّلة"
                            : priced
                              ? "بانتظار التحصيل"
                              : "بانتظار فوترة إنفاذ"
                        }
                        color={c}
                      />
                    </Td>
                    <Td className="text-center">
                      {collected ? (
                        <span className="text-[11.5px] text-text-3">
                          أكّدته المالية
                        </span>
                      ) : canCollect && priced ? (
                        <button
                          type="button"
                          disabled={busyId !== null}
                          aria-busy={busyId === row.envelopeId || undefined}
                          className={opsBtnGhost}
                          style={{
                            height: 30,
                            padding: "0 12px",
                            fontSize: 12,
                            color: "#2f7a4d",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            void collect(row);
                          }}
                        >
                          {busyId === row.envelopeId ? <Spinner /> : null}
                          {busyId === row.envelopeId
                            ? "جاري…"
                            : "تأكيد التحصيل (المالية)"}
                        </button>
                      ) : (
                        "—"
                      )}
                    </Td>
                  </Tr>
                );
              })
            )}
          </TBody>
        </Table>
      </TableFrame>

      <div className="lg:hidden">
            {!ready ? (
              FEES_CARDS_SKELETON
            ) : rows.length === 0 ? (
              <KeysEmpty
                title="لا توجد بنود أتعاب"
                sub="تُولَّد الأتعاب تلقائياً لسيناريو استلام المحكمة فقط."
              />
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2.5 p-3">
                {rows.map((row) => {
                  const collected =
                    (row.collectionStatus ?? "open") === "collected";
                  const c = collected ? "#2f7a4d" : "#d9a441";
                  const priced = !!row.feeAmountSar;
                  return (
                    <li key={`m-${row.envelopeId}`}>
                      <div
                        role="button"
                        tabIndex={0}
                        className={cn(opsTapCard, "flex w-full flex-col gap-2.5 px-3.5 py-3")}
                        onClick={() => onOpenEnvelope(row.envelopeId)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onOpenEnvelope(row.envelopeId);
                          }
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[14px] font-bold text-gold-d">
                              {row.requestNumber || "—"}
                            </div>
                            <div className="mt-0.5 text-[12.5px] text-text-2">
                              {row.court || "—"}
                            </div>
                          </div>
                          <KeysStatusPill
                            label={
                              collected
                                ? "محصّلة"
                                : priced
                                  ? "بانتظار التحصيل"
                                  : "بانتظار فوترة إنفاذ"
                            }
                            color={c}
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          {priced ? (
                            <span className="tabular-nums text-[15px] font-extrabold text-heading">
                              {row.feeAmountSar!.toLocaleString("ar-SA")} ر.س
                            </span>
                          ) : (
                            <span className="text-[12.5px] text-text-3">
                              المبلغ تُدخله المالية
                            </span>
                          )}
                          {collected ? (
                            <span className="text-[11.5px] text-text-3">
                              أكّدته المالية
                            </span>
                          ) : canCollect && priced ? (
                            <button
                              type="button"
                              disabled={busyId !== null}
                              aria-busy={busyId === row.envelopeId || undefined}
                              className={cn(
                                opsBtnGhost,
                                "inline-flex items-center gap-1.5",
                              )}
                              style={{ color: "#2f7a4d" }}
                              onClick={(e) => {
                                e.stopPropagation();
                                void collect(row);
                              }}
                            >
                              {busyId === row.envelopeId ? <Spinner /> : null}
                              {busyId === row.envelopeId
                                ? "جاري…"
                                : "تأكيد التحصيل"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
      </div>

      <p className="m-0 px-1 pt-3 text-[11.5px] text-text-3">
        تسجيل الظرف وتصويره يثبت استحقاق إيراد استلام المفاتيح من إنفاذ — بلا
        مبلغ مضبوط في التسعيرة. المبلغ تُدخله المالية ضمن فوترة إنفاذ. البنود
        ذات المبالغ المختومة سابقاً تبقى قابلة للتحصيل من موظف المالية حصراً.
      </p>
    </div>
  );
}
