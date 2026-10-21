"use client";

/**
 * Phone layout of the comparable bank (`ComparablePropertiesView`): the toolbar
 * stacked full width, and each comparable as a `MobileRecordCard` with labelled
 * fields instead of the desktop's dot-joined run-on line. Rendered `lg:hidden`;
 * the desktop list stays behind `max-lg:hidden`.
 */

import { fmtSar } from "@platform/app-shared/format/number";
import type { ComparablePropertyDto } from "@platform/api-client";
import {
  cn,
  MobileRecordCard,
  MobileRecordList,
  type MobileRecordField,
} from "@platform/ui-kit";
import {
  opsBtnGhost,
  opsBtnPrimary,
  opsFld,
  opsFldControl,
  opsTfLbl,
} from "../lib/comparables-ops-tw";
import { TagEditorRow } from "./TagEditorRow";

const pill =
  "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold";

const deactivateBtn =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-[9px] border border-border-md bg-surface px-3.5 py-2 font-[inherit] text-[12.5px] font-semibold text-[#d9694f] transition-colors enabled:hover:border-[#d9694f]/40 enabled:hover:bg-danger-bg disabled:cursor-not-allowed disabled:opacity-50";
const reactivateBtn =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-[9px] border border-border-md bg-surface px-3.5 py-2 font-[inherit] text-[12.5px] font-semibold text-gold-d transition-colors enabled:hover:border-gold/40 enabled:hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-50";

export function ComparableBankPhoneToolbar({
  q,
  onQ,
  showInactive,
  onShowInactive,
  showForm,
  onReload,
  onToggleForm,
}: {
  q: string;
  onQ: (v: string) => void;
  showInactive: boolean;
  onShowInactive: (v: boolean) => void;
  showForm: boolean;
  onReload: () => void;
  onToggleForm: () => void;
}) {
  return (
    <div className="mb-3.5 flex flex-col gap-2.5 lg:hidden">
      <div className={cn(opsFld, "w-full")}>
        <label htmlFor="comparables_bank_q_phone" className={opsTfLbl}>
          بحث
        </label>
        <input
          id="comparables_bank_q_phone"
          className={cn(opsFldControl, "w-full")}
          value={q}
          onChange={(e) => onQ(e.target.value)}
          placeholder="مرجع / نوع / حي / إعلان…"
        />
      </div>
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-[10px] border border-border-md bg-surface px-3.5 text-[13px] font-semibold text-text-2">
        إظهار المعطّلة
        <input
          type="checkbox"
          className="size-5 accent-[var(--gold-d)]"
          checked={showInactive}
          onChange={(e) => onShowInactive(e.target.checked)}
        />
      </label>
      <button
        type="button"
        className={cn(opsBtnGhost, "min-h-11 w-full justify-center")}
        onClick={onReload}
      >
        تحديث
      </button>
      <button
        type="button"
        className={cn(opsBtnPrimary, "min-h-11 w-full justify-center")}
        onClick={onToggleForm}
      >
        {showForm ? "إخفاء النموذج" : "إضافة مقارن"}
      </button>
    </div>
  );
}

function statusPills(row: ComparablePropertyDto) {
  const pills = [
    row.reliabilityTag !== "normal" ? (
      <span key="rel" className={cn(pill, "bg-gold-soft text-gold-d")}>
        {row.reliabilityTagLabelAr}
      </span>
    ) : null,
    row.isDuplicateTagged ? (
      <span key="dup" className={cn(pill, "bg-gold-soft text-gold-d")}>
        مكرر
      </span>
    ) : null,
    row.duplicateSuspect && !row.isDuplicateTagged ? (
      <span
        key="sus"
        className={cn(pill, "border border-border-md font-semibold text-text-2")}
      >
        اشتباه تكرار
      </span>
    ) : null,
    !row.isActive ? (
      <span key="off" className={cn(pill, "bg-surface-2 font-semibold text-text-3")}>
        معطّل
      </span>
    ) : null,
  ].filter(Boolean);
  if (pills.length === 0) return undefined;
  return <div className="flex max-w-[9rem] flex-wrap justify-end gap-1">{pills}</div>;
}

function sourceText(row: ComparablePropertyDto) {
  const c = row.sourceCard;
  let text = `${c.intakeChannelLabelAr} · ${c.freshnessLabelAr}`;
  if (c.fromPriorDeal) {
    text += ` · من معاملة سابقة${
      c.sourceWorkOrderNumber ? ` (${c.sourceWorkOrderNumber})` : ""
    }`;
  }
  return text;
}

function rowFields(row: ComparablePropertyDto): MobileRecordField[] {
  const fields: MobileRecordField[] = [
    {
      label: "الحالة / النوع",
      value: `${row.transactionKindLabelAr}${
        row.priceDescriptionLabelAr ? ` / ${row.priceDescriptionLabelAr}` : ""
      }`,
    },
    { label: "الحي", value: row.district || "—" },
    { label: "المدينة", value: row.city || "—" },
    { label: "التاريخ", value: row.transactionDate || "—", ltr: true },
    { label: "المساحة", value: `${row.areaSqm} م²`, ltr: true },
    { label: "السعر", value: fmtSar(row.price, { digits: 3, trim: true }), ltr: true },
    {
      label: "سعر المتر",
      value: `${fmtSar(row.pricePerSqm, { digits: 3, trim: true })}/م²`,
      ltr: true,
    },
    { label: "المصدر", value: sourceText(row), wide: true },
  ];
  if (row.tagRationale) {
    fields.push({
      label: "مبرر الوسم",
      value: `${row.tagRationale}${
        row.taggedByUserId ? ` — بواسطة ${row.taggedByUserId}` : ""
      }`,
      wide: true,
    });
  }
  return fields;
}

export function ComparableBankPhoneList({
  rows,
  tagEditId,
  onToggleTag,
  onDeactivate,
  onReactivate,
  onTagSaved,
}: {
  rows: ComparablePropertyDto[];
  tagEditId: string | null;
  onToggleTag: (id: string) => void;
  onDeactivate: (id: string) => void;
  onReactivate: (id: string) => void;
  onTagSaved: () => void;
}) {
  return (
    <MobileRecordList className="py-3 lg:hidden">
      {rows.map((row) => (
        <MobileRecordCard
          key={row.id}
          className={cn(
            "[content-visibility:auto] [contain-intrinsic-size:auto_260px]",
            !row.isActive && "opacity-60",
          )}
          tone={row.isActive ? undefined : "muted"}
          title={`${row.referenceCode} · ${row.comparablePropertyType}${
            row.usage ? ` (${row.usage})` : ""
          }`}
          status={statusPills(row)}
          fields={rowFields(row)}
          actions={
            <>
              <button
                type="button"
                className={opsBtnGhost}
                onClick={() => onToggleTag(row.id)}
              >
                {tagEditId === row.id ? "إغلاق الوسم" : "وسم الجودة"}
              </button>
              {row.isActive ? (
                <button
                  type="button"
                  className={deactivateBtn}
                  onClick={() => onDeactivate(row.id)}
                >
                  تعطيل
                </button>
              ) : (
                <button
                  type="button"
                  className={reactivateBtn}
                  onClick={() => onReactivate(row.id)}
                >
                  تفعيل
                </button>
              )}
            </>
          }
        >
          {tagEditId === row.id ? (
            <TagEditorRow key={row.id} row={row} onSaved={onTagSaved} />
          ) : null}
        </MobileRecordCard>
      ))}
    </MobileRecordList>
  );
}
