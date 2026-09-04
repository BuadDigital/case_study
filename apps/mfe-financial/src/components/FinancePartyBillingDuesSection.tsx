"use client";

import {
  EmptyState,
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
  opsBtnPrimary,
  opsCheckInput,
  opsLetterCard,
  opsSearchInput,
} from "@platform/ui-kit";

import {
  applyCostTax,
  daysSinceIsoCost,
  lineRefMain,
  lineRefSub,
} from "../lib/finance-cost-parties";
import { finSearch, finSearchIcon } from "../lib/finance-tw";
import { formatSar } from "./FinancePartyBillingParts";
import type { PartyBillingStatementsWorkflow } from "./usePartyBillingStatementsWorkflow";

/**
 * Outstanding dues: search, group select and the selectable line table. Every
 * selection and total comes from the party-billing workflow.
 */
export function FinancePartyBillingDuesSection({
  workflow,
}: {
  workflow: PartyBillingStatementsWorkflow;
}) {
  const {
    duesSearch,
    setDuesSearch,
    deferredDuesSearch,
    filteredDues,
    payableDues,
    readyLines,
    readyQuery,
    selected,
    selectedTotal,
    busy,
    toggle,
    selectGroup,
    createStatement,
  } = workflow;

  return (
    <section>
      <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
        <div className={cn(finSearch, "ms-0 max-w-none min-w-[200px] flex-1")}>
          <svg
            className={finSearchIcon}
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
          >
            <circle
              cx="11"
              cy="11"
              r="7"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <path
              d="M20 20l-3.5-3.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          <input
            className={opsSearchInput}
            placeholder="بحث: رقم الصك · المنطقة · رقم الطلب"
            value={duesSearch}
            onChange={(e) => setDuesSearch(e.target.value)}
            aria-label="بحث المستحقات"
          />
        </div>
        <button
          type="button"
          className={cn(
            opsBtnGhost,
            "h-auto px-3.5 py-2 text-xs",
            filteredDues.length === 0 && "pointer-events-none opacity-50",
          )}
          onClick={() => {
            const allOn =
              payableDues.length > 0 &&
              payableDues.every((l) => selected.has(l.workflowTaskId));
            selectGroup(payableDues, !allOn);
          }}
        >
          {filteredDues.length > 0 &&
          payableDues.every((l) => selected.has(l.workflowTaskId))
            ? "إلغاء التحديد"
            : `تحديد الكل (${payableDues.length})`}
        </button>
        <button
          type="button"
          className={cn(
            opsBtnPrimary,
            "px-4 py-2 text-[12.5px]",
            selected.size === 0 && "pointer-events-none opacity-50",
          )}
          disabled={busy || selected.size === 0}
          onClick={() => void createStatement()}
        >
          تجهيز{" "}
          {readyLines[0]?.payeeType === "individual" ? "أمر صرف" : "مسير صرف"}
          {selected.size > 0
            ? ` (${selected.size} — ${formatSar(
                applyCostTax(
                  selectedTotal,
                  readyLines[0]?.payeeType === "individual"
                    ? "individual"
                    : "vendor",
                ),
              )})`
            : ""}
        </button>
        <span className="text-[11px] whitespace-nowrap text-text-3">
          {filteredDues.length} مستحق ·{" "}
          <b
            className={
              payableDues.length > 0
                ? "text-heading"
                : "text-[#8a5e14]"
            }
          >
            {payableDues.length}
          </b>{" "}
          جاهز للصرف
        </span>
      </div>

      {readyQuery.isPending ? (
        <div className={opsLetterCard}>
          <EmptyState panel line="جاري التحميل…" />
        </div>
      ) : filteredDues.length === 0 ? (
        <div className={opsLetterCard}>
          <EmptyState
            panel
            line={
              deferredDuesSearch.trim()
                ? "لا بنود مطابقة للبحث"
                : "لا مستحقات قائمة — كل البنود مُدرجة في مستندات صرف"
            }
            hint="تظهر هنا بنود المعاينة والمراجعة والرفع المساحي بحالة جاهز أو مرحَّل."
          />
        </div>
      ) : (
        <TableFrame>
          <Table wrapClassName="max-h-[calc(100vh-290px)] overflow-auto">
            <THead>
              <Tr hoverable={false}>
                <Th className="sticky top-0 z-[3] w-12 bg-surface-2" />
                <Th className="sticky top-0 z-[3] bg-surface-2">المعاملة</Th>
                <Th className="sticky top-0 z-[3] bg-surface-2 text-center">
                  سعر الجدول
                </Th>
                <Th className="sticky top-0 z-[3] bg-surface-2 text-center">
                  تعديل التسعير
                </Th>
                <Th className="sticky top-0 z-[3] bg-surface-2 text-center">
                  الصافي
                </Th>
              </Tr>
            </THead>
            <TBody>
              {filteredDues.map((line) => {
                const on = selected.has(line.workflowTaskId);
                const age = daysSinceIsoCost(
                  line.accruedAtUtc ?? line.updatedAtUtc,
                );
                const ded = line.supervisorDiscountSar || 0;
                const list = line.agreedFeeSar || line.netFeeSar;
                const selectable = line.netFeeSar > 0;
                const rowKey = `${line.workflowTaskId}:${line.propertyId ?? "po"}`;
                return (
                  <Tr
                    key={rowKey}
                    hoverable={false}
                    role={selectable ? "button" : undefined}
                    tabIndex={selectable ? 0 : undefined}
                    className={cn(
                      selectable && "cursor-pointer",
                      !selectable && "opacity-70",
                      on &&
                        "bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]",
                    )}
                    onClick={() => selectable && toggle(line.workflowTaskId)}
                    onKeyDown={(e) => {
                      if (!selectable) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggle(line.workflowTaskId);
                      }
                    }}
                  >
                    <Td>
                      {selectable ? (
                        <input
                          type="checkbox"
                          className={opsCheckInput}
                          checked={on}
                          onChange={() => toggle(line.workflowTaskId)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label="تحديد البند"
                        />
                      ) : (
                        <span
                          className="inline-block h-[17px] w-[17px] rounded-[5px] border-2 border-dashed border-border-md"
                          title="صافي صفر"
                        />
                      )}
                    </Td>
                    <Td>
                      <div className="flex min-w-0 flex-col items-end gap-0.5 text-end">
                        <span
                          className="text-[12.5px] font-bold text-gold-d"
                          dir="ltr"
                        >
                          {lineRefMain(line)}
                        </span>
                        <span className="text-[11px] text-text-3">
                          {lineRefSub(line)}
                          {selectable && age != null ? (
                            <>
                              {" · "}
                              <span
                                className={
                                  age > 30
                                    ? "font-semibold text-[#a5432e]"
                                    : "font-semibold text-text-3"
                                }
                              >
                                منذ {age} يوماً
                              </span>
                            </>
                          ) : null}
                          {!selectable ? (
                            <span className="font-bold text-[#8a5e14]">
                              {" "}
                              · صافي صفر — يُقفل بتسوية
                            </span>
                          ) : null}
                        </span>
                      </div>
                    </Td>
                    <TdLtr
                      className="text-center"
                      valueClassName="text-[12.5px] text-text-2"
                    >
                      {formatSar(list)}
                    </TdLtr>
                    <Td className="text-center">
                      {ded > 0 ? (
                        <span className="text-xs font-bold text-[#c0553d] tabular-nums">
                          −{formatSar(ded)}
                        </span>
                      ) : (
                        <span className="text-xs text-text-3">—</span>
                      )}
                    </Td>
                    <TdLtr
                      className="text-center"
                      valueClassName="text-[13px] font-bold text-heading"
                    >
                      {formatSar(line.netFeeSar)}
                    </TdLtr>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </TableFrame>
      )}
    </section>
  );
}
