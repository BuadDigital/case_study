"use client";

import { memo, useEffect, useRef, useState } from "react";
import type {
  ComparablePropertyDto,
  ValuationComparableSelectionDto,
} from "@platform/api-client";
import { cn } from "@platform/ui-kit";
import { BankTd, BankTh, Card } from "./atoms";
import {
  BANK_COLS,
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
 * بنك المقارنات — يملك حقل البحث ومسودات compEdit محلياً حتى لا تعيد الكتابة
 * رسم صدفة التقييم كاملة، والبحث يجلب مرشحي البنك فقط (لا إعادة تحميل شاملة).
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
  /** سياق السوق فقط — غيابه يعرض شارة «أراضٍ فضاء» بدل حقل البحث. */
  onSearch?: (q: string) => void;
  /** يعيد true عند نجاح الحفظ — عندها تُمسح مسودة الخلية. */
  onSaveOverride: (
    item: ValuationComparableSelectionDto,
    field: "price" | "area",
    raw: string,
  ) => Promise<boolean>;
}) {
  const [q, setQ] = useState("");
  /** compEdit: مسودات تعديل سعر/مساحة المقارن — محلية للجدول. */
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
      // المسودة أدّت غرضها — القيمة الفعلية من الخادم تعرض بعد التحديث الصامت.
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
            ضمن ٥ كم من الموقع — يُرتَّب حسب أقرب مساحة لعقار التقييم، ثم المسافة
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
        <div className="overflow-x-auto rounded-xl">
          <div className="min-w-[1180px]">
            <div
              className="grid border-b-2 border-gold bg-surface-2"
              style={{ gridTemplateColumns: BANK_COLS }}
            >
              <BankTh start>اعتماد</BankTh>
              <BankTh>الرقم المرجعي</BankTh>
              <BankTh>نوع العقار</BankTh>
              <BankTh>نوع المقارن</BankTh>
              <BankTh>تاريخ المقارن</BankTh>
              <BankTh highlight>سعر المتر</BankTh>
              <BankTh>سعر العقار</BankTh>
              <BankTh>المساحة (م²)</BankTh>
              <BankTh>نسبة المساحة</BankTh>
              <BankTh>المسافة</BankTh>
              <BankTh>الحي</BankTh>
              <BankTh>المصدر</BankTh>
            </div>
            {rows.map((row) => (
              <div
                key={row.key}
                className={cn(
                  "grid min-h-[58px] items-center border-b border-border transition-colors duration-100 last:border-b-0 hover:bg-row-hover",
                  row.adopted && "bg-gold-soft",
                )}
                style={{ gridTemplateColumns: BANK_COLS }}
              >
                <BankTd start>
                  <input
                    type="checkbox"
                    checked={row.adopted}
                    onChange={(e) => onAdopt(row.comp.id, e.target.checked)}
                    className="size-[17px] cursor-pointer accent-[var(--ink)]"
                  />
                </BankTd>
                <BankTd>
                  <span dir="ltr" className="text-[13.5px] font-bold text-gold-d">
                    {row.comp.referenceCode}
                  </span>
                </BankTd>
                <BankTd>
                  <span className="text-[13px] text-text">
                    {row.comp.comparablePropertyType}
                  </span>
                </BankTd>
                <BankTd>
                  <span className="inline-flex items-center rounded-md border border-border-md bg-surface-2 px-[11px] py-[3px] text-[12px] font-medium text-text-2">
                    {row.comp.transactionKindLabelAr}
                  </span>
                </BankTd>
                <BankTd>
                  <span dir="ltr" className="text-[13px] text-text-2">
                    {row.comp.transactionDate?.slice(0, 10) || "—"}
                  </span>
                </BankTd>
                <BankTd highlight>
                  <span
                    dir="ltr"
                    className="text-[14px] font-extrabold text-heading"
                  >
                    {fmt(row.item?.effectivePricePerSqm ?? row.comp.pricePerSqm)}
                  </span>
                </BankTd>
                <BankTd>
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
                    <span
                      dir="ltr"
                      className="text-[14px] font-extrabold text-heading"
                    >
                      {fmt(row.comp.price)}
                    </span>
                  )}
                </BankTd>
                <BankTd>
                  {row.item ? (
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
                  ) : (
                    <span dir="ltr" className="text-[13.5px] font-bold text-text-2">
                      {fmt(row.comp.areaSqm)}
                    </span>
                  )}
                </BankTd>
                <BankTd>
                  {(() => {
                    const effArea = row.item?.effectiveAreaSqm ?? row.comp.areaSqm;
                    const ratio = areaRatioValue(subjectSqm, effArea);
                    return (
                      <span
                        dir="ltr"
                        className={cn(
                          "text-[13.5px] font-bold",
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
                      </span>
                    );
                  })()}
                </BankTd>
                <BankTd>
                  {(() => {
                    const km = distanceKm[row.comp.id];
                    return (
                      <span dir="ltr" className="text-[12.5px] text-text-2">
                        {km != null && Number.isFinite(km)
                          ? `${km.toFixed(km < 1 ? 2 : 1)} كم`
                          : "—"}
                      </span>
                    );
                  })()}
                </BankTd>
                <BankTd>
                  <span className="truncate text-[13px] text-text-2">
                    {row.comp.district}
                  </span>
                </BankTd>
                <BankTd>
                  <span className="truncate text-[11.5px] text-text-3">
                    {sourceCardLine(row.comp)}
                  </span>
                </BankTd>
              </div>
            ))}
            {rows.length === 0 ? (
              <div className="px-4 py-10 text-center text-[13px] text-text-3">
                لا مرشحين — أضف إلى البنك من صفحة بنك المقارنات.
              </div>
            ) : null}
          </div>
        </div>
      </Card>
    </>
  );
});
