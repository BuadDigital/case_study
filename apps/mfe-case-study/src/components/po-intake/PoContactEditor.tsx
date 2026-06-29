"use client";

import {
  CONTACT_ROLE_OPTIONS,
  type PoContact,
} from "../../lib/prototype/po-intake-data";
import { RegField, RegSelect } from "@platform/app-shared/registration/FormFields";
import { Button } from "@platform/design-system";
import {
  normalizePhoneInput,
  PHONE_MIN_DIGITS,
} from "../../lib/domain/po-intake/property-validation";

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
            <RegField
              id={`po_contact_phone_${i}`}
              label="رقم الجوال"
              required
              type="tel"
              dir="ltr"
              inputMode="numeric"
              placeholder={`${PHONE_MIN_DIGITS} أرقام على الأقل`}
              value={c.phone}
              error={errors[`contact_phone_${i}`]}
              onChange={(v) => patch(i, "phone", normalizePhoneInput(v))}
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
