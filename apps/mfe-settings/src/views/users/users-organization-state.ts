/**
 * Pure decisions for the users screen: add-user form model + validation,
 * list filtering, status labels, protected-account rule, API payload and
 * error-message mapping. No React.
 */

import type { RoleId } from "@platform/types";
import type { CreateStaffUserRequest } from "@platform/api-client";
import type { StaffUser } from "@platform/app-shared/app-data/constants";
import type {
  OrganizationValuerRosterEntry,
  StaffReportRole,
  SyncStaffValuerRequest,
} from "@platform/api-client";
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

export type StaffFormState = {
  displayName: string;
  roleId: RoleId | "";
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
  nationalId: string;
};

export const EMPTY_STAFF_FORM: StaffFormState = {
  displayName: "",
  roleId: "",
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
  nationalId: "",
};

export type StaffStatusFilter = "all" | "on" | "off" | "seated";

export function validateStaffForm(form: StaffFormState): FieldErrors {
  return mergeFieldErrors(
    collectRequiredErrors(
      {
        displayName: form.displayName,
        roleId: form.roleId,
        mobile: form.mobile,
        city: form.city,
        nationalId: form.nationalId,
      },
      ["displayName", "roleId", "mobile", "city", "nationalId"],
    ),
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
  if (status === "PendingActivation") return "بانتظار التفعيل (قديم)";
  if (status === "Locked") return "موقوف";
  return status || "—";
}

/** Label of the row's second action button, by account status. */
export function userToggleLabel(status: string | undefined): string {
  if (status === "Locked") return "فك القفل";
  if (status === "PendingActivation") return "تفعيل";
  if (status === "Disabled") return "تفعيل";
  return "تعطيل";
}

export function canDeleteUser(
  user: { id: string; userName?: string },
  currentUserId: string | null,
): boolean {
  if (currentUserId && user.id === currentUserId) return false;
  const userName = (user.userName ?? "").trim().toLowerCase();
  if (PROTECTED_USERNAMES.has(userName)) return false;
  return true;
}

export const STAFF_ROLE_CHANGE_SELF = "لا يمكن تغيير دورك بنفسك.";
export const STAFF_ROLE_CHANGE_LAST_ADMIN = "لا يمكن إزالة آخر مسؤول نظام.";

function isPrivilegedStaffRole(roleId: string | null | undefined): boolean {
  const id = (roleId ?? "").trim().toLowerCase();
  return id === "cdo" || id === "admin";
}

export function staffRoleChangeBlocked(
  viewerUserId: string | null,
  target: Pick<StaffUser, "id" | "roleId" | "status">,
  nextRoleId: string,
  users: Pick<StaffUser, "id" | "roleId" | "status">[],
): string | null {
  if ((nextRoleId || "") === (target.roleId ?? "")) return null;
  if (viewerUserId && target.id === viewerUserId) return STAFF_ROLE_CHANGE_SELF;
  if (!isPrivilegedStaffRole(target.roleId) || isPrivilegedStaffRole(nextRoleId)) {
    return null;
  }
  const activeAdmins = users.filter(
    (row) => row.status !== "Disabled" && isPrivilegedStaffRole(row.roleId),
  );
  return activeAdmins.length <= 1 ? STAFF_ROLE_CHANGE_LAST_ADMIN : null;
}

export function staffRoleSelectLocked(
  viewerUserId: string | null,
  target: Pick<StaffUser, "id" | "roleId" | "status">,
  users: Pick<StaffUser, "id" | "roleId" | "status">[],
): string | null {
  if (viewerUserId && target.id === viewerUserId) return STAFF_ROLE_CHANGE_SELF;
  if (!isPrivilegedStaffRole(target.roleId)) return null;
  const activeAdmins = users.filter(
    (row) => row.status !== "Disabled" && isPrivilegedStaffRole(row.roleId),
  );
  return activeAdmins.length <= 1 ? STAFF_ROLE_CHANGE_LAST_ADMIN : null;
}

export function formatLastLogin(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
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
  seatedIds: ReadonlySet<string> = new Set(),
): StaffUser[] {
  const q = search.trim();
  return users.filter((user) => {
    if (statusFilter === "seated" && !seatedIds.has(user.id)) return false;
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
const NETWORK_MESSAGE = "تعذّر الاتصال بالخادم.";

export function disableUserConfirmCopy(name: string) {
  return {
    title: "تعطيل مستخدم",
    body: `«${name}» يفقد الدخول فوراً وتبقى سجلاته في سجل التدقيق.`,
    confirm: "تعطيل",
  };
}

type FailedResult = { kind: string; message?: string; errors?: FieldErrors };

export function createUserErrorMessage(result: FailedResult): string {
  return result.kind === "network" ? NETWORK_MESSAGE : "تعذّر إنشاء المستخدم.";
}

export function deleteUserErrorMessage(result: FailedResult): string {
  return result.kind === "validation"
    ? (result.message ?? "تعذّر تعطيل المستخدم.")
    : result.kind === "network"
      ? NETWORK_MESSAGE
      : "تعذّر تعطيل المستخدم.";
}

/** Field errors the edit modal renders when an update fails. */
export function saveEditErrors(result: FailedResult): FieldErrors {
  if (result.kind === "validation" && result.errors) return result.errors;
  return {
    _form: result.kind === "network" ? NETWORK_MESSAGE : "تعذّر حفظ التعديلات.",
  };
}

export function reactivateErrorMessage(result: FailedResult): string {
  return result.kind === "validation"
    ? (result.errors?._form ?? result.errors?.status ?? "تعذّر تفعيل المستخدم.")
    : result.kind === "network"
      ? NETWORK_MESSAGE
      : "تعذّر تفعيل المستخدم.";
}

export function unlockErrorMessage(result: FailedResult): string {
  return result.kind === "network"
    ? NETWORK_MESSAGE
    : (result.message ?? "تعذّر فك قفل الحساب.");
}

export const USER_TOASTS = {
  created: "تم إنشاء المستخدم بنجاح.",
  disabled: "تم تعطيل المستخدم.",
  edited: "تم حفظ التعديلات.",
  reactivated: "تم تفعيل المستخدم.",
  unlocked: "تم فك قفل الحساب.",
  rosterSyncFailed:
    "تم حفظ الحساب، وتعذّر مزامنته مع سجل المقيّمين. أكمل الربط من شاشة المقيّمون.",
} as const;

const APPRAISER_ROLE_ID = "real-estate-appraiser";

/** Seat in the valuation report; "certified" is read-only here (chosen in بيانات المنشأة). */
export type StaffReportSeat = StaffReportRole | "certified";

/** «البيانات المهنية» on a user's card — what the valuers roster row carries. */
export type StaffProfessional = {
  reportRole: StaffReportSeat;
  membershipCategory: string;
  membershipNumber: string;
  membershipExpiresAt: string;
  licenseNumber: string;
  licenseIssuedAt: string;
  licenseExpiresAt: string;
  signatureUrl: string;
  /** Set when the account has no row yet and the admin picks an existing unlinked one. */
  linkRosterRowId: string;
};

export const REPORT_ROLE_OPTIONS: { value: StaffReportRole; label: string }[] = [
  { value: "none", label: "لا يظهر" },
  { value: "valuer", label: "مقيّم عقاري" },
  { value: "reviewer", label: "مقيّم عقاري مراجع" },
  { value: "assistant", label: "مساعد مقيّم" },
];

/** A new appraiser account takes a seat at once; every other role stays out of the report. */
export function defaultReportRole(roleId: string | null | undefined): StaffReportRole {
  return roleId === APPRAISER_ROLE_ID ? "valuer" : "none";
}

export function rosterRowFor(
  valuers: readonly OrganizationValuerRosterEntry[],
  userId: string,
): OrganizationValuerRosterEntry | null {
  const id = userId.trim();
  return valuers.find((v) => (v.staffUserId ?? "").trim() === id) ?? null;
}

function seatOf(row: OrganizationValuerRosterEntry | null, roleId: string | null | undefined): StaffReportSeat {
  if (!row) return defaultReportRole(roleId);
  if (row.role === "certified") return "certified";
  if (!row.isActive) return "none";
  return row.role === "reviewer" || row.role === "assistant" ? row.role : "valuer";
}

export function professionalFromRow(
  row: OrganizationValuerRosterEntry | null,
  roleId: string | null | undefined,
): StaffProfessional {
  return {
    reportRole: seatOf(row, roleId),
    membershipCategory: row?.membershipCategory ?? "",
    membershipNumber: row?.membershipNumber ?? "",
    membershipExpiresAt: row?.membershipExpiresAt ?? "",
    licenseNumber: row?.licenseNumber ?? "",
    licenseIssuedAt: row?.licenseIssuedAt ?? "",
    licenseExpiresAt: row?.licenseExpiresAt ?? "",
    signatureUrl: row?.signatureUrl ?? "",
    linkRosterRowId: "",
  };
}

/** Rows nobody's account owns yet — offered on a card that has no row of its own. */
export function unlinkedRosterRows(
  valuers: readonly OrganizationValuerRosterEntry[],
): OrganizationValuerRosterEntry[] {
  return valuers.filter((v) => !(v.staffUserId ?? "").trim());
}

export function professionalEquals(a: StaffProfessional, b: StaffProfessional): boolean {
  return (Object.keys(a) as (keyof StaffProfessional)[]).every((k) => a[k].trim() === b[k].trim());
}

/** Everything the sync endpoint takes from the card; the certified seat is never sent from here. */
export function professionalToSyncFields(
  p: StaffProfessional,
): Omit<SyncStaffValuerRequest, "userId" | "displayName" | "mode"> {
  return {
    ...(p.reportRole === "certified" ? {} : { reportRole: p.reportRole }),
    membershipCategory: p.membershipCategory.trim(),
    membershipNumber: p.membershipNumber.trim(),
    membershipExpiresAt: p.membershipExpiresAt.trim(),
    licenseNumber: p.licenseNumber.trim(),
    licenseIssuedAt: p.licenseIssuedAt.trim(),
    licenseExpiresAt: p.licenseExpiresAt.trim(),
    signatureUrl: p.signatureUrl.trim(),
    ...(p.linkRosterRowId.trim() ? { linkRosterRowId: p.linkRosterRowId.trim() } : {}),
  };
}

/** A disabled account leaves the report; otherwise the server applies the seat it is sent. */
export function staffValuerSyncMode(
  status: string | null | undefined,
): "upsert" | "deactivate" {
  return status === "Disabled" ? "deactivate" : "upsert";
}
