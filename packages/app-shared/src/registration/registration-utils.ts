/** Generic form bag used by intake / validation helpers (not user registration). */
export type RegistrationFormData = Record<string, string>;

export type FieldErrors = Record<string, string>;


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





export const UNSAVED_CONFIRM_MSG =
  "لم يتم حفظ البيانات. هل تريد الخروج من التسجيل؟";
