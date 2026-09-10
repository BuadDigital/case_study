"use client";

import { useState } from "react";
import { cn, opsBtnGhost, opsFldControl } from "@platform/ui-kit";

import { PrimaryBtn } from "./atoms";

const extraAttachBox =
  "flex flex-col gap-2 rounded-[var(--radius)] border border-border bg-surface-2 px-3 py-2.5 text-[12.5px] text-text sm:flex-row sm:items-end sm:gap-2.5";

const fieldClass = cn(opsFldControl, "h-11 bg-surface py-0 text-[12.5px]");

const PRESET_OPTIONS = [
  { value: "deposit-certificate", label: "شهادة إيداع التقرير" },
  { value: "add-valuation-approach", label: "إضافة أسلوب التقييم" },
] as const;

const OTHER_VALUE = "other";

type PresetValue = (typeof PRESET_OPTIONS)[number]["value"];
type OptionValue = PresetValue | typeof OTHER_VALUE | "";

type SavedAttachment = {
  id: string;
  optionValue: OptionValue;
  previewUrl: string;
  fileName: string;
  /** Display / print title — starts from the option label, always editable. */
  caption: string;
  /** شهادة إيداع التقرير only. */
  depositCode?: string;
  /** إضافة أسلوب التقييم — value per the attached method (not system value). */
  approachPropertyValue?: string;
};

function optionLabel(value: OptionValue): string {
  if (value === OTHER_VALUE) return "أخرى";
  return PRESET_OPTIONS.find((o) => o.value === value)?.label ?? "";
}

function ImagePickPreview({
  previewUrl,
  onPick,
}: {
  previewUrl: string | null;
  onPick: (file: File | null, previewUrl: string | null) => void;
}) {
  return (
    <label className="relative size-11 shrink-0 cursor-pointer">
      <span
        className={cn(
          "flex size-11 items-center justify-center overflow-hidden rounded-[var(--radius)] border border-dashed border-border bg-surface text-center text-[10px] leading-tight text-text-3",
          previewUrl && "border-solid border-border-md",
        )}
      >
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className="size-full object-cover" />
        ) : (
          <span className="px-0.5">صورة</span>
        )}
      </span>
      <input
        type="file"
        accept="image/*"
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label="اختيار صورة"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          if (!file) {
            onPick(null, null);
            return;
          }
          onPick(file, URL.createObjectURL(file));
        }}
      />
    </label>
  );
}

function savedMetaLine(row: SavedAttachment): string {
  const parts = [optionLabel(row.optionValue)];
  if (row.optionValue === "deposit-certificate" && row.depositCode?.trim()) {
    parts.push(`رمز الإيداع: ${row.depositCode.trim()}`);
  }
  if (
    row.optionValue === "add-valuation-approach" &&
    row.approachPropertyValue?.trim()
  ) {
    parts.push(`قيمة العقار: ${row.approachPropertyValue.trim()}`);
  }
  parts.push(row.fileName);
  return parts.join(" · ");
}

/**
 * Extra report attachments under the print checklist — visual only for now.
 * + → pick list/أخرى → caption autofills from the choice (editable) + image.
 * Preset options (not أخرى) also collect a type-specific field.
 */
