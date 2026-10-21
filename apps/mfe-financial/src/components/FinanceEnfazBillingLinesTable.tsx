"use client";

/** Enfaz work-order billing — the per-property fee lines (tracking table). Inputs lock once an invoice is issued. */

import { fmtSar } from "@platform/app-shared/format/number";
import type { PoEnfazRevenueLineDto } from "@platform/api-client";
import {
  Input,
  MobileRecordCard,
  MobileRecordList,
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

type LineProps = {
  line: PoEnfazRevenueLineDto;
  draft: LineDraft | undefined;
  issued: boolean;
  onPatch: (propertyId: string, patch: Partial<LineDraft>) => void;
};

type FeeField = "caseStudyFee" | "surveyFee" | "keyFee";

const FEE_ARIA: Record<FeeField, string> = {
  caseStudyFee: "دخل دراسة المعاملة",
  surveyFee: "دخل تكاليف الرفع",
  keyFee: "أتعاب المفاتيح",
};

/** One fee input — «—» on a cancelled line or a key fee without entitlement (table cell and phone card). */
function LineFeeInput({
  line,
  draft,
  issued,
  onPatch,
  field,
  className,
}: LineProps & { field: FeeField; className?: string }) {
  const cancelled = line.workStatus === "cancelled";
  if (cancelled || (field === "keyFee" && !line.hasKeyEntitlement)) return <Dash />;
  return (
    <Input
      type="number"
      min={0}
      className={cn("h-8 w-24 text-xs", className)}
      value={draft?.[field] ?? ""}
      disabled={issued}
      onChange={(e) => onPatch(line.propertyId, { [field]: e.target.value })}
      aria-label={`${FEE_ARIA[field]} ${line.propertyLabel}`}
    />
  );
}

/** «مشمول» checkbox (table cell and phone card). */
function LineIncludeCheck({ line, draft, issued, onPatch }: LineProps) {
  if (line.workStatus === "cancelled") return <Dash />;
  return (
    <input
      type="checkbox"
      className={opsCheckInput}
      checked={draft?.inc ?? true}
      disabled={issued}
      onChange={(e) => onPatch(line.propertyId, { inc: e.target.checked })}
      aria-label={`تضمين ${line.propertyLabel}`}
    />
  );
}

function LineStatusPill({ line }: { line: PoEnfazRevenueLineDto }) {
  return (
    <StatusPill
      label={line.workStatusLabel}
      style={finStatusStyle(line.workStatus === "done" ? "success" : "warning")}
    />
  );
}

function BillingLineRow(props: LineProps) {
  const { line, draft: d } = props;
  const cancelled = line.workStatus === "cancelled";
  return (
    <Tr hoverable={false} className={cn(cancelled && "opacity-50")}>
      <Td className="font-semibold text-heading">
        {line.propertyLabel}
        {line.hasKeyEntitlement ? (
          <span className="ms-1 text-[10px] text-text-3">· مفتاح</span>
        ) : null}
      </Td>
      <Td className="text-center">
        <LineStatusPill line={line} />
      </Td>
      <Td className="text-center">
        <LineFeeInput {...props} field="caseStudyFee" />
      </Td>
      <Td className="text-center">
        <LineFeeInput {...props} field="surveyFee" />
      </Td>
      <Td className="text-center">
        <LineFeeInput {...props} field="keyFee" />
      </Td>
      <TdLtr
        className="text-center"
        valueClassName="text-[14px] font-extrabold text-heading"
      >
        {cancelled ? "—" : fmtSar(lineTotal(d), { digits: 3, trim: true })}
      </TdLtr>
      <Td className="text-center">
        <LineIncludeCheck {...props} />
      </Td>
    </Tr>
  );
}

/** Phone card for one line — the fee inputs full-width with their labels, «مشمول» under them. */
function BillingLineCard(props: LineProps) {
  const { line, draft: d } = props;
  const cancelled = line.workStatus === "cancelled";
  return (
    <MobileRecordCard
      tone={cancelled ? "muted" : undefined}
      className={cn(cancelled && "opacity-50")}
      title={line.propertyLabel}
      subtitle={line.hasKeyEntitlement ? "مفتاح" : undefined}
      status={<LineStatusPill line={line} />}
      fields={[
        {
          label: "المجموع",
          ltr: true,
          value: cancelled ? "—" : fmtSar(lineTotal(d), { digits: 3, trim: true }),
        },
      ]}
    >
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["caseStudyFee", "دخل الدراسة"],
            ["surveyFee", "دخل الرفع"],
            ["keyFee", "مفاتيح"],
          ] as const
        ).map(([field, label]) => (
          <div key={field} className="flex min-w-0 flex-col gap-1">
            <span className="text-[11px] font-medium text-text-3">{label}</span>
            <LineFeeInput {...props} field={field} className="h-10 w-full" />
          </div>
        ))}
      </div>
      {cancelled ? null : (
        <label className="mt-2.5 flex min-h-10 items-center gap-2.5 text-[13px] font-semibold text-text">
          <LineIncludeCheck {...props} />
          مشمول
        </label>
      )}
    </MobileRecordCard>
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
    <>
    {/* Phones: one editable card per line — the 7-column input table ran off-screen. */}
    <MobileRecordList className="lg:hidden">
      {lines.map((line) => (
        <BillingLineCard
          key={line.propertyId}
          line={line}
          draft={draft[line.propertyId]}
          issued={issued}
          onPatch={onPatch}
        />
      ))}
    </MobileRecordList>
    <TableFrame className="max-lg:hidden">
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
    </>
  );
}
