"use client";

/**
 * Text and choice sections of the register-envelope form: the request number
 * with its suggestion list, the source tiles, the third-party / missing-keys
 * fields, court and circuit, the key count, notes, and the fee notice strip.
 * Attachments live in `RegisterKeyEnvelopeAttachments`.
 */
import type { ReactNode } from "react";
import { cn, opsFldControl } from "@platform/ui-kit";
import {
  SOURCE_OPTIONS,
  feeNoticePresentation,
  suggestionDeedSummary,
  type RegisterFormState,
  type RegisterTextField,
  type RequestSuggestion,
  type SourceKind,
} from "./register-key-envelope-state";

export const fldControlClassName = opsFldControl;

export function Fld({
  full,
  className,
  children,
}: {
  full?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5", /* 6px — HTML .fld gap */
        full && "col-span-full",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function FldLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="m-0 text-[12px] font-semibold text-text-2"
    >
      {children}
    </label>
  );
}

type TextSetter = (field: RegisterTextField, value: string) => void;

export function RequestNumberField({
  value,
  listOpen,
  suggestions,
  onChange,
  onFocus,
  onBlur,
  onPick,
}: {
  value: string;
  listOpen: boolean;
  suggestions: RequestSuggestion[];
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onPick: (suggestion: RequestSuggestion) => void;
}) {
  return (
    <Fld full>
      <FldLabel htmlFor="kf-request">رقم الطلب *</FldLabel>
      <div className="relative">
        <input
          id="kf-request"
          value={value}
          autoComplete="off"
          placeholder="اكتب للبحث في طلبات المعاملات المفتوحة..."
          className={fldControlClassName}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
        />
        {listOpen && suggestions.length > 0 ? (
          <div className="absolute inset-x-0 top-[calc(100%+4px)] z-[var(--z-dropdown)] max-h-[220px] overflow-y-auto rounded-[10px] border border-border-md bg-surface p-1 shadow-[0_12px_30px_-8px_rgba(18,40,76,0.3)]">
            {suggestions.map((s) => (
              <button
                key={s.requestNumber}
                type="button"
                className="flex w-full items-center gap-2.5 rounded-lg border-none bg-transparent px-[11px] py-2 text-start hover:bg-row-hover"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPick(s)}
              >
                <span className="shrink-0 text-[13px] font-bold text-[var(--gold-d)]">
                  {s.requestNumber}
                </span>
                <span className="min-w-0 truncate text-[11.5px] text-text-2">
                  {s.court || "—"}
                  {" · "}
                  {suggestionDeedSummary(s)}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </Fld>
  );
}

export function SourceSelector({
  source,
  onSelect,
}: {
  source: SourceKind;
  onSelect: (source: SourceKind) => void;
}) {
  return (
    <Fld full>
      <FldLabel>مصدر استلام الظرف *</FldLabel>
      <div className="flex flex-wrap gap-2">
        {SOURCE_OPTIONS.map((opt) => {
          const on = source === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              className={cn(
                "h-[38px] min-w-[30%] flex-1 cursor-pointer rounded-[10px] border-[1.5px] font-[inherit] text-[12.5px] font-bold transition-all duration-150",
                on
                  ? "border-[var(--gold)] bg-[var(--gold-soft)] text-[var(--gold-d)]"
                  : "border-border-md bg-surface-2 text-text-2",
              )}
              onClick={() => onSelect(opt.id)}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </Fld>
  );
}

export function ThirdPartyFields({
  form,
  onText,
}: {
  form: Pick<
    RegisterFormState,
    "partyName" | "partyOrg" | "partyRole" | "partyPhone"
  >;
  onText: TextSetter;
}) {
  return (
    <Fld full>
      <FldLabel>بيانات الطرف المسلِّم *</FldLabel>
      <div className="grid grid-cols-2 gap-2.5">
        <input
          placeholder="الاسم * — مثال: محمد أحمد حسن"
          value={form.partyName}
          className={fldControlClassName}
          onChange={(e) => onText("partyName", e.target.value)}
        />
        <input
          placeholder="الجهة التي يمثلها — مثال: شركة أبعاد للتقييم"
          value={form.partyOrg}
          className={fldControlClassName}
          onChange={(e) => onText("partyOrg", e.target.value)}
        />
        <input
          placeholder="الصفة — مثال: وكيل بيع"
          value={form.partyRole}
          className={fldControlClassName}
          onChange={(e) => onText("partyRole", e.target.value)}
        />
        <input
          dir="ltr"
          placeholder="* 05xxxxxxxx"
          value={form.partyPhone}
          className={fldControlClassName}
          onChange={(e) => onText("partyPhone", e.target.value)}
        />
      </div>
    </Fld>
  );
}

export function MissingPhonesField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Fld full>
      <FldLabel htmlFor="kf-missing-phones">أرقام التواصل *</FldLabel>
      <textarea
        id="kf-missing-phones"
        rows={2}
        placeholder="أرقام التواصل المتعلقة بالمفاتيح المفقودة"
        value={value}
        className={cn(fldControlClassName, "resize-y")}
        onChange={(e) => onChange(e.target.value)}
      />
    </Fld>
  );
}

export function CourtCircuitFields({
  court,
  circuit,
  onText,
}: {
  court: string;
  circuit: string;
  onText: TextSetter;
}) {
  return (
    <>
      <Fld>
        <FldLabel htmlFor="kf-court">المحكمة</FldLabel>
        <input
          id="kf-court"
          placeholder="محكمة التنفيذ ب..."
          value={court}
          className={fldControlClassName}
          onChange={(e) => onText("court", e.target.value)}
        />
      </Fld>

      <Fld>
        <FldLabel htmlFor="kf-circuit">الدائرة</FldLabel>
        <input
          id="kf-circuit"
          placeholder="الدائرة ..."
          value={circuit}
          className={fldControlClassName}
          onChange={(e) => onText("circuit", e.target.value)}
        />
      </Fld>
    </>
  );
}

export function KeysCountField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Fld>
      <FldLabel htmlFor="kf-count">عدد المفاتيح *</FldLabel>
      <input
        id="kf-count"
        type="number"
        min={1}
        value={value}
        className={fldControlClassName}
        onChange={(e) => onChange(e.target.value)}
      />
    </Fld>
  );
}

export function NotesField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Fld full>
      <FldLabel htmlFor="kf-notes">ملاحظات</FldLabel>
      <textarea
        id="kf-notes"
        rows={2}
        placeholder="اختياري"
        value={value}
        className={cn(fldControlClassName, "resize-y")}
        onChange={(e) => onChange(e.target.value)}
      />
    </Fld>
  );
}

function FeeIcon({ ok }: { ok: boolean }) {
  if (ok) {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-0.5 shrink-0"
        aria-hidden
      >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <path d="m9 11 3 3L22 4" />
      </svg>
    );
  }
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 shrink-0"
      aria-hidden
    >
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

export function FeeNotice({
  source,
  photoReady,
}: {
  source: SourceKind;
  photoReady: boolean;
}) {
  const notice = feeNoticePresentation(source, photoReady);
  return (
    <div
      className="mt-3 flex items-start gap-[9px] rounded-[10px] px-3.5 py-2.5 text-[12.5px] font-semibold leading-[1.7]"
      style={{ background: notice.background, color: notice.color }}
    >
      <FeeIcon ok={notice.ok} />
      <span>{notice.text}</span>
    </div>
  );
}
