"use client";

/**
 * Engineering-office fee lanes (under review / ready) of `EngFeesHtmlScreen`:
 * the toolbar filters and the ledger table. The office has no fee action here —
 * a proposed discount is discussed with the supervisor outside the system.
 */

import {
  MobileRecordCard,
  MobileRecordList,
  StatusPill,
} from "@platform/ui-kit";
import type { InspectorFeeRowDto } from "@platform/api-client";
import { EngFeesSectionTitle } from "./EngFeesHtmlTabs";
import {
  deedParts,
  engFeeUiStatus,
  statusMeta,
  type EngFeeUiStatus,
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

/**
 * What the office should expect for one fee (table cell and phone card). Informational only — the
 * office's accept / dispute controls were removed with the office loop; the supervisor contacts
 * the office about a proposed discount outside the system.
 */
function OfficeFeeNote({ st }: { st: EngFeeUiStatus }) {
  return (
    <span className="text-[11px] text-text-3">
      {st === "under_review" ? "يتواصل معكم المشرف قبل القرار" : "لا إجراء مطلوب"}
    </span>
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
}: {
  tab: TabId;
  search: string;
  setSearch: (v: string) => void;
  stFilter: string;
  setStFilter: (v: string) => void;
  filteredFees: InspectorFeeRowDto[];
  feesPending: boolean;
}) {
  return (
    <>
    {tab === "action" ? (
      <EngFeesSectionTitle
        title="قيد المراجعة مع المشرف"
        sub="حسم مقترح من الأخصائي عند قبول المخرجات — يناقشه معكم مشرف القسم ثم يعتمده أو يعدّله أو يسمح به. الأتعاب تنتقل للفوترة بعد قراره."
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
        <option value="under_review">قيد المراجعة مع المشرف</option>
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
            tone={st === "under_review" ? "gold" : undefined}
            title={<bdi dir="ltr" className="tabular-nums">{deed}</bdi>}
            subtitle={region}
            status={<StatusPill label={meta.label} style={meta.style} />}
            fields={feeRowCardFields(
              row,
              { date: "تاريخ القبول", discount: "تعديل التسعير ومبرره" },
              engFeeDate(row),
            )}
          >
            <OfficeFeeNote st={st} />
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
        action: "ملاحظة",
      }}
      rowKey={(row) => row.workflowTaskId}
      rowDate={engFeeDate}
      rowStatus={(row) => {
        const st = engFeeUiStatus(row);
        return { st, meta: statusMeta(st) };
      }}
      renderAction={(_row, st) => <OfficeFeeNote st={st} />}
    />
    </>
  );
}
