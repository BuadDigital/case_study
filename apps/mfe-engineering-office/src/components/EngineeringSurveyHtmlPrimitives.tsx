"use client";

import type { ReactNode } from "react";
import { useRef, useState } from "react";
import {
  StatusPill,
  cn,
  opsBtnPrimary,
  opsFieldBox,
  statusPillStyleFromColor,
} from "@platform/ui-kit";

export function EngSection({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2.5 mt-[18px] border-b border-border pb-[7px] text-[13px] font-bold text-heading">
      {children}
    </div>
  );
}

export function EngInfo({
  children,
  variant = "gold",
}: {
  children: ReactNode;
  variant?: "gold" | "amber" | "red";
}) {
  const styles =
    variant === "amber"
      ? "border-[#fad7a0] bg-[#fef3d7] text-[#7a5b12]"
      : variant === "red"
        ? "border-[color-mix(in_srgb,#d9694f_30%,transparent)] bg-[color-mix(in_srgb,#d9694f_9%,transparent)] text-[#a5432e]"
        : "border-[color-mix(in_srgb,var(--gold)_28%,transparent)] bg-[color-mix(in_srgb,var(--gold)_8%,transparent)] text-text-2";
  return (
    <div
      className={cn(
        "mb-3 rounded-lg border px-3 py-2.5 text-[11.5px] leading-[1.7]",
        styles,
      )}
    >
      {children}
    </div>
  );
}

export function EngField({
  label,
  value,
  ltr,
  children,
}: {
  label: string;
  value?: ReactNode;
  ltr?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className={opsFieldBox}>
      <div className="mb-[3px] text-[10.5px] text-text-3">{label}</div>
      <div
        className={cn(
          "text-[12.5px] font-semibold text-text",
          ltr && "text-end [direction:ltr]",
        )}
      >
        {children ?? value ?? "—"}
      </div>
    </div>
  );
}

export function EngStatusPill({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return <StatusPill label={label} style={statusPillStyleFromColor(color)} />;
}

export const ENG_STATUS_COLORS = {
  draft: "var(--gold)",
  submitted: "#3f8f5f",
  reopened: "#d9a441",
  completed: "#3f8f5f",
  view: "#8a8d96",
  unpaid: "#8a8d96",
  pending: "#d9a441",
} as const;

/** Matches the Case Study / appraiser tab bar — active tab fills a navy «ink» box. */
export function EngTabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; dot?: boolean; badge?: number }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      className="z-10 mx-[-20px] mb-[18px] flex flex-wrap gap-x-0.5 gap-y-0 overflow-visible whitespace-nowrap border-b border-border bg-transparent px-3.5 sm:px-3.5"
      role="tablist"
      aria-label="أقسام مساحة عمل الرفع المساحي"
    >
      {tabs.map((tab) => {
        const on = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative mb-0 max-lg:min-h-0 cursor-pointer rounded-none border-0 border-b-0 bg-transparent px-2.5 py-[9px] font-[inherit] text-[12.5px] font-normal text-text-2 transition-[background,color] duration-150",
              "hover:bg-[color-mix(in_srgb,#102B4E_6%,transparent)] hover:text-heading",
              on && "!bg-ink !font-normal !text-white hover:!bg-ink hover:!text-white",
            )}
          >
            {tab.label}
            {tab.dot ? (
              <span
                className="ms-1 inline-block size-1.5 rounded-full bg-gold-d align-middle"
                aria-hidden
              />
            ) : null}
            {tab.badge && tab.badge > 0 ? (
              <span className="ms-1 rounded-[10px] bg-danger-bg px-1.5 py-px text-[10px] font-medium text-danger-text">
                {tab.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function EngUploadBox({
  id,
  title,
  hint,
  fileName,
  disabled,
  onPick,
  onClear,
  error,
}: {
  id?: string;
  title: string;
  hint: string;
  fileName: string;
  disabled?: boolean;
  onPick: (file: File | null) => void;
  onClear: () => void;
  error?: string;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function isPdfFile(file: File): boolean {
    const type = (file.type || "").toLowerCase();
    if (type === "application/pdf") return true;
    return file.name.toLowerCase().endsWith(".pdf");
  }

  function pickFromList(files: FileList | File[] | null | undefined) {
    const file = files?.[0];
    if (!file || !isPdfFile(file)) return;
    onPick(file);
  }

  return (
    <div id={id}>
      {/* Once a file is attached only the chip shows; removing it brings the dropzone back. */}
      {!disabled && !fileName ? (
        <div
          role="button"
          tabIndex={0}
          aria-label={`${title} — اختر ملفاً أو اسحبه هنا`}
          className={cn(
            "cursor-pointer rounded-[10px] border-2 border-dashed p-[18px] text-center transition-[border-color,background]",
            dragOver
              ? "border-gold-d bg-[color-mix(in_srgb,var(--gold)_12%,transparent)]"
              : "border-border-md bg-surface-2",
            error &&
              "border-danger bg-danger-bg/40 ring-2 ring-[color-mix(in_srgb,var(--danger)_28%,transparent)]",
          )}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Avoid flicker when leaving into a child element.
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragOver(false);
            pickFromList(e.dataTransfer.files);
          }}
        >
          <div className="mb-[3px] text-xs font-bold text-text-2">{title}</div>
          <div className="mb-2.5 text-[11px] text-text-3">
            {dragOver
              ? "أفلِت ملف PDF هنا"
              : `${hint} · أو اسحب الملف وأفلِته هنا`}
          </div>
          <span
            className={cn(
              opsBtnPrimary,
              "!pointer-events-none !px-4 !py-1.5 !text-[11.5px]",
            )}
          >
            اختيار ملف
          </span>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            disabled={disabled}
            onChange={(e) => {
              pickFromList(e.target.files);
              e.target.value = "";
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
      {fileName ? (
        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-heading">
          <span className="flex min-w-0 items-center gap-2">
            <svg
              className="h-4 w-4 shrink-0 text-gold-d"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
            <span className="truncate font-semibold" dir="ltr">{fileName}</span>
          </span>
          {!disabled ? (
            <button
              type="button"
              className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-surface text-[15px] font-bold leading-none text-red-600 transition hover:bg-red-600 hover:text-white"
              onClick={onClear}
              aria-label="حذف الملف"
              title="حذف الملف"
            >
              ×
            </button>
          ) : null}
        </div>
      ) : disabled ? (
        <div className="px-0.5 py-1.5 text-xs text-text-3">لم يُرفع أي ملف.</div>
      ) : null}
      {error ? (
        <p className="mt-1 text-[11px] text-danger">{error}</p>
      ) : null}
    </div>
  );
}
