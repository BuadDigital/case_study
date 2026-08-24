"use client";

import { Input, Label } from "@platform/ui-kit";
import {
  COMPARABLE_SOURCE_OPTIONS,
  computedPricePerSqm,
  type ComparableEntryDraft,
} from "../../lib/comparable-entry";

export function ComparablePropertyEntryFields({
  draft,
  disabled,
  showCoordinates,
  showDescription,
  onChange,
}: {
  draft: ComparableEntryDraft;
  disabled?: boolean;
  showCoordinates?: boolean;
  showDescription?: boolean;
  onChange: (next: ComparableEntryDraft) => void;
}) {
  const patch = <K extends keyof ComparableEntryDraft>(
    key: K,
    value: ComparableEntryDraft[K],
  ) => onChange({ ...draft, [key]: value });

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div>
        <Label className="text-[10.5px] text-text-2">العقار المقارن (نوعه)</Label>
        <Input
          value={draft.comparablePropertyType}
          disabled={disabled}
          onChange={(e) => patch("comparablePropertyType", e.target.value)}
          className="text-xs"
        />
      </div>
      <div>
        <Label className="text-[10.5px] text-text-2">نوع العملية</Label>
        <select
          className="w-full rounded-md border border-border-md bg-surface px-2 py-[7px] text-[12px]"
          value={draft.transactionKind}
          disabled={disabled}
          onChange={(e) =>
            patch("transactionKind", e.target.value === "executed" ? "executed" : "offer")
          }
        >
          <option value="offer">عرض</option>
          <option value="executed">صفقة منفّذة</option>
        </select>
      </div>
      {draft.transactionKind === "offer" ? (
        <div>
          <Label className="text-[10.5px] text-text-2">وصف السعر</Label>
          <select
            className="w-full rounded-md border border-border-md bg-surface px-2 py-[7px] text-[12px]"
            value={draft.priceDescription}
            disabled={disabled}
            onChange={(e) =>
              patch("priceDescription", e.target.value === "som" ? "som" : "asking")
            }
          >
            <option value="asking">حد</option>
            <option value="som">سوم</option>
          </select>
        </div>
      ) : null}
      <div>
        <Label className="text-[10.5px] text-text-2">مصدر المعلومة</Label>
        <select
          className="w-full rounded-md border border-border-md bg-surface px-2 py-[7px] text-[12px]"
          value={draft.source}
          disabled={disabled}
          onChange={(e) => patch("source", e.target.value)}
        >
          {COMPARABLE_SOURCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label className="text-[10.5px] text-text-2">
          {draft.transactionKind === "executed" ? "رقم المعلومة / الصفقة" : "رقم الإعلان / المعلومة"}
        </Label>
        <Input
          value={draft.listingNumber}
          disabled={disabled}
          onChange={(e) => patch("listingNumber", e.target.value)}
          className="text-xs"
        />
      </div>
      <div>
        <Label className="text-[10.5px] text-text-2">رقم التواصل</Label>
        <Input
          dir="ltr"
          value={draft.advertiserPhone}
          disabled={disabled}
          onChange={(e) => patch("advertiserPhone", e.target.value)}
          className="text-xs"
        />
      </div>
      <div>
        <Label className="text-[10.5px] text-text-2">المساحة (م²)</Label>
        <Input
          inputMode="decimal"
          dir="ltr"
          value={draft.areaSqm}
          disabled={disabled}
          onChange={(e) => patch("areaSqm", e.target.value)}
          className="text-xs"
        />
      </div>
      <div>
        <Label className="text-[10.5px] text-text-2">تاريخ العملية</Label>
        <Input
          type="date"
          dir="ltr"
          value={draft.transactionDate}
          disabled={disabled}
          onChange={(e) => patch("transactionDate", e.target.value)}
          className="text-xs"
        />
      </div>
      <div>
        <Label className="text-[10.5px] text-text-2">السعر (ر.س.)</Label>
        <Input
          inputMode="decimal"
          dir="ltr"
          value={draft.price}
          disabled={disabled}
          onChange={(e) => patch("price", e.target.value)}
          className="text-xs"
        />
      </div>
      <div>
        <Label className="text-[10.5px] text-text-2">سعر المتر (محسوب)</Label>
        <Input
          readOnly
          dir="ltr"
          value={computedPricePerSqm(draft.price, draft.areaSqm)}
          className="text-xs bg-surface-2"
        />
      </div>
      <div>
        <Label className="text-[10.5px] text-text-2">المدينة</Label>
        <Input
          value={draft.city}
          disabled={disabled}
          onChange={(e) => patch("city", e.target.value)}
          className="text-xs"
        />
      </div>
      <div>
        <Label className="text-[10.5px] text-text-2">الحي</Label>
        <Input
          value={draft.district}
          disabled={disabled}
          onChange={(e) => patch("district", e.target.value)}
          className="text-xs"
        />
      </div>
      <div>
        <Label className="text-[10.5px] text-text-2">رقم المخطط</Label>
        <Input
          value={draft.planNumber}
          disabled={disabled}
          onChange={(e) => patch("planNumber", e.target.value)}
          className="text-xs"
        />
      </div>
      <div>
        <Label className="text-[10.5px] text-text-2">القطعة</Label>
        <Input
          value={draft.plotNumber}
          disabled={disabled}
          onChange={(e) => patch("plotNumber", e.target.value)}
          className="text-xs"
        />
      </div>
      {showCoordinates !== false ? (
        <div className="grid grid-cols-2 gap-2 sm:col-span-2">
          <div>
            <Label className="text-[10.5px] text-text-2">خط العرض</Label>
            <Input
              dir="ltr"
              value={draft.latitude}
              disabled={disabled}
              onChange={(e) => patch("latitude", e.target.value)}
              className="text-xs"
            />
          </div>
          <div>
            <Label className="text-[10.5px] text-text-2">خط الطول</Label>
            <Input
              dir="ltr"
              value={draft.longitude}
              disabled={disabled}
              onChange={(e) => patch("longitude", e.target.value)}
              className="text-xs"
            />
          </div>
        </div>
      ) : null}
      {showDescription !== false ? (
        <div className="sm:col-span-2">
          <Label className="text-[10.5px] text-text-2">وصف العقار</Label>
          <Input
            value={draft.description}
            disabled={disabled}
            onChange={(e) => patch("description", e.target.value)}
            className="text-xs"
          />
        </div>
      ) : null}
    </div>
  );
}
