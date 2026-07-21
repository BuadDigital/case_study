/** Generic form bag used by intake / validation helpers (not user registration). */
export type RegistrationFormData = Record<string, string>;

export type FieldErrors = Record<string, string>;

export function validateRequired(
  data: RegistrationFormData,
  keys: string[],
): string | null {
  for (const key of keys) {
    if (!(data[key] ?? "").trim()) {
      return "يرجى تعبئة الحقول المطلوبة (*)";
    }
  }
  return null;
}

export function collectRequiredErrors(
  data: RegistrationFormData,
  keys: string[],
  message = "هذا الحقل مطلوب",
): FieldErrors {
  const errors: FieldErrors = {};
  for (const key of keys) {
    if (!(data[key] ?? "").trim()) {
      errors[key] = message;
    }
  }
  return errors;
}

export function fieldRequired(
  value: string | undefined,
  message = "هذا الحقل مطلوب",
): string | undefined {
  return (value ?? "").trim() ? undefined : message;
}

export function mergeFieldErrors(
  ...parts: (FieldErrors | undefined)[]
): FieldErrors {
  return Object.assign({}, ...parts.filter(Boolean));
}

export function hasFieldErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function validateEmail(email: string): string | null {
  const e = email.trim().toLowerCase();
  if (!e) return "يرجى إدخال البريد الإلكتروني.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
    return "صيغة البريد الإلكتروني غير صحيحة.";
  }
  return null;
}

export function validatePasswordPair(
  pwd: string,
  pwd2: string,
  minLen = 6,
): string | null {
  if (!pwd || pwd.length < minLen) {
    return `كلمة المرور يجب أن تكون ${minLen} أحرف على الأقل.`;
  }
  if (pwd !== pwd2) return "كلمة المرور وتأكيدها غير متطابقتين.";
  return null;
}

export function validatePasswordPairFields(
  pwdKey: string,
  pwd2Key: string,
  pwd: string | undefined,
  pwd2: string | undefined,
  minLen = 6,
): FieldErrors {
  const errors: FieldErrors = {};
  if (!(pwd ?? "").trim()) {
    errors[pwdKey] = "كلمة المرور مطلوبة";
  } else if ((pwd ?? "").length < minLen) {
    errors[pwdKey] = `يجب أن تكون ${minLen} أحرف على الأقل`;
  }
  if (!(pwd2 ?? "").trim()) {
    errors[pwd2Key] = "تأكيد كلمة المرور مطلوب";
  } else if (pwd !== pwd2) {
    errors[pwd2Key] = "غير متطابقة مع كلمة المرور";
  }
  return errors;
}

export function hasDraftData(
  data: RegistrationFormData,
  ignore: Record<string, string> = {},
): boolean {
  return Object.entries(data).some(([key, value]) => {
    if (ignore[key] === value) return false;
    return String(value ?? "").trim() !== "";
  });
}

export const UNSAVED_CONFIRM_MSG =
  "لم يتم حفظ البيانات. هل تريد الخروج من التسجيل؟";
