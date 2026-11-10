"use client";

import { useState } from "react";
import {
  CONTACT_ROLE_OPTIONS,
  emptyPoContact,
  type PoContact,
} from "../../lib/app-data/po-intake-data";
import { RegField, RegSelect } from "@platform/app-shared/registration/FormFields";
import {
  Button,
  Label,
  cn,
  formControlClassName,
  formControlErrorClassName,
  ICON_PATHS,
  useWorkDensity,
  WORK_FORM_GRID_CLASS,
} from "@platform/ui-kit";
import {
  CONTACT_PHONE_TOO_LONG,
  contactPhonesFit,
  joinContactPhones,
  normalizePhoneInput,
  PHONE_MIN_DIGITS,
  splitContactPhones,
} from "../../lib/domain/po-intake/property-validation";
import {
  ACCESS_CONTACT_NATIONAL_ID_LABEL,
  normalizeSaudiNationalId,
} from "@platform/app-shared/app-data/inspector-workspace-data";

function ContactPhoneField({
  id,
  value,
  error,
  onChange,
}: {
  id: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const work = useWorkDensity();
  const phones = splitContactPhones(value);
  const [draft, setDraft] = useState("");
  const [full, setFull] = useState(false);

  /**
   * Adds the typed number as a chip.
   *
   * How it works: digits only, at least PHONE_MIN_DIGITS, no duplicates; the joined list
   * must still fit the server column.
   *
   * Edge cases: a number that would not fit stays in the box with a note to add another
   * contact (fixed 2026-10-28 — a fourth mobile used to fail the whole save with a 500).
   */
  function commitDraft() {
    const next = normalizePhoneInput(draft);
    if (!next || next.length < PHONE_MIN_DIGITS) return;
    if (phones.includes(next)) {
      setDraft("");
      return;
    }
    if (!contactPhonesFit([...phones, next])) {
      setFull(true);
      return;
    }
    setFull(false);
    onChange(joinContactPhones([...phones, next]));
    setDraft("");
  }

  function removePhone(phone: string) {
    onChange(joinContactPhones(phones.filter((p) => p !== phone)));
  }

  return (
    <div className={work ? "w-full" : "w-full sm:col-span-2"}>
      <Label className="mb-1 text-[11px]" htmlFor={id}>
        رقم الجوال <span className="text-danger-text">*</span>
      </Label>
      <div
        className={cn(
          formControlClassName,
          "flex min-h-9 flex-wrap items-center gap-1.5 py-1.5",
          error && formControlErrorClassName,
        )}
        dir="ltr"
      >
        {phones.map((phone) => (
          <span
            key={phone}
            className="inline-flex items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-text-2"
          >
            {phone}
            <button
              type="button"
              className="text-text-3 hover:text-danger-text"
              aria-label={`إزالة ${phone}`}
              onClick={() => removePhone(phone)}
            >
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          className="min-w-[7rem] flex-1 border-0 bg-transparent p-0 text-[12px] outline-none"
          placeholder={
            phones.length === 0
              ? `${PHONE_MIN_DIGITS}+ ثم مسافة للرقم التالي`
              : "رقم آخر ثم مسافة"
          }
          value={draft}
          onChange={(e) => setDraft(normalizePhoneInput(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commitDraft();
              return;
            }
            if (e.key === "Backspace" && !draft && phones.length > 0) {
              e.preventDefault();
              onChange(joinContactPhones(phones.slice(0, -1)));
            }
          }}
          onBlur={() => commitDraft()}
        />
      </div>
      <p className="mt-1 text-[10px] text-text-3">
        اكتب الرقم ثم اضغط مسافة لحفظه وإضافة رقم آخر
      </p>
      {error || full ? (
        <p className="mt-1 text-[10px] text-danger-text" role="alert">
          {error ?? CONTACT_PHONE_TOO_LONG}
        </p>
      ) : null}
    </div>
  );
}

export function PoContactEditor({
  contacts,
  errors,
  onChange,
}: {
  contacts: PoContact[];
  errors: Record<string, string>;
  onChange: (contacts: PoContact[]) => void;
}) {
  // The work page (Omar 2026-11-09): a contact's four fields on one row of the page's four columns.
  const work = useWorkDensity();
  function patch(index: number, key: keyof PoContact, value: string) {
    onChange(
      contacts.map((c, i) => (i === index ? { ...c, [key]: value } : c)),
    );
  }

  function addContact() {
    onChange([...contacts, emptyPoContact()]);
  }

  function removeContact(index: number) {
    if (contacts.length <= 1) return;
    onChange(contacts.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Omar 2026-11-10: no box around a contact — a line only between two contacts — and a bare «+». */}
      {contacts.map((c, i) => (
        <div key={i} className={cn(i > 0 && "border-t border-border pt-3")}>
          <div className="mb-2.5 flex items-center justify-between text-xs font-semibold text-text-2">
            <span>ضابط اتصال {contacts.length > 1 ? i + 1 : ""}</span>
            {contacts.length > 1 ? (
              <Button
                type="button"
                size="sm"
                variant="danger"
                onClick={() => removeContact(i)}
              >
                حذف
              </Button>
            ) : null}
          </div>
          {/* The «+» sits beside the last contact's fields; the other rows keep an empty slot of the
              same width so the columns line up. */}
          <div className="flex items-start gap-2">
          <div className={cn("min-w-0 flex-1", work ? WORK_FORM_GRID_CLASS : "grid grid-cols-1 gap-3 sm:grid-cols-2")}>
            <RegField
              id={`po_contact_name_${i}`}
              label="الاسم"
              value={c.name}
              error={errors[`contact_name_${i}`]}
              onChange={(v) => patch(i, "name", v)}
            />
            <RegField
              id={`po_contact_national_id_${i}`}
              label={ACCESS_CONTACT_NATIONAL_ID_LABEL}
              value={c.nationalId ?? ""}
              error={errors[`contact_national_id_${i}`]}
              inputMode="numeric"
              dir="ltr"
              maxLength={10}
              onChange={(v) => patch(i, "nationalId", normalizeSaudiNationalId(v))}
            />
            <RegSelect
              id={`po_contact_role_${i}`}
              label="صفة الضابط"
              required
              options={[...CONTACT_ROLE_OPTIONS]}
              value={c.role}
              error={errors[`contact_role_${i}`]}
              placeholder="اختر الصفة..."
              onChange={(v) => patch(i, "role", v)}
            />
            <ContactPhoneField
              id={`po_contact_phone_${i}`}
              value={c.phone}
              error={errors[`contact_phone_${i}`]}
              onChange={(v) => patch(i, "phone", v)}
            />
          </div>
          {/* Omar 2026-11-10: the «+» is an input's size (38px, the field radius) and sits under an
              invisible copy of the field label, so it lines up with the boxes at either density. */}
          <div className="flex shrink-0 flex-col">
            <Label
              aria-hidden
              className={cn(
                "invisible select-none",
                work ? "mb-1 text-[11px] font-semibold" : "mb-1.5 text-[12px] font-semibold",
              )}
            >
              +
            </Label>
            {i === contacts.length - 1 ? (
              <Button
                type="button"
                size="icon"
                variant="default"
                className="!h-[38px] !w-[38px] !rounded-[9px]"
                title="إضافة ضابط اتصال"
                aria-label="إضافة ضابط اتصال"
                onClick={addContact}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden>
                  <path d={ICON_PATHS.plus} />
                </svg>
              </Button>
            ) : (
              <span className="w-[38px]" aria-hidden />
            )}
          </div>
          </div>
        </div>
      ))}
    </div>
  );
}