export function FinalOpinionExtraAttachmentsCard({
  disabled = false,
}: {
  disabled?: boolean;
}) {
  const [saved, setSaved] = useState<SavedAttachment[]>([]);
  const [open, setOpen] = useState(false);
  const [option, setOption] = useState<OptionValue>("");
  const [caption, setCaption] = useState("");
  const [depositCode, setDepositCode] = useState("");
  const [approachPropertyValue, setApproachPropertyValue] = useState("");
  const [fileName, setFileName] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  function clearDraft(revoke = true) {
    if (revoke && previewUrl) URL.revokeObjectURL(previewUrl);
    setOption("");
    setCaption("");
    setDepositCode("");
    setApproachPropertyValue("");
    setFileName("");
    setPreviewUrl(null);
  }

  function closeEditor() {
    clearDraft(true);
    setOpen(false);
  }

  function onOptionChange(next: OptionValue) {
    setOption(next);
    setDepositCode("");
    setApproachPropertyValue("");
    if (!next || next === OTHER_VALUE) {
      setCaption("");
      return;
    }
    setCaption(optionLabel(next));
  }

  function save() {
    if (disabled || !previewUrl || !caption.trim() || !option) return;
    if (option === "deposit-certificate" && !depositCode.trim()) return;
    if (option === "add-valuation-approach" && !approachPropertyValue.trim()) {
      return;
    }
    setSaved((prev) => [
      ...prev,
      {
        id: `extra-${Date.now()}-${prev.length}`,
        optionValue: option,
        previewUrl,
        fileName: fileName || "صورة",
        caption: caption.trim(),
        ...(option === "deposit-certificate"
          ? { depositCode: depositCode.trim() }
          : null),
        ...(option === "add-valuation-approach"
          ? { approachPropertyValue: approachPropertyValue.trim() }
          : null),
      },
    ]);
    // Keep editor open for the next item; do not revoke — URL is owned by saved row.
    setOption("");
    setCaption("");
    setDepositCode("");
    setApproachPropertyValue("");
    setFileName("");
    setPreviewUrl(null);
  }

  function removeSaved(id: string) {
    if (disabled) return;
    setSaved((prev) => {
      const row = prev.find((r) => r.id === id);
      if (row?.previewUrl) URL.revokeObjectURL(row.previewUrl);
      return prev.filter((r) => r.id !== id);
    });
  }

  const extraFieldOk =
    option === "deposit-certificate"
      ? depositCode.trim().length > 0
      : option === "add-valuation-approach"
        ? approachPropertyValue.trim().length > 0
        : true;

  const canSave =
    Boolean(previewUrl) &&
    caption.trim().length > 0 &&
    Boolean(option) &&
    extraFieldOk;

  return (
    <div className="flex flex-col gap-2">
      {saved.length > 0 ? (
        <ul className="m-0 max-h-[280px] list-none space-y-2 overflow-y-auto p-0 pe-0.5">
          {saved.map((row) => (
            <li key={row.id} className={extraAttachBox}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={row.previewUrl}
                alt=""
                className="size-11 shrink-0 rounded-[var(--radius)] object-cover"
              />
              <div className="min-w-0 flex-1 self-center">
                <div className="truncate font-semibold text-heading">
                  {row.caption}
                </div>
                <div className="mt-0.5 truncate text-[10.5px] text-text-3">
                  {savedMetaLine(row)}
                </div>
              </div>
              <button
                type="button"
                disabled={disabled}
                className={cn(
                  opsBtnGhost,
                  "shrink-0 self-center px-2 py-1 text-[11px] text-danger-text",
                )}
                onClick={() => removeSaved(row.id)}
              >
                حذف
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {!open ? (
        <button
          type="button"
          title="إضافة مرفق"
          aria-label="إضافة مرفق"
          disabled={disabled}
          className={cn(
            opsBtnGhost,
            "size-11 shrink-0 justify-center border border-dashed border-border bg-surface-2 p-0 text-[20px] font-bold leading-none text-heading",
          )}
          onClick={() => setOpen(true)}
        >
          +
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <div className={extraAttachBox}>
            <ImagePickPreview
              previewUrl={previewUrl}
              onPick={(file, url) => {
                if (previewUrl) URL.revokeObjectURL(previewUrl);
                setFileName(file?.name ?? "");
                setPreviewUrl(url);
              }}
            />
            <label className="flex w-full min-w-0 flex-1 flex-col gap-1 text-[11px] leading-none text-text-2 sm:max-w-[200px]">
              <span>النوع</span>
              <select
                value={option}
                disabled={disabled}
                onChange={(e) =>
                  onOptionChange(e.target.value as OptionValue)
                }
                className={fieldClass}
              >
                <option value="">— اختر —</option>
                {PRESET_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
                <option value={OTHER_VALUE}>أخرى</option>
              </select>
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] leading-none text-text-2">
              <span>الوصف</span>
              <input
                value={caption}
                disabled={disabled || !option}
                onChange={(e) => setCaption(e.target.value)}
                className={fieldClass}
                placeholder={
                  option === OTHER_VALUE
                    ? "اكتب اسم المرفق…"
                    : "يُملأ من النوع ويمكن تعديله…"
                }
              />
            </label>
            {option === "deposit-certificate" ? (
              <label className="flex w-full min-w-0 flex-1 flex-col gap-1 text-[11px] leading-none text-text-2 sm:max-w-[180px]">
                <span>رمز الإيداع</span>
                <input
                  value={depositCode}
                  disabled={disabled}
                  onChange={(e) => setDepositCode(e.target.value)}
                  className={fieldClass}
                  placeholder="أدخل رمز الإيداع…"
                  autoComplete="off"
                />
              </label>
            ) : null}
            {option === "add-valuation-approach" ? (
              <label className="flex w-full min-w-0 flex-1 flex-col gap-1 text-[11px] leading-none text-text-2 sm:max-w-[200px]">
                <span>قيمة العقار (حسب الطريقة)</span>
                <input
                  value={approachPropertyValue}
                  disabled={disabled}
                  onChange={(e) => setApproachPropertyValue(e.target.value)}
                  className={cn(fieldClass, "[direction:ltr] text-start")}
                  inputMode="decimal"
                  placeholder="قيمة العقار بالطريقة المرفقة…"
                  autoComplete="off"
                />
              </label>
            ) : null}
            <div className="flex shrink-0 items-end gap-1.5">
              <PrimaryBtn disabled={disabled || !canSave} onClick={save}>
                حفظ وإضافة آخر
              </PrimaryBtn>
              <button
                type="button"
                className={cn(opsBtnGhost, "h-11 px-2.5 text-[11px]")}
                onClick={closeEditor}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
