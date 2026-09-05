/**
 * Pure decisions for the users screen: add-user form model + validation,
 * list filtering, status labels, protected-account rule, API payload and
 * error-message mapping. No React.
 */

import type { RoleId } from "@platform/types";
import type { CreateStaffUserRequest } from "@platform/api-client";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import {
  adminStaffRoleOptions,
  isSectionSupervisorRole,
  SUPERVISOR_DEPARTMENT_OPTIONS,
  supervisingDepartmentLabel,
} from "@platform/app-shared/users/admin-staff-roles";
import {
  collectRequiredErrors,
  fieldRequired,
  mergeFieldErrors,
  type FieldErrors,
} from "@platform/app-shared/registration/registration-utils";

const ROLE_OPTIONS = adminStaffRoleOptions();
export const ROLE_SELECT_OPTIONS = ROLE_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));
export const SUPERVISOR_DEPARTMENT_SELECT_OPTIONS = SUPERVISOR_DEPARTMENT_OPTIONS.map(
  (o) => ({ value: o.value, label: o.label }),
);
export const INSPECTOR_TYPE_OPTIONS = [
  { value: "employee", label: "موظف" },
  { value: "contractor", label: "متعاون" },
];

const PROTECTED_USERNAMES = new Set(["sliman", "admin"]);
const PROTECTED_EMAILS = new Set(["s.salhy@gmail.com", "admin@local.dev"]);

export type StaffFormState = {
  displayName: string;
  roleId: RoleId | "";
  email: string;
  mobile: string;
  city: string;
  department: string;
  inspectorType: "employee" | "contractor" | "";
  hasCompensation: boolean;
  feeValueSar: string;
  iban: string;
  taxNumber: string;
  commercialRegistration: string;
  joinedAt: string;
  avatarUrl: string;
  nationalId: string;
};

export const EMPTY_STAFF_FORM: StaffFormState = {
  displayName: "",
  roleId: "",
  email: "",
  mobile: "",
  city: "",
  department: "",
  inspectorType: "",
  hasCompensation: false,
  feeValueSar: "",
  iban: "",
  taxNumber: "",
  commercialRegistration: "",
  joinedAt: "",
  avatarUrl: "",
  nationalId: "",
};

export type StaffStatusFilter = "all" | "on" | "off";

export function validateStaffForm(form: StaffFormState): FieldErrors {
  return mergeFieldErrors(
    collectRequiredErrors(
      {
        displayName: form.displayName,
        roleId: form.roleId,
        email: form.email,
        mobile: form.mobile,
        city: form.city,
        nationalId: form.nationalId,
      },
      ["displayName", "roleId", "email", "mobile", "city", "nationalId"],
    ),
    form.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())
      ? { email: "صيغة البريد الإلكتروني غير صحيحة." }
      : undefined,
    fieldRequired(form.displayName)
      ? { displayName: fieldRequired(form.displayName)! }
      : undefined,
    fieldRequired(form.roleId) ? { roleId: fieldRequired(form.roleId)! } : undefined,
    form.mobile.trim() && !/^(\+9665|05)\d{8}$/.test(form.mobile.trim())
      ? { mobile: "صيغة رقم الجوال غير صحيحة." }
      : undefined,
    form.nationalId.trim() && !/^[12]\d{9}$/.test(form.nationalId.trim())
      ? { nationalId: "رقم الهوية يجب أن يتكون من 10 أرقام." }
      : undefined,
    form.roleId === "field-inspector" && !form.inspectorType
      ? { inspectorType: "نوع المعاين مطلوب." }
      : undefined,
    isSectionSupervisorRole(form.roleId) &&
      !SUPERVISOR_DEPARTMENT_OPTIONS.some((o) => o.value === form.department)
      ? { department: "يجب اختيار قسم المشرف: دراسة الحالة أو التقييم." }
      : undefined,
    form.hasCompensation && (!form.feeValueSar || Number(form.feeValueSar) < 0)
      ? { feeValueSar: "قيمة الأتعاب مطلوبة." }
      : undefined,
    form.iban.trim() && !/^SA\d{22}$/i.test(form.iban.replace(/\s/g, ""))
      ? { iban: "صيغة الآيبان السعودي غير صحيحة." }
      : undefined,
    form.avatarUrl.trim() && !/^https?:\/\/\S+$/i.test(form.avatarUrl.trim())
      ? { avatarUrl: "رابط الصورة الشخصية غير صالح." }
      : undefined,
  );
}

/** Role change also clears the supervising department unless the new role supervises. */
export function applyRoleChange(
  prev: StaffFormState,
  roleId: RoleId | "",
): StaffFormState {
  return {
    ...prev,
    roleId,
    department: isSectionSupervisorRole(roleId) ? prev.department : "",
  };
}

export function withoutRoleErrors(errors: FieldErrors): FieldErrors {
  const next = { ...errors };
  delete next.roleId;
  delete next.department;
  return next;
}

export function withoutFieldError(errors: FieldErrors, key: string): FieldErrors {
  if (!errors[key]) return errors;
  const next = { ...errors };
  delete next[key];
  return next;
}

