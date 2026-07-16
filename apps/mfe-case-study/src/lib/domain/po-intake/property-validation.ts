import {
  INCOMPLETE_CONTACT_MARKER_PHONE,
  type PoContact,
  type PoPropertyIntake,
} from "../../prototype/po-intake-data";
import type { FieldErrors } from "@platform/app-shared/domain/form/field-errors";

export const PHONE_MIN_DIGITS = 10;

/** Multiple mobiles in one contact field — space-separated digit groups. */
export function splitContactPhones(phone: string): string[] {
  return phone
    .split(/\s+/)
    .map((p) => p.replace(/\D/g, ""))
    .filter((p) => p.length > 0);
}

export function joinContactPhones(phones: string[]): string {
  return phones
    .map((p) => p.replace(/\D/g, ""))
    .filter((p) => p.length > 0)
    .join(" ");
}

export function phoneDigitCount(phone: string): number {
  return phone.replace(/\D/g, "").length;
}

export function isValidPhone(phone: string): boolean {
  return phoneDigitCount(phone) >= PHONE_MIN_DIGITS;
}

export function areValidContactPhones(phoneField: string): boolean {
  const phones = splitContactPhones(phoneField);
  return phones.length > 0 && phones.every(isValidPhone);
}

export function normalizePhoneInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 15);
}

export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function isIncompleteMarkerPhone(phone: string): boolean {
  const digits = normalizePhoneDigits(phone);
  return (
    digits === INCOMPLETE_CONTACT_MARKER_PHONE ||
    digits === INCOMPLETE_CONTACT_MARKER_PHONE.replace(/^0/, "")
  );
}

export function propertyHasIncompleteContact(prop: PoPropertyIntake): boolean {
  return prop.contacts.some((c) =>
    splitContactPhones(c.phone).some(isIncompleteMarkerPhone),
  );
}

export function isValidContactEntry(c: PoContact): boolean {
  return areValidContactPhones(c.phone) && c.role.trim().length > 0;
}

export function contactsForApi(contacts: PoContact[]): PoContact[] {
  return contacts.map((c) => ({
    name: c.name.trim(),
    role: c.role.trim(),
    phone: joinContactPhones(splitContactPhones(c.phone)),
  }));
}

export function validatePropertyContacts(p: PoPropertyIntake): FieldErrors {
  const errors: FieldErrors = {};
  let hasValid = false;
  p.contacts.forEach((c, i) => {
    const phones = splitContactPhones(c.phone);
    const role = c.role.trim();
    if (phones.length === 0 && !role) return;
    if (phones.length === 0) {
      errors[`contact_phone_${i}`] = "رقم الجوال مطلوب";
    } else if (phones.some((phone) => !isValidPhone(phone))) {
      errors[`contact_phone_${i}`] =
        `كل رقم جوال يجب أن يكون ${PHONE_MIN_DIGITS} أرقام على الأقل (افصل بينها بمسافة)`;
    }
    if (!role) errors[`contact_role_${i}`] = "صفة الضابط مطلوبة";
    if (isValidContactEntry(c)) hasValid = true;
  });
  if (!hasValid) {
    errors._contacts = "أضف ضابط اتصال واحداً على الأقل (جوال + صفة)";
  }
  return errors;
}
