"use client";

import { memo, useEffect, useRef, useState } from "react";
import type {
  ComparablePropertyDto,
  ValuationComparableSelectionDto,
} from "@platform/api-client";
import {
  cn,
  Table,
  TableEmptyRow,
  TBody,
  Td,
  TdLtr,
  Th,
  THead,
  Tr,
} from "@platform/ui-kit";
import { Card } from "./atoms";
import {
  areaRatio,
  areaRatioValue,
  sourceCardLine,
} from "./lib/bank-ranking";
import { fmt } from "./lib/shell-utils";

export type ComparablesBankRow = {
  key: string;
  selected: boolean;
  adopted: boolean;
  comp: ComparablePropertyDto;
  item?: ValuationComparableSelectionDto;
};

/**
 * Comparables bank — owns search and compEdit drafts locally so typing does not
 * re-render the whole valuation shell; search fetches bank candidates only (no full reload).
 */
export const ComparablesBankTable = memo(function ComparablesBankTable({
  rows,
  subjectSqm,
  adoptedCount,
  maxAdopted,
  distanceKm,
  onAdopt,
  onSearch,
  onSaveOverride,
}: {
  rows: ComparablesBankRow[];
  subjectSqm: number | null;
  adoptedCount: number;
  maxAdopted: number;
  distanceKm: Record<string, number>;
  onAdopt: (comparableId: string, adopted: boolean) => void;
  /** Market context only — when absent, show a vacant-land badge instead of the search field. */
  onSearch?: (q: string) => void;
  /** Returns true on successful save — the cell draft is cleared then. */
  onSaveOverride: (
    item: ValuationComparableSelectionDto,
    field: "price" | "area",
    raw: string,
  ) => Promise<boolean>;
}) {
  const [q, setQ] = useState("");
  /** compEdit: price/area edit drafts for the comparable — local to the table. */
  const [editDraft, setEditDraft] = useState<Record<string, string>>({});
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;
  const firstSearch = useRef(true);

  // Soft refresh when bank search query changes (no full-screen blank).
  useEffect(() => {
    if (firstSearch.current) {
      firstSearch.current = false;
      return;
    }
    const t = window.setTimeout(() => onSearchRef.current?.(q), 280);
    return () => window.clearTimeout(t);
  }, [q]);

  const saveOverride = (
    item: ValuationComparableSelectionDto,
    field: "price" | "area",
    raw: string,
  ) => {
    void onSaveOverride(item, field, raw).then((ok) => {
      if (!ok) return;
      // Draft served its purpose — effective server value shows after silent reload.
      setEditDraft((prev) => {
        const next = { ...prev };
        delete next[`${item.id}:${field}`];
        return next;
      });
    });
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <h2 className="m-0 text-[17px] font-extrabold text-heading">
            بنك المقارنات
          </h2>
          <span className="inline-flex items-center rounded-md bg-gold-soft px-2.5 py-[3px] text-[12px] font-bold text-gold-d">
            {adoptedCount} من {maxAdopted} معتمدة
          </span>
          <span className="hidden text-[11.5px] text-text-3 md:inline">
            ضمن ٥ كم إن وُجد — وإلا من البنك مرتّبًا حسب أقرب مساحة، ثم المسافة
          </span>
        </div>
        {onSearch ? (
          <input
            placeholder="بحث حي / نوع / رقم مرجعي"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-[248px] rounded-lg border border-border-md bg-surface px-3.5 py-2 text-[13px] font-medium text-text outline-none transition-[border-color,box-shadow] placeholder:text-text-3 focus:border-gold focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--gold)_22%,transparent)]"
          />
        ) : (
          <span className="text-[12px] text-text-3">
            أراضٍ فضاء فقط — لا استيراد من أسلوب السوق
          </span>
        )}
      </div>
      <Card className="mb-6">
        <Table className="min-w-[1180px]" wrapClassName="rounded-xl">
          <THead>
            <Tr hoverable={false}>
              <Th className="w-[70px] text-center">اعتماد</Th>
              <Th className="min-w-[132px]">الرقم المرجعي</Th>
              <Th className="min-w-[100px] text-center">نوع العقار</Th>
              <Th className="min-w-[122px] text-center">نوع المقارن</Th>
              <Th className="w-[112px] text-center">تاريخ المقارن</Th>
              <Th className="min-w-[96px] bg-gold-soft text-center">
                سعر المتر
              </Th>
              <Th className="min-w-[108px] text-center">سعر العقار</Th>
              <Th className="w-[92px] text-center">المساحة (م²)</Th>
              <Th className="w-[88px] text-center">نسبة المساحة</Th>
              <Th className="w-[72px] text-center">المسافة</Th>
              <Th className="min-w-[84px]">الحي</Th>
              <Th className="min-w-[120px]">المصدر</Th>
            </Tr>
          </THead>
          <TBody>
            {rows.map((row) => (
              <Tr
                key={row.key}
                hoverable={!row.adopted}
                className={cn(row.adopted && "bg-gold-soft")}
              >
                <Td className="text-center">
                  <input
                    type="checkbox"
                    checked={row.adopted}
                    onChange={(e) => onAdopt(row.comp.id, e.target.checked)}
                    className="size-[17px] cursor-pointer accent-[var(--ink)]"
                  />
                </Td>
                <TdLtr
                  valueClassName="text-[13.5px] font-bold text-gold-d"
                >
                  {row.comp.referenceCode}
                </TdLtr>
                <Td className="text-center">
                  <span className="text-[13px] text-text">
                    {row.comp.comparablePropertyType}
                  </span>
                </Td>
                <Td className="text-center">
                  <span className="inline-flex items-center rounded-md border border-border-md bg-surface-2 px-[11px] py-[3px] text-[12px] font-medium text-text-2">
                    {row.comp.transactionKindLabelAr}
                  </span>
                </Td>
                <TdLtr className="text-center" valueClassName="text-[13px] text-text-2">
                  {row.comp.transactionDate?.slice(0, 10) || "—"}
                </TdLtr>
                <TdLtr
                  className="bg-gold-soft text-center"
                  valueClassName="text-[14px] font-extrabold text-heading"
                >
                  {fmt(row.item?.effectivePricePerSqm ?? row.comp.pricePerSqm)}
                </TdLtr>
                <Td className="text-center">
                  {row.item ? (
                    <input
                      dir="ltr"
                      type="text"
                      title="سعر العقار الإجمالي — تجاوز لهذا التقييم فقط، لا يمس بنك المقارنات"
                      value={
                        editDraft[`${row.item.id}:price`] ??
                        String(row.item.effectivePriceSar ?? row.comp.price)
                      }
                      onChange={(e) =>
                        setEditDraft((prev) => ({
                          ...prev,
                          [`${row.item!.id}:price`]: e.target.value.replace(
                            /[^\d.]/g,
                            "",
                          ),
                        }))
                      }
                      onBlur={(e) =>
                        saveOverride(row.item!, "price", e.target.value)
                      }
                      className={cn(
                        "w-[104px] rounded-md border px-2 py-1.5 text-center text-[13.5px] font-extrabold outline-none",
                        row.item.priceOverrideSar != null
                          ? "border-border-md bg-surface text-heading"
                          : "border-border bg-surface-2 text-text-2",
                      )}
                    />
                  ) : (
                    <span dir="ltr" className="text-[14px] font-extrabold text-heading">
                      {fmt(row.comp.price)}
                    </span>
                  )}
                </Td>
                {row.item ? (
                  <Td className="text-center">
                    <input
                      dir="ltr"
                      type="text"
                      title="مساحة المقارن — تجاوز لهذا التقييم فقط"
                      value={
                        editDraft[`${row.item.id}:area`] ??
                        String(row.item.effectiveAreaSqm ?? row.comp.areaSqm)
                      }
                      onChange={(e) =>
                        setEditDraft((prev) => ({
                          ...prev,
                          [`${row.item!.id}:area`]: e.target.value.replace(
                            /[^\d.]/g,
                            "",
                          ),
                        }))
                      }
                      onBlur={(e) =>
                        saveOverride(row.item!, "area", e.target.value)
                      }
                      className={cn(
                        "w-[84px] rounded-md border px-2 py-1.5 text-center text-[13px] font-bold outline-none",
                        row.item.areaOverrideSqm != null
                          ? "border-border-md bg-surface text-heading"
                          : "border-border bg-surface-2 text-text-2",
                      )}
                    />
                  </Td>
                ) : (
                  <TdLtr
                    bare
                    className="text-center text-[13.5px] font-bold text-text-2"
                  >
                    {fmt(row.comp.areaSqm)}
                  </TdLtr>
                )}
                {(() => {
                  const effArea = row.item?.effectiveAreaSqm ?? row.comp.areaSqm;
                  const ratio = areaRatioValue(subjectSqm, effArea);
                  return (
                    <TdLtr
                      bare
                      className={cn(
                        "text-center text-[13.5px] font-bold",
                        ratio != null && ratio >= 2
                          ? "text-red-text"
                          : "text-heading",
                      )}
                      title={
                        ratio != null && ratio >= 2
                          ? "نسبة ≥ ٢ — تُفعِّل طريقة المضاعف على الجدول كاملاً"
                          : undefined
                      }
                    >
                      {areaRatio(subjectSqm, effArea)}
                    </TdLtr>
                  );
                })()}
                {(() => {
                  const km = distanceKm[row.comp.id];
                  return (
                    <TdLtr
                      bare
                      className="text-center text-[12.5px] text-text-2"
                    >
                      {km != null && Number.isFinite(km)
                        ? `${km.toFixed(km < 1 ? 2 : 1)} كم`
                        : "—"}
                    </TdLtr>
                  );
                })()}
                <Td>
                  <span className="truncate text-[13px] text-text-2">
                    {row.comp.district}
                  </span>
                </Td>
                <Td>
                  <span className="truncate text-[11.5px] text-text-3">
                    {sourceCardLine(row.comp)}
                  </span>
                </Td>
              </Tr>
            ))}
            {rows.length === 0 ? (
              <TableEmptyRow colSpan={12}>
                لا مرشحين — أضف إلى البنك من صفحة بنك المقارنات.
              </TableEmptyRow>
            ) : null}
          </TBody>
        </Table>
      </Card>
    </>
  );
});