export function buildCreateStaffUserPayload(form: StaffFormState): CreateStaffUserRequest {
  return {
    displayName: form.displayName.trim(),
    email: form.email.trim(),
    mobile: form.mobile.trim(),
    city: form.city.trim(),
    roleId: form.roleId as RoleId,
    department: isSectionSupervisorRole(form.roleId)
      ? form.department.trim()
      : undefined,
    inspectorType: form.inspectorType || undefined,
    hasCompensation: form.hasCompensation,
    feeValueSar: form.hasCompensation ? Number(form.feeValueSar) : undefined,
    iban: form.iban.trim() || undefined,
    taxNumber: form.taxNumber.trim() || undefined,
    commercialRegistration: form.commercialRegistration.trim() || undefined,
    joinedAt: form.joinedAt || undefined,
    avatarUrl: form.avatarUrl.trim() || undefined,
    nationalId: form.nationalId.trim(),
  };
}

export function statusTone(
  status: string | undefined,
): "success" | "danger" | "warning" | "default" {
  if (status === "Active") return "success";
  if (status === "Locked") return "danger";
  if (status === "PendingActivation") return "warning";
  return "default";
}

export function statusLabel(status: string | undefined): string {
  if (status === "Active") return "نشط";
  if (status === "Disabled") return "معطّل";
  if (status === "PendingActivation") return "بانتظار التفعيل";
  if (status === "Locked") return "موقوف";
  return status || "—";
}

/** Label of the row's second action button, by account status. */
export function userToggleLabel(status: string | undefined): string {
  if (status === "Locked") return "فك القفل";
  if (status === "PendingActivation") return "دعوة";
  if (status === "Disabled") return "تفعيل";
  return "تعطيل";
}

export function canDeleteUser(
  user: { id: string; email: string; userName?: string },
  currentUserId: string | null,
): boolean {
  if (currentUserId && user.id === currentUserId) return false;
  const email = user.email.trim().toLowerCase();
  const userName = (user.userName ?? "").trim().toLowerCase();
  if (PROTECTED_EMAILS.has(email) || PROTECTED_USERNAMES.has(userName)) return false;
  return true;
}

export function formatLastLogin(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("ar-SA", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function deptLabel(user: StaffUser): string {
  return (
    supervisingDepartmentLabel(user.department) ||
    user.department?.trim() ||
    "—"
  );
}

export function filterStaffUsers(
  users: StaffUser[],
  search: string,
  statusFilter: StaffStatusFilter,
): StaffUser[] {
  const q = search.trim();
  return users.filter((user) => {
    if (statusFilter === "on" && user.status !== "Active") return false;
    if (
      statusFilter === "off" &&
      user.status !== "Disabled" &&
      user.status !== "Locked"
    ) {
      return false;
    }
    if (!q) return true;
    return user.name.includes(q);
  });
}

export function emptyUsersMessage(totalUsers: number): string {
  return totalUsers === 0 ? "لا يوجد مستخدمون بعد" : "لا يوجد مستخدمون مطابقون للبحث";
}

/* ---------- dialog copy & API error mapping ---------- */

export const PROTECTED_ACCOUNT_TOAST = "لا يمكن تعطيل هذا الحساب.";
const NETWORK_MESSAGE = "تعذر الاتصال بالخادم.";

export function disableUserConfirmCopy(name: string) {
  return {
    title: "تعطيل مستخدم",
    body: `«${name}» يفقد الدخول فوراً وتبقى سجلاته في سجل التدقيق.`,
    confirm: "تعطيل",
  };
}

type FailedResult = { kind: string; message?: string; errors?: FieldErrors };

export function createUserErrorMessage(result: FailedResult): string {
  return result.kind === "network" ? NETWORK_MESSAGE : "تعذر إنشاء المستخدم.";
}

export function activationTicketErrorMessage(result: FailedResult): string {
  return result.kind === "network"
    ? NETWORK_MESSAGE
    : (result.message ?? "تعذر إصدار دعوة التفعيل.");
}

export function deleteUserErrorMessage(result: FailedResult): string {
  return result.kind === "validation"
    ? (result.message ?? "تعذر تعطيل المستخدم.")
    : result.kind === "network"
      ? NETWORK_MESSAGE
      : "تعذر تعطيل المستخدم.";
}

/** Field errors the edit modal renders when an update fails. */
export function saveEditErrors(result: FailedResult): FieldErrors {
  if (result.kind === "validation" && result.errors) return result.errors;
  return {
    _form: result.kind === "network" ? NETWORK_MESSAGE : "تعذر حفظ التعديلات.",
  };
}

export function reactivateErrorMessage(result: FailedResult): string {
  return result.kind === "validation"
    ? (result.errors?._form ?? result.errors?.status ?? "تعذر تفعيل المستخدم.")
    : result.kind === "network"
      ? NETWORK_MESSAGE
      : "تعذر تفعيل المستخدم.";
}

export function unlockErrorMessage(result: FailedResult): string {
  return result.kind === "network"
    ? NETWORK_MESSAGE
    : (result.message ?? "تعذر فك قفل الحساب.");
}

export const USER_TOASTS = {
  created: "تم إنشاء المستخدم بنجاح.",
  ticketIssued: "تم إصدار دعوة التفعيل.",
  disabled: "تم تعطيل المستخدم.",
  edited: "تم حفظ التعديلات.",
  reactivated: "تم تفعيل المستخدم.",
  unlocked: "تم فك قفل الحساب.",
} as const;
