"use client";

/** Court-visit delegation letter rows — desktop table plus the mobile card list. */

import { cn, Table, TableFrame, TBody, Td, TdLtr, Th, THead, Tr, opsPanelCard } from "@platform/ui-kit";
import { PROPERTY_IDENTIFIER_COLUMN_LABEL } from "../lib/app-data/po-intake-data";
import type { OperationsTask } from "../lib/app-data/operations-tasks-model";

export function LetterTable({ rows }: { rows: OperationsTask["letterRows"] }) {
  if (rows.length === 0) {
    return (
      <div className="p-6 text-center text-[12.5px] text-text-3">
        اختر الصكوك المرتبطة لعرض معاينة الخطاب.
      </div>
    );
  }
  return (
    <>
      <TableFrame className="hidden lg:block">
        <Table wrapClassName="min-w-[760px]">
          <THead>
            <Tr hoverable={false}>
              <Th className="w-11 text-center">م</Th>
              <Th>أمر العمل</Th>
              <Th>{PROPERTY_IDENTIFIER_COLUMN_LABEL}</Th>
              <Th>المالك</Th>
              <Th>رقم الطلب</Th>
              <Th>المحكمة / الدائرة</Th>
            </Tr>
          </THead>
          <TBody>
            {rows.map((row, i) => (
              <Tr key={`${row.po}-${row.deed}-${i}`} hoverable={false}>
                <Td className="text-center text-text-2">{i + 1}</Td>
                <TdLtr className="font-semibold text-text-2">{row.po}</TdLtr>
                <TdLtr
                  className="font-bold text-gold-d"
                  valueClassName="max-w-full truncate tracking-tight"
                >
                  صك {row.deed}
                </TdLtr>
                <Td className="font-medium text-heading">
                  <span className="line-clamp-2 break-words">{row.owner}</span>
                </Td>
                <TdLtr className="font-semibold text-text-2">
                  {row.request || "—"}
                </TdLtr>
                <Td>
                  <span className="line-clamp-2 break-words">
                    <span className="font-semibold text-text">{row.court}</span>
                    {row.circuit ? (
                      <span className="text-text-3"> · {row.circuit}</span>
                    ) : null}
                  </span>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </TableFrame>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0 lg:hidden">
        {rows.map((row, i) => (
          <li
            key={`${row.po}-${row.deed}-m-${i}`}
            className={cn(opsPanelCard, "rounded-[12px] border-s-4 border-s-info px-3.5 py-3")}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-text-3">#{i + 1}</span>
              <span className="text-[12.5px] font-bold text-gold-d" dir="ltr">
                صك {row.deed}
              </span>
            </div>
            <div className="space-y-1.5 text-[12.5px]">
              <div className="flex justify-between gap-3">
                <span className="text-text-3">أمر العمل</span>
                <span className="font-semibold text-text-2" dir="ltr">
                  {row.po}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-text-3">المالك</span>
                <span className="text-end font-semibold text-heading">
                  {row.owner}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-text-3">رقم الطلب</span>
                <span className="font-semibold text-text-2" dir="ltr">
                  {row.request || "—"}
                </span>
              </div>
              <div className="pt-1 text-[12px] text-text-2">
                <span className="font-semibold text-text">{row.court}</span>
                <span className="text-text-3"> · {row.circuit}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
