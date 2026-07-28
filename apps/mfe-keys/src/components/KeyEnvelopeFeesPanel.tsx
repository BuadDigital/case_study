"use client";

import { useMemo, useState } from "react";
import { Spinner, cn, useToast } from "@platform/design-system";
import {
  KEYS_FEES_COLS,
  KeysBackLink,
  KeysEmpty,
  KeysGridHead,
  KeysGridRow,
  KeysStatusPill,
  KeysTd,
  KeysTh,
  keysCardClassName,
  keysChipClassName,
  keysDashCardClassName,
  keysGhostBtnClassName,
} from "./KeysHtmlPrimitives";
import { markEnvelopeFeeCollected } from "../lib/keys-envelope-api";
import type { KeyEnvelopeFeeReportRow } from "../lib/keys-envelope-types";
import {
  useInvalidateKeyEnvelopes,
  useKeyEnvelopeFeesQuery,
} from "../query/keys-queries";

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
    <div>
      {onBack ? (
        <KeysBackLink onClick={onBack}>محفظة المفاتيح</KeysBackLink>
      ) : null}

      {/* renderKeyFees KPI dash-cards */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className={keysDashCardClassName}>
          <div className="text-[30px] font-extrabold leading-none text-heading tabular-nums">
            {ready ? rows.length : "—"}
          </div>
          <div className="mt-1.5 text-[12.5px] text-text-2">
            بنود أتعاب (سيناريو المحكمة)
          </div>
        </div>
        <div className={keysDashCardClassName}>
          <div className="text-[30px] font-extrabold leading-none text-[#8a5e14] tabular-nums">
            {ready ? totalOpen.toLocaleString("ar-SA") : "—"}{" "}
            <span className="text-[15px]">ر.س</span>
          </div>
          <div className="mt-1.5 text-[12.5px] text-text-2">
            مفتوح للتحصيل ({ready ? openRows.length : "—"})
          </div>
        </div>
        <div className={keysDashCardClassName}>
          <div className="text-[30px] font-extrabold leading-none text-[#2f7a4d] tabular-nums">
            {ready ? totalAll.toLocaleString("ar-SA") : "—"}{" "}
            <span className="text-[15px]">ر.س</span>
          </div>
          <div className="mt-1.5 text-[12.5px] text-text-2">
            إجمالي الأتعاب المولّدة
          </div>
        </div>
      </div>

      <div className="mb-3.5 flex items-center gap-2.5">
        <h2 className="m-0 text-[17px] font-extrabold text-heading">
          تقرير أتعاب استلام المفاتيح
        </h2>
        <span className={keysChipClassName}>
          {ready ? `${rows.length} بند` : "…"}
        </span>
      </div>

      <div className={keysCardClassName}>
        <div className="overflow-x-auto rounded-xl">
          <div className="hidden min-w-[720px] lg:block">
            <KeysGridHead cols={KEYS_FEES_COLS}>
              <KeysTh align="start">رقم الطلب</KeysTh>
              <KeysTh align="start">المحكمة</KeysTh>
              <KeysTh align="start">المبلغ</KeysTh>
              <KeysTh align="start">الحالة</KeysTh>
              <KeysTh>إجراء</KeysTh>
            </KeysGridHead>

            {!ready ? (
              <div className="space-y-0">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[54px] animate-pulse border-b border-border bg-surface-2/60"
                  />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <KeysEmpty
                title="لا توجد بنود أتعاب"
                sub="تُولَّد الأتعاب تلقائياً لسيناريو استلام المحكمة فقط."
              />
            ) : (
              rows.map((row) => {
                const collected =
                  (row.collectionStatus ?? "open") === "collected";
                const c = collected ? "#2f7a4d" : "#d9a441";
                return (
                  <KeysGridRow
                    key={row.envelopeId}
                    cols={KEYS_FEES_COLS}
                    minHeight={54}
                    onClick={() => onOpenEnvelope(row.envelopeId)}
                  >
                    <KeysTd>
                      <span className="text-[13.5px] font-bold text-gold-d">
                        {row.requestNumber || "—"}
                      </span>
                    </KeysTd>
                    <KeysTd>
                      <span className="text-[13px] text-text-2">
                        {row.court || "—"}
                      </span>
                    </KeysTd>
                    <KeysTd>
                      <span className="text-[14px] font-extrabold tabular-nums text-heading">
                        {row.feeAmountSar.toLocaleString("ar-SA")} ر.س
                      </span>
                    </KeysTd>
                    <KeysTd>
                      <KeysStatusPill
                        label={collected ? "محصّلة" : "بانتظار التحصيل"}
                        color={c}
                      />
                    </KeysTd>
                    <KeysTd align="center">
                      {collected ? (
                        <span className="text-[11.5px] text-text-3">
                          أكّدته المالية
                        </span>
                      ) : canCollect ? (
                        <button
                          type="button"
                          disabled={busyId !== null}
                          aria-busy={busyId === row.envelopeId || undefined}
                          className={keysGhostBtnClassName}
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
                    </KeysTd>
                  </KeysGridRow>
                );
              })
            )}
          </div>

          <div className="lg:hidden">
            {!ready ? (
              <div className="space-y-2.5 p-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[96px] animate-pulse rounded-[12px] bg-surface-2"
                  />
                ))}
              </div>
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
                  return (
                    <li key={`m-${row.envelopeId}`}>
                      <button
                        type="button"
                        className="flex w-full cursor-pointer flex-col gap-2.5 rounded-[12px] border border-border bg-surface px-3.5 py-3 text-start shadow-card transition-colors active:bg-row-hover"
                        onClick={() => onOpenEnvelope(row.envelopeId)}
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
                            label={collected ? "محصّلة" : "بانتظار التحصيل"}
                            color={c}
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="tabular-nums text-[15px] font-extrabold text-heading">
                            {row.feeAmountSar.toLocaleString("ar-SA")} ر.س
                          </span>
                          {collected ? (
                            <span className="text-[11.5px] text-text-3">
                              أكّدته المالية
                            </span>
                          ) : canCollect ? (
                            <button
                              type="button"
                              disabled={busyId !== null}
                              aria-busy={busyId === row.envelopeId || undefined}
                              className={cn(
                                keysGhostBtnClassName,
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
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      <p className="m-0 px-1 pt-3 text-[11.5px] text-text-3">
        تسجيل الظرف وتصويره يُنشئ حالة مالية بوجوب رفع أتعاب استلام المفتاح —
        التحصيل يتم بعد اكتمال دراسة الحالة ورفع صورة الظرف على إنفاذ، وتأكيد
        الاستلام من موظف المالية حصراً.
      </p>
    </div>
  );
}
