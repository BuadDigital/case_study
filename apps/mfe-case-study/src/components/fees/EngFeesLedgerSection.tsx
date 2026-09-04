"use client";

/**
 * Engineering-office fee lanes (action / ready) of `EngFeesHtmlScreen`: the
 * toolbar filters and the ledger table with the accept / dispute actions.
 */

import {
  cn,
  StatusPill,
  Table,
  TableEmptyRow,
  TableFrame,
  TBody,
  Td,
  TdLtr,
  Th,
  THead,
  Tr,
} from "@platform/ui-kit";
import type {
  InspectorFeeAction,
  InspectorFeeRowDto,
} from "@platform/api-client";
import { ymd as formatYmd } from "@platform/app-shared/format/date";
import { engFeeUiStatus } from "./EngOfficeFeesBillingTable";
import { EngFeesSectionTitle } from "./EngFeesHtmlTabs";
import {
  deedParts,
  fmtSar,
  statusMeta,
  type TabId,
} from "./eng-fees-state";
import {
  opsFldControl,
  opsFilters,
  opsListCount,
  opsToolbar,
} from "../../lib/app-data/ops-tasks-tw";

export function EngFeesLedgerSection({
  tab,
  search,
  setSearch,
  stFilter,
  setStFilter,
  filteredFees,
  feesPending,
  busyId,
  objectOpenId,
  setObjectOpenId,
  objectText,
  setObjectText,
  act,
}: {
  tab: TabId;
  search: string;
  setSearch: (v: string) => void;
  stFilter: string;
  setStFilter: (v: string) => void;
  filteredFees: InspectorFeeRowDto[];
  feesPending: boolean;
  busyId: string | null;
  objectOpenId: string | null;
  setObjectOpenId: (v: string | null) => void;
  objectText: string;
  setObjectText: (v: string) => void;
  act: (
    row: InspectorFeeRowDto,
    action: InspectorFeeAction,
    extra?: { reason?: string },
  ) => Promise<void>;
}) {
  return (
    <>
    {tab === "action" ? (
      <EngFeesSectionTitle
        title="الكشف المبدئي — بنود تتطلب إجراءكم"
        sub="تعديلات تسعير بانتظار إفادتكم، وتحفّظاتكم قيد المعالجة مع المشرف. الاستحقاق ينشأ بقبول الأخصائي بسعر جدول التسعير."
      />
    ) : (
      <EngFeesSectionTitle
        title="المعاملات الجاهزة للفوترة"
        sub="بنود مستحقة بانتظار كشف المحاسب نهاية الشهر — تشمل المرحَّلة من أشهر سابقة."
      />
    )}

    {/* `.toolbar` > `.filters` — separate from card */}
    <div className={opsToolbar}>
      <div className={opsFilters}>
        <div className="relative flex items-center">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none absolute start-3 text-text-3"
            aria-hidden
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="رقم الصك أو المدينة أو الحي…"
            aria-label="بحث الأتعاب"
            className={cn(opsFldControl, "w-[248px] max-w-full ps-[38px]")}
          />
        </div>
        <div className="relative flex items-center">
          <select
            value={stFilter}
            onChange={(e) => setStFilter(e.target.value)}
            aria-label="تصفية الحالة"
            className={cn(opsFldControl, "cursor-pointer")}
          >
            <option value="">جميع الحالات</option>
            {tab === "action" ? (
              <>
                <option value="pending_office">بانتظار إفادتكم</option>
                <option value="dispute">تحفّظ على التسعير</option>
              </>
            ) : (
              <>
                <option value="ready">جاهز للفوترة</option>
                <option value="carried">مرحَّل — متأخر</option>
              </>
            )}
          </select>
        </div>
        <span className={opsListCount}>{filteredFees.length} بند</span>
      </div>
    </div>

    <TableFrame>
      <Table className="min-w-[920px]">
        <THead>
          <Tr hoverable={false}>
            <Th>الصك</Th>
            <Th>تاريخ القبول</Th>
            <Th>سعر الجدول</Th>
            <Th>تعديل التسعير ومبرره</Th>
            <Th>الصافي</Th>
            <Th>الحالة</Th>
            <Th>إجراء المكتب</Th>
          </Tr>
        </THead>
        <TBody>
          {feesPending && filteredFees.length === 0 ? (
            <TableEmptyRow colSpan={7}>جاري التحميل…</TableEmptyRow>
          ) : filteredFees.length === 0 ? (
            <TableEmptyRow colSpan={7}>لا توجد بنود مطابقة.</TableEmptyRow>
          ) : (
            filteredFees.map((row) => {
              const st = engFeeUiStatus(row);
              const meta = statusMeta(st);
              const { deed, region } = deedParts(row);
              const ded = row.supervisorDiscountSar > 0;
              const busy = busyId === row.workflowTaskId;
              const objOpen = objectOpenId === row.workflowTaskId;
              return (
                <Tr key={row.workflowTaskId}>
                  <Td>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span
                        dir="ltr"
                        className="inline-block text-start text-[13px] font-bold tabular-nums text-gold-d [unicode-bidi:isolate]"
                      >
                        {deed}
                      </span>
                      <span className="text-[11px] text-text-3">
                        {region}
                      </span>
                    </div>
                  </Td>
                  <TdLtr valueClassName="text-[12px] text-text-2">
                    {formatYmd(
                      row.accruedAtUtc ??
                        row.workSubmittedAtUtc ??
                        row.updatedAtUtc,
                    )}
                  </TdLtr>
                  <TdLtr valueClassName="text-[12.5px] text-text-2">
                    {fmtSar(row.agreedFeeSar)}
                  </TdLtr>
                  <Td>
                    {ded ? (
                      <span
                        className="inline-flex min-w-0 items-center gap-1.5"
                        title={row.discountReason ?? undefined}
                      >
                        <span
                          dir="ltr"
                          className="shrink-0 text-[12.5px] font-bold tabular-nums text-[#a5432e] [unicode-bidi:isolate]"
                        >
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
                  <TdLtr valueClassName="text-[13px] font-bold text-heading">
                    {fmtSar(row.netFeeSar)}
                  </TdLtr>
                  <Td>
                    <StatusPill label={meta.label} style={meta.style} />
                  </Td>
                  <Td className="overflow-visible">
                    {st === "pending_office" ? (
                      <div className="flex w-full flex-col gap-1.5">
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            disabled={
                              busy || !row.canOfficeApproveDiscount
                            }
                            className="cursor-pointer whitespace-nowrap rounded-lg border-none bg-ink px-[11px] py-1 text-[11px] font-bold text-white shadow-[0_6px_16px_-8px_rgba(18,40,76,.6)] disabled:opacity-50"
                            onClick={() =>
                              void act(row, "office-approve-discount")
                            }
                          >
                            قبول
                          </button>
                          <button
                            type="button"
                            disabled={busy || !row.canOfficeDispute}
                            className="cursor-pointer whitespace-nowrap rounded-lg border border-[color-mix(in_srgb,#d9694f_40%,transparent)] bg-surface px-[11px] py-1 text-[11px] font-bold text-[#a5432e] disabled:opacity-50"
                            onClick={() => {
                              setObjectOpenId(
                                objOpen ? null : row.workflowTaskId,
                              );
                              setObjectText("");
                            }}
                          >
                            تحفّظ
                          </button>
                        </div>
                        {objOpen ? (
                          <div>
                            <textarea
                              rows={2}
                              value={objectText}
                              onChange={(e) =>
                                setObjectText(e.target.value)
                              }
                              placeholder="مبررات التحفّظ (إلزامي)…"
                              className="w-full resize-y rounded-lg border border-border-md bg-surface-2 px-3 py-2 text-[11.5px] text-text outline-none"
                            />
                            <button
                              type="button"
                              disabled={busy || !objectText.trim()}
                              className="mt-[5px] cursor-pointer rounded-lg border-none bg-ink px-3 py-[5px] text-[11px] font-bold text-white disabled:opacity-50"
                              onClick={() => {
                                if (!objectText.trim()) return;
                                void act(row, "office-dispute", {
                                  reason: objectText.trim(),
                                });
                              }}
                            >
                              إرسال التحفّظ
                            </button>
                          </div>
                        ) : null}
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
    </TableFrame>
    </>
  );
}
