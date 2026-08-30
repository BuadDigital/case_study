"use client";

import { useMemo, useState } from "react";
import { Spinner, cn, useToast } from "@platform/ui-kit";
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

/** Skeleton rows while loading — static JSX independent of state. */
const FEES_TABLE_SKELETON = (
  <div className="space-y-0">
    {Array.from({ length: 4 }).map((_, i) => (
      <div
        key={i}
        className="h-[54px] animate-pulse border-b border-border bg-surface-2/60"
      />
    ))}
  </div>
);

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
        <div className={keysDashCardClassName}>
          <div className="text-[30px] font-extrabold leading-none text-heading tabular-nums">
            {ready ? rows.length : "—"}
          </div>
          <div className="mt-1.5 text-[12.5px] text-text-2">
            أظرف مستحقة (سيناريو المحكمة)
          </div>
        </div>
        <div className={keysDashCardClassName}>
          <div className="text-[30px] font-extrabold leading-none text-[#8a5e14] tabular-nums">
            {ready ? unpricedCount : "—"}
          </div>
          <div className="mt-1.5 text-[12.5px] text-text-2">
            بانتظار فوترة إنفاذ (بلا مبلغ)
          </div>
        </div>
        <div className={keysDashCardClassName}>
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
              FEES_TABLE_SKELETON
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
                const priced = !!row.feeAmountSar;
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
                      {priced ? (
                        <span className="text-[14px] font-extrabold tabular-nums text-heading">
                          {row.feeAmountSar!.toLocaleString("ar-SA")} ر.س
                        </span>
                      ) : (
                        <span className="text-[12px] text-text-3">
                          تُدخله المالية
                        </span>
                      )}
                    </KeysTd>
                    <KeysTd>
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
                    </KeysTd>
                    <KeysTd align="center">
                      {collected ? (
                        <span className="text-[11.5px] text-text-3">
                          أكّدته المالية
                        </span>
                      ) : canCollect && priced ? (
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
                        className="flex w-full cursor-pointer flex-col gap-2.5 rounded-[12px] border border-border bg-surface px-3.5 py-3 text-start shadow-card transition-colors active:bg-row-hover"
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
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      <p className="m-0 px-1 pt-3 text-[11.5px] text-text-3">
        تسجيل الظرف وتصويره يثبت استحقاق إيراد استلام المفاتيح من إنفاذ — بلا
        مبلغ مضبوط في التسعيرة. المبلغ تُدخله المالية ضمن فوترة إنفاذ. البنود
        ذات المبالغ المختومة سابقاً تبقى قابلة للتحصيل من موظف المالية حصراً.
      </p>
    </div>
  );
}
