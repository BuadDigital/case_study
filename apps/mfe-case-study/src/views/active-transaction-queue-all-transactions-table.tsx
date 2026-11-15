"use client";

/**
 * «جميع العقارات»'s table (Omar 2026-11-15): one row per property, in the look of the «أعمالي» table
 * — the transaction number first, then the deed, the place, the work order, the state, the dates
 * and ⋮ (Omar 2026-11-15: the state alone, no «بانتظار» line — the cards above say where it stands). No pin star, no action clock (when a transaction reached its party is
 * not kept). The whole row opens the property; on phones the rows are «أعمالي»'s record cards.
 * A page to look at, not to act from (Omar 2026-11-15): the stage is plain text, not «أعمالي»'s
 * action tag, and no deadline is coloured or called late. The transaction number, the row's key,
 * starts at the right with its name; every other column is centred under its name, as «أعمالي».
 */
import { memo } from "react";
import {
  cn,
  GentleBusy,
  MobileRecordCard,
  MobileRecordList,
  RowMoreMenu,
  SkeletonTableRows,
  Table,
  TableEmptyRow,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@platform/ui-kit";
import type { AllTransactionsRowMeta } from "./active-transaction-queue-state";
import {
  ALL_TRANSACTIONS_SKELETON_COLS,
  type QueueRowContext,
} from "./active-transaction-queue-tables-state";
import { queueRowClassName, QueueRowMoreCell } from "./active-transaction-queue-row-parts";
import { MY_WORK_LONG_VALUE, Muted, MyWorkDates } from "./my-work-table-parts";

/**
 * Column widths in the header's order: transaction number, deed, city / district, work order, state,
 * dates, ⋮ (Omar 2026-11-15: in proportion to what each column holds).
 *
 * How it works: each share is the column's longest value (or its header, when longer) plus its
 * padding, with the room left over shared out evenly, measured on the live list at 1280px; the work
 * order (`null`) takes the rest. Fixed layout, as «أعمالي».
 * Edge cases: at the table's least width (900px) every value still fits on one line; a longer place
 * or work-order description wraps inside its cell.
 */
const COLUMN_WIDTHS: readonly (string | number | null)[] = [
  "13%",
  "14%",
  "18.5%",
  null,
  "13%",
  "14%",
  56,
];

/** The dates as «أعمالي» lays them out, uncoloured: nothing here is due from the viewer. */
function plainDates(meta: Pick<AllTransactionsRowMeta, "receivedIso" | "dueIso">) {
  return { receivedIso: meta.receivedIso, dueIso: meta.dueIso, due: "ok" as const, dueText: "" };
}

function placeOf(meta: Pick<AllTransactionsRowMeta, "city" | "district">): string {
  return [meta.city, meta.district].filter((v) => v && v !== "—").join(" · ");
}

/** The stage as plain text; a closed one (uploaded, cancelled) in the muted colour. */
function StageText({ meta }: { meta: Pick<AllTransactionsRowMeta, "phaseLabel" | "closed"> }) {
  return (
    <span
      className={cn(
        "text-[13px] font-semibold",
        meta.closed ? "text-text-2" : "text-heading",
      )}
    >
      {meta.phaseLabel}
    </span>
  );
}

const AllTransactionsRow = memo(function AllTransactionsRow({
  ctx,
  meta,
}: {
  ctx: QueueRowContext;
  meta: AllTransactionsRowMeta;
}) {
  const moreItems = ctx.resolveRowMoreItems(meta.task, meta.propertyId);
  const place = placeOf(meta);
  return (
    <Tr
      className={cn(
        "cursor-pointer",
        queueRowClassName({ active: false, opening: ctx.isTaskOpening(meta.task.id) }),
      )}
      onClick={() => ctx.handleRowClick(meta.task.id)}
    >
      <Td>
        {meta.transactionNumber ? (
          <div className="flex min-w-0 flex-col gap-0.5">
            <bdi
              dir="ltr"
              className={cn(MY_WORK_LONG_VALUE, "text-[13.5px] font-bold tabular-nums text-primary")}
            >
              {meta.transactionNumber}
            </bdi>
            {meta.transactionDeedCount > 1 ? (
              <span className="text-[12px] text-text-2">{meta.transactionDeedCount} صكوك</span>
            ) : null}
          </div>
        ) : (
          <Muted />
        )}
      </Td>
      <Td className="text-center">
        {meta.deed && meta.deed !== "—" ? (
          <bdi
            dir="ltr"
            className={cn(MY_WORK_LONG_VALUE, "text-[13px] font-semibold tabular-nums text-heading")}
          >
            {meta.deed}
          </bdi>
        ) : (
          <Muted />
        )}
      </Td>
      <Td className="text-center">
        <div className="flex min-w-0 flex-col items-center gap-0.5">
          {place ? (
            <span className={cn(MY_WORK_LONG_VALUE, "text-[13px] text-text")}>{place}</span>
          ) : (
            <Muted />
          )}
          {meta.propertyType ? (
            <span className={cn(MY_WORK_LONG_VALUE, "text-[12px] text-text-2")}>
              {meta.propertyType}
            </span>
          ) : null}
        </div>
      </Td>
      <Td className="text-center">
        <div className="flex min-w-0 flex-col items-center gap-0.5">
          <bdi dir="ltr" className={cn(MY_WORK_LONG_VALUE, "text-[13px] tabular-nums text-text")}>
            {meta.poNumber}
          </bdi>
          {meta.poDescription ? (
            <span
              className={cn(MY_WORK_LONG_VALUE, "line-clamp-2 text-[12px] text-text-2")}
              title={meta.poDescription}
            >
              {meta.poDescription}
            </span>
          ) : null}
        </div>
      </Td>
      <Td className="text-center">
        <StageText meta={meta} />
      </Td>
      <Td className="text-center">
        <MyWorkDates item={plainDates(meta)} />
      </Td>
      <QueueRowMoreCell items={moreItems} />
    </Tr>
  );
});

export function AllTransactionsQueueTable({
  ctx,
  filteredMeta,
}: {
  ctx: QueueRowContext;
  filteredMeta: AllTransactionsRowMeta[];
}) {
  return (
    <Table className="min-w-[900px] table-fixed" pending={ctx.queuePending}>
      <colgroup>
        {COLUMN_WIDTHS.map((width, i) => (
          <col key={i} style={width === null ? undefined : { width }} />
        ))}
      </colgroup>
      <THead>
        <Tr hoverable={false}>
          <Th>رقم المعاملة</Th>
          <Th className="text-center">
            رقم الصك /<br />
            التسجيل العيني
          </Th>
          <Th className="text-center">المدينة / الحي</Th>
          <Th className="text-center">أمر العمل</Th>
          <Th className="text-center">الحالة</Th>
          <Th className="text-center">
            تاريخ الاستلام /<br />
            الاستحقاق
          </Th>
          <Th>
            <span className="sr-only">المزيد</span>
          </Th>
        </Tr>
      </THead>
      <TBody>
        {ctx.showSkeleton ? (
          <SkeletonTableRows rows={6} cols={ALL_TRANSACTIONS_SKELETON_COLS} />
        ) : filteredMeta.length === 0 ? (
          <TableEmptyRow colSpan={ALL_TRANSACTIONS_SKELETON_COLS}>
            لا توجد عقارات مطابقة.
          </TableEmptyRow>
        ) : (
          filteredMeta.map((meta) => (
            <AllTransactionsRow
              key={meta.task.id}
              ctx={ctx}
              meta={meta}
            />
          ))
        )}
      </TBody>
    </Table>
  );
}

/** The phone's rows: «أعمالي»'s record cards — the state as the title. */
export function AllTransactionsMobileList({
  ctx,
  filteredMeta,
}: {
  ctx: QueueRowContext;
  filteredMeta: AllTransactionsRowMeta[];
}) {
  if (ctx.showSkeleton) {
    return (
      <div className="px-5 py-12 text-center">
        <GentleBusy>جاري التحميل…</GentleBusy>
      </div>
    );
  }
  if (filteredMeta.length === 0) {
    return <p className="py-8 text-center text-sm text-text-3">لا توجد عقارات مطابقة.</p>;
  }
  return (
    <MobileRecordList>
      {filteredMeta.map((meta) => {
        return (
          <MobileRecordCard
            key={meta.task.id}
            title={meta.phaseLabel}
            onOpen={() => ctx.handleRowClick(meta.task.id)}
            actions={<RowMoreMenu items={ctx.resolveRowMoreItems(meta.task, meta.propertyId)} />}
            fields={[
              { label: "رقم المعاملة", value: meta.transactionNumber || "—", ltr: true },
              { label: "رقم الصك / التسجيل العيني", value: meta.deed || "—", ltr: true },
              { label: "المدينة / الحي", value: placeOf(meta) || "—" },
              {
                label: "أمر العمل",
                value: (
                  <span className="flex flex-col">
                    <bdi dir="ltr">{meta.poNumber}</bdi>
                    {meta.poDescription ? (
                      <span className="text-[11px] text-text-2">{meta.poDescription}</span>
                    ) : null}
                  </span>
                ),
              },
              {
                label: "تاريخ الاستلام / الاستحقاق",
                value: <MyWorkDates item={plainDates(meta)} />,
              },
            ]}
          />
        );
      })}
    </MobileRecordList>
  );
}
