"use client";

/** Enfaz work-order billing — the per-property fee lines (tracking table). Inputs lock once an invoice is issued. */

import type { PoEnfazRevenueLineDto } from "@platform/api-client";
import {
  Input,
  StatusPill,
  TBody,
  THead,
  Table,
  TableFrame,
  Td,
  TdLtr,
  Th,
  Tr,
  cn,
  finStatusStyle,
  opsCheckInput,
} from "@platform/ui-kit";
import {
  lineTotal,
  type LineDraft,
  type LineDraftMap,
} from "../lib/finance-enfaz-po-billing-state";
import { finMuted } from "../lib/finance-tw";

function Dash() {
  return <span className={finMuted}>—</span>;
}

function BillingLineRow({
  line,
  draft,
  issued,
  onPatch,
}: {
  line: PoEnfazRevenueLineDto;
  draft: LineDraft | undefined;
  issued: boolean;
  onPatch: (propertyId: string, patch: Partial<LineDraft>) => void;
}) {
  const cancelled = line.workStatus === "cancelled";
  const d = draft;
  return (
    <Tr hoverable={false} className={cn(cancelled && "opacity-50")}>
      <Td className="font-semibold text-heading">
        {line.propertyLabel}
        {line.hasKeyEntitlement ? (
          <span className="ms-1 text-[10px] text-text-3">· مفتاح</span>
        ) : null}
      </Td>
      <Td className="text-center">
        <StatusPill
          label={line.workStatusLabel}
          style={finStatusStyle(line.workStatus === "done" ? "success" : "warning")}
        />
      </Td>
      <Td className="text-center">
        {cancelled ? (
          <Dash />
        ) : (
          <Input
            type="number"
            min={0}
            className="h-8 w-24 text-xs"
            value={d?.caseStudyFee ?? ""}
            disabled={issued}
            onChange={(e) =>
              onPatch(line.propertyId, { caseStudyFee: e.target.value })
            }
            aria-label={`دخل دراسة المعاملة ${line.propertyLabel}`}
          />
        )}
      </Td>
      <Td className="text-center">
        {cancelled ? (
          <Dash />
        ) : (
          <Input
            type="number"
            min={0}
            className="h-8 w-24 text-xs"
            value={d?.surveyFee ?? ""}
            disabled={issued}
            onChange={(e) =>
              onPatch(line.propertyId, { surveyFee: e.target.value })
            }
            aria-label={`دخل تكاليف الرفع ${line.propertyLabel}`}
          />
        )}
      </Td>
      <Td className="text-center">
        {cancelled ? (
          <Dash />
        ) : line.hasKeyEntitlement ? (
          <Input
            type="number"
            min={0}
            className="h-8 w-24 text-xs"
            value={d?.keyFee ?? ""}
            disabled={issued}
            onChange={(e) =>
              onPatch(line.propertyId, { keyFee: e.target.value })
            }
            aria-label={`أتعاب المفاتيح ${line.propertyLabel}`}
          />
        ) : (
          <Dash />
        )}
      </Td>
      <TdLtr
        className="text-center"
        valueClassName="text-[14px] font-extrabold text-heading"
      >
        {cancelled ? "—" : `${lineTotal(d).toLocaleString("en-US")} ر.س`}
      </TdLtr>
      <Td className="text-center">
        {cancelled ? (
          <Dash />
        ) : (
          <input
            type="checkbox"
            className={opsCheckInput}
            checked={d?.inc ?? true}
            disabled={issued}
            onChange={(e) =>
              onPatch(line.propertyId, { inc: e.target.checked })
            }
            aria-label={`تضمين ${line.propertyLabel}`}
          />
        )}
      </Td>
    </Tr>
  );
}

export function FinanceEnfazBillingLinesTable({
  lines,
  draft,
  issued,
  onPatch,
}: {
  lines: PoEnfazRevenueLineDto[];
  draft: LineDraftMap;
  issued: boolean;
  onPatch: (propertyId: string, patch: Partial<LineDraft>) => void;
}) {
  return (
    <TableFrame>
      <Table className="min-w-[640px]">
        <THead>
          <Tr hoverable={false}>
            <Th>المعاملة</Th>
            <Th className="text-center">الحالة</Th>
            <Th className="text-center">دخل الدراسة</Th>
            <Th className="text-center">دخل الرفع</Th>
            <Th className="text-center">مفاتيح</Th>
            <Th className="text-center">المجموع</Th>
            <Th className="text-center">مشمول</Th>
          </Tr>
        </THead>
        <TBody>
          {lines.map((line) => (
            <BillingLineRow
              key={line.propertyId}
              line={line}
              draft={draft[line.propertyId]}
              issued={issued}
              onPatch={onPatch}
            />
          ))}
        </TBody>
      </Table>
    </TableFrame>
  );
}
