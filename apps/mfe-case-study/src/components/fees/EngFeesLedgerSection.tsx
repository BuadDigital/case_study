"use client";

/**
 * Engineering-office fee lanes (action / ready) of `EngFeesHtmlScreen`: the
 * toolbar filters and the ledger table with the accept / dispute actions.
 */

import {
  MobileRecordCard,
  MobileRecordList,
  StatusPill,
} from "@platform/ui-kit";
import type {
  InspectorFeeAction,
  InspectorFeeRowDto,
} from "@platform/api-client";
import { engFeeUiStatus } from "./EngOfficeFeesBillingTable";
import { EngFeesSectionTitle } from "./EngFeesHtmlTabs";
import {
  deedParts,
  statusMeta,
  type TabId,
} from "./eng-fees-state";
import {
  FeeLedgerTable,
  FeeLedgerToolbar,
  feeRowCardFields,
} from "./FeeLedgerParts";

/** The office lane dates a fee by its acceptance. */
function engFeeDate(row: InspectorFeeRowDto) {
  return row.accruedAtUtc ?? row.workSubmittedAtUtc ?? row.updatedAtUtc;
}

type FeeAct = (
  row: InspectorFeeRowDto,
  action: InspectorFeeAction,
  extra?: { reason?: string },
) => Promise<void>;

/** The office's accept / dispute controls for one fee (table cell and phone card). */
function OfficeFeeAction({
  row,
  st,
  busy,
  objOpen,
  objectText,
  setObjectText,
  setObjectOpenId,
  act,
}: {
  row: InspectorFeeRowDto;
  st: ReturnType<typeof engFeeUiStatus>;
  busy: boolean;
  objOpen: boolean;
  objectText: string;
  setObjectText: (v: string) => void;
  setObjectOpenId: (v: string | null) => void;
  act: FeeAct;
}) {
  return (
    <>
    {st === "pending_office" ? (
      <div className="flex w-full flex-col gap-1.5">
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={
              busy || !row.canOfficeApproveDiscount
            }
            className="cursor-pointer whitespace-nowrap rounded-lg border-none bg-ink px-[11px] py-1 text-[11px] font-bold text-white shadow-[0_6px_16px_-8px_rgba(18,40,76,.6)] disabled:opacity-50 max-lg:min-h-11 max-lg:px-4 max-lg:text-[13px]"
            onClick={() =>
              void act(row, "office-approve-discount")
            }
          >
            قبول
          </button>
          <button
            type="button"
            disabled={busy || !row.canOfficeDispute}
            className="cursor-pointer whitespace-nowrap rounded-lg border border-[color-mix(in_srgb,#d9694f_40%,transparent)] bg-surface px-[11px] py-1 text-[11px] font-bold text-[#a5432e] disabled:opacity-50 max-lg:min-h-11 max-lg:px-4 max-lg:text-[13px]"
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
              className="mt-[5px] cursor-pointer rounded-lg border-none bg-ink px-3 py-[5px] text-[11px] font-bold text-white disabled:opacity-50 max-lg:min-h-11 max-lg:px-4 max-lg:text-[13px]"
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
    </>
  );
}

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
  act: FeeAct;
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
    <FeeLedgerToolbar
      search={search}
      setSearch={setSearch}
      stFilter={stFilter}
      setStFilter={setStFilter}
      count={filteredFees.length}
    >
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
    </FeeLedgerToolbar>

    {/* Phones: one card per fee — the 7-column ledger would scroll sideways. */}
    <MobileRecordList
      className="lg:hidden"
      isEmpty={filteredFees.length === 0}
      empty={feesPending ? "جاري التحميل…" : "لا توجد بنود مطابقة."}
    >
      {filteredFees.map((row) => {
        const st = engFeeUiStatus(row);
        const meta = statusMeta(st);
        const { deed, region } = deedParts(row);
        return (
          <MobileRecordCard
            key={row.workflowTaskId}
            tone={st === "pending_office" ? "gold" : st === "dispute" ? "red" : undefined}
            title={<bdi dir="ltr" className="tabular-nums">{deed}</bdi>}
            subtitle={region}
            status={<StatusPill label={meta.label} style={meta.style} />}
            fields={feeRowCardFields(
              row,
              { date: "تاريخ القبول", discount: "تعديل التسعير ومبرره" },
              engFeeDate(row),
            )}
          >
            <OfficeFeeAction
              row={row}
              st={st}
              busy={busyId === row.workflowTaskId}
              objOpen={objectOpenId === row.workflowTaskId}
              objectText={objectText}
              setObjectText={setObjectText}
              setObjectOpenId={setObjectOpenId}
              act={act}
            />
          </MobileRecordCard>
        );
      })}
    </MobileRecordList>

    <FeeLedgerTable
      rows={filteredFees}
      pending={feesPending}
      columns={{
        date: "تاريخ القبول",
        discount: "تعديل التسعير ومبرره",
        action: "إجراء المكتب",
      }}
      rowKey={(row) => row.workflowTaskId}
      rowDate={engFeeDate}
      rowStatus={(row) => {
        const st = engFeeUiStatus(row);
        return { st, meta: statusMeta(st) };
      }}
      renderAction={(row, st) => (
        <OfficeFeeAction
          row={row}
          st={st}
          busy={busyId === row.workflowTaskId}
          objOpen={objectOpenId === row.workflowTaskId}
          objectText={objectText}
          setObjectText={setObjectText}
          setObjectOpenId={setObjectOpenId}
          act={act}
        />
      )}
    />
    </>
  );
}
