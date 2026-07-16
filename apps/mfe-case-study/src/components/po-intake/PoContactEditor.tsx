"use client";

import { useState } from "react";
import {
  CONTACT_ROLE_OPTIONS,
  type PoContact,
} from "../../lib/prototype/po-intake-data";
import { RegField, RegSelect } from "@platform/app-shared/registration/FormFields";
import {
  Button,
  Label,
  cn,
  formControlClassName,
  formControlErrorClassName,
} from "@platform/design-system";
import {
  joinContactPhones,
  normalizePhoneInput,
  PHONE_MIN_DIGITS,
  splitContactPhones,
} from "../../lib/domain/po-intake/property-validation";

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
  const phones = splitContactPhones(value);
  const [draft, setDraft] = useState("");

  function commitDraft() {
    const next = normalizePhoneInput(draft);
    if (!next || next.length < PHONE_MIN_DIGITS) return;
    if (phones.includes(next)) {
      setDraft("");
      return;
    }
    onChange(joinContactPhones([...phones, next]));
    setDraft("");
  }

  function removePhone(phone: string) {
    onChange(joinContactPhones(phones.filter((p) => p !== phone)));
  }

  return (
    <div className="w-full sm:col-span-2">
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
      {error ? (
        <p className="mt-1 text-[10px] text-danger-text" role="alert">
          {error}
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
  function patch(index: number, key: keyof PoContact, value: string) {
    onChange(
      contacts.map((c, i) => (i === index ? { ...c, [key]: value } : c)),
    );
  }

  function addContact() {
    onChange([...contacts, { name: "", role: "", phone: "" }]);
  }

  function removeContact(index: number) {
    if (contacts.length <= 1) return;
    onChange(contacts.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-3">
      {contacts.map((c, i) => (
        <div
          key={i}
          className="rounded-[var(--radius-DEFAULT)] border border-border bg-surface p-3"
        >
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <RegField
              id={`po_contact_name_${i}`}
              label="الاسم"
              value={c.name}
              error={errors[`contact_name_${i}`]}
              onChange={(v) => patch(i, "name", v)}
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
        </div>
      ))}
      <Button type="button" size="sm" onClick={addContact}>
        + إضافة ضابط اتصال
      </Button>
    </div>
  );
}
